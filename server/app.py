"""Сервер курса: регистрация, прогресс, живые викторины и облако слов.
Один процесс на aiohttp. База: SQLite (файл). Пароли: scrypt с солью. Запуск: см. documentation/13-server.md"""
import asyncio
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import tempfile
import time
from email.message import EmailMessage

from aiohttp import web, WSMsgType

import race as R
import boss as B

DB_PATH = os.environ.get("DB_PATH", "data.sqlite")
TEACHER_KEY = os.environ.get("TEACHER_KEY", "")
TEACHER_USER = os.environ.get("TEACHER_USER", "")
TEACHER_SALT = os.environ.get("TEACHER_SALT", "")
TEACHER_HASH = os.environ.get("TEACHER_HASH", "")
TSESS = {}  # токен сессии учителя (вход по логину и паролю) -> до какого времени действует
ORIGINS = [o.strip() for o in os.environ.get("ALLOW_ORIGINS", "https://vmse1.github.io,http://127.0.0.1:8000,http://localhost:8000").split(",") if o.strip()]
PORT = int(os.environ.get("PORT", "8080"))
# Почта (необязательно). Без неё код для восстановления пароля показывается только учителю в кабинете.
SMTP_HOST, SMTP_PORT = os.environ.get("SMTP_HOST", ""), int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER, SMTP_PASS = os.environ.get("SMTP_USER", ""), os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "") or SMTP_USER
TEACHER_EMAIL = os.environ.get("TEACHER_EMAIL", "")
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,120}\.[^@\s]{2,20}$")
MAX_PROGRESS = 20000
NICK_RE = re.compile(r"^[A-Za-z0-9А-Яа-яЁё_.\-]{3,20}$")

# ---------------------------------------------------------------- база
db = None


def init_db():
    global db
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY, nick TEXT UNIQUE COLLATE NOCASE, fio TEXT, grp TEXT,
      salt BLOB, hash BLOB, created INTEGER, updated INTEGER, progress TEXT DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS sessions(th TEXT PRIMARY KEY, uid INTEGER, created INTEGER);
    CREATE TABLE IF NOT EXISTS subs(id INTEGER PRIMARY KEY, uid INTEGER, task TEXT, ts INTEGER, status TEXT, msgs TEXT, code TEXT, meta TEXT);
    CREATE INDEX IF NOT EXISTS subs_ut ON subs(uid, task);
    CREATE TABLE IF NOT EXISTS recov(id INTEGER PRIMARY KEY, uid INTEGER, ch TEXT, exp INTEGER, tries INTEGER DEFAULT 0, ts INTEGER, code TEXT, mailed INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lucky(id INTEGER PRIMARY KEY, uid INTEGER, ts INTEGER, kind TEXT, note TEXT);
    CREATE TABLE IF NOT EXISTS scores(uid INTEGER, game TEXT, best REAL, ts INTEGER, PRIMARY KEY(uid, game));
    """)
    cols = [r[1] for r in db.execute("PRAGMA table_info(users)")]
    if "email" not in cols:
        db.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
    db.commit()


def pw_hash(password, salt):
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)


def th(token):
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------- вспомогательное
HITS = {}   # ключ -> [время, ...] для лимитов


def limited(key, n, per):
    now = time.time()
    lst = [t for t in HITS.get(key, []) if now - t < per]
    if len(lst) >= n:
        HITS[key] = lst
        return True
    lst.append(now)
    HITS[key] = lst
    return False


FAILS = {}  # ключ -> [число неудач, блок до, время последней неудачи]
LOCK_STEPS = ((3, 30), (5, 120), (7, 300))   # после 3 неудач 30 с, после 5 две минуты, после 7 пять минут (дальше потолок 5 минут)
FAIL_FORGET = 1800                            # через полчаса без попыток счётчик обнуляется


def lock_wait(key):
    f = FAILS.get(key)
    return max(0, int(f[1] - time.time() + .999)) if f else 0


def lock_fail(key, now=None):
    now = now or time.time()
    f = FAILS.get(key)
    if not f or now - f[2] > FAIL_FORGET:
        f = [0, 0, now]
    f[0] += 1
    f[2] = now
    sec = 0
    for n, w in LOCK_STEPS:
        if f[0] >= n:
            sec = w
    f[1] = now + sec if sec else 0
    FAILS[key] = f
    return int(sec)


def guard():
    """Защита от ботов и подмены прогресса. Тесты отключают её: BOT_GUARD=0."""
    return os.environ.get("BOT_GUARD", "1") != "0"


BOT_UA = ("python", "aiohttp", "httpx", "requests", "urllib", "curl", "wget", "scrapy", "selenium", "headless")
BOT_MSG = "Ай-ай-ай! Ботам тут не место. Заходи через сайт курса и отвечай сам."


MIN_ANSWER_SEC = 1.0


def is_bot(req):
    """Скрипты на Python не шлют Origin сайта курса и подписываются своим User-Agent.
    Подделать это можно, но это отсекает «написал бота за вечер»."""
    if not guard():
        return False
    if req.headers.get("Origin", "") not in ORIGINS:
        return True
    ua = req.headers.get("User-Agent", "").lower()
    return not ua or any(x in ua for x in BOT_UA)


def client_ip(req):
    return req.headers.get("X-Forwarded-For", req.remote or "?").split(",")[0].strip()


def jerr(msg, status=400):
    return web.json_response({"ok": False, "error": msg}, status=status)


def tkey_valid(k):
    """Ключ учителя с сервера или токен, выданный после входа по логину и паролю."""
    k = str(k or "")
    if TEACHER_KEY and hmac.compare_digest(k.encode(), TEACHER_KEY.encode()):
        return True
    exp = TSESS.get(k)
    return bool(exp and exp > time.time())


def teacher_ok(req):
    return tkey_valid(req.headers.get("X-Teacher-Key", ""))


def user_from(req):
    h = req.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        return None
    row = db.execute("SELECT u.id,u.nick,u.fio,u.grp,u.progress FROM sessions s JOIN users u ON u.id=s.uid WHERE s.th=?", (th(h[7:]),)).fetchone()
    return row


def clean_str(v, n):
    return " ".join(str(v or "").split())[:n]


MAX_NEW, NEW_WINDOW = 10, 600
SUBJECTS = ("python", "sql", "blender", "ai")
SUBJ_KEY = re.compile(r"^(sql|blender|ai):\d{1,2}\.\d{1,2}$")


def merge_progress(old, new):
    """Объединяет прогресс: выполненное не теряется ни на одном устройстве."""
    out = dict(old)
    for k in ("passed", "done", "played"):
        a, b = old.get(k) if isinstance(old.get(k), dict) else {}, new.get(k) if isinstance(new.get(k), dict) else {}
        m = dict(a)
        for i, v in b.items():
            if re.match(r"^\d{1,2}\.\d{1,2}$", str(i)) and v:
                m[i] = 1
        out[k] = m
    # другие предметы (SQL, Blender, нейросети): отметки вида "sql:1.2" и выбранный предмет
    a, b = old.get("subj") if isinstance(old.get("subj"), dict) else {}, new.get("subj") if isinstance(new.get("subj"), dict) else {}
    m = {i: 1 for i, v in a.items() if SUBJ_KEY.match(str(i)) and v}
    for i, v in b.items():
        if v and SUBJ_KEY.match(str(i)) and len(m) < 400:
            m[i] = 1
    out["subj"] = m
    if new.get("subject") in SUBJECTS:
        out["subject"] = new["subject"]
    elif old.get("subject") not in SUBJECTS:
        out.pop("subject", None)
    sa, sb = old.get("streak") if isinstance(old.get("streak"), dict) else {}, new.get("streak") if isinstance(new.get("streak"), dict) else {}
    pick = sa if str(sa.get("last", "")) >= str(sb.get("last", "")) else sb
    out["streak"] = {"last": str(pick.get("last", ""))[:10], "n": int(pick.get("n", 0) or 0) if isinstance(pick.get("n", 0), (int, float)) else 0,
                     "best": max(int(sa.get("best", 0) or 0), int(sb.get("best", 0) or 0)), "days": pick.get("days") if isinstance(pick.get("days"), list) else []}
    out["streak"]["days"] = [str(d)[:10] for d in out["streak"]["days"]][-60:]
    return out


# ---------------------------------------------------------------- HTTP
@web.middleware
async def cors(req, handler):
    origin = req.headers.get("Origin", "")
    if req.method == "OPTIONS":
        resp = web.Response(status=204)
    else:
        try:
            resp = await handler(req)
        except web.HTTPException as e:
            resp = web.json_response({"ok": False, "error": e.reason}, status=e.status)
        except Exception:
            resp = jerr("внутренняя ошибка", 500)
    if origin in ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Teacher-Key"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return resp


async def body(req):
    try:
        d = await req.json()
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


async def ping(req):
    return web.json_response({"ok": True, "v": 2, "feat": ["boss"], "t": int(time.time())})


async def register(req):
    ip = client_ip(req)
    if is_bot(req):
        return jerr(BOT_MSG, 403)
    if limited("reg:" + ip, 80, 3600):
        return jerr("Слишком много регистраций с этой сети. Попробуй позже.", 429)
    d = await body(req)
    nick, fio, grp, pw = str(d.get("nick", "")).strip(), clean_str(d.get("fio"), 60), clean_str(d.get("group"), 12), str(d.get("password", ""))
    if not NICK_RE.match(nick):
        return jerr("Ник: 3–20 символов, буквы, цифры, точка, дефис или подчёркивание.")
    email = str(d.get("email", "")).strip()[:150]
    if d.get("quick"):  # быстрая регистрация: логин, пароль, почта. Фамилия и группа по желанию
        fio, grp = fio or nick, grp or "нет"
    if email and not EMAIL_RE.match(email):
        return jerr("Почта написана неверно. Пример: имя@mail.ru")
    if not email and (not d.get("quick") or d.get("need_email")):
        return jerr("Впиши почту: на неё придёт код, если забудешь пароль.")
    if len(fio) < 3:
        return jerr("Впиши фамилию и имя.")
    if not grp:
        return jerr("Впиши группу (например 9А) или «нет».")
    if len(pw) < 6 or len(pw) > 100:
        return jerr("Пароль: минимум 6 символов.")
    salt = secrets.token_bytes(16)
    try:
        now = int(time.time())
        cur = db.execute("INSERT INTO users(nick,fio,grp,salt,hash,created,updated,email) VALUES(?,?,?,?,?,?,?,?)", (nick, fio, grp, salt, pw_hash(pw, salt), now, now, email))
        db.commit()
    except sqlite3.IntegrityError:
        return jerr("Такой ник уже занят. Придумай другой.", 409)
    return web.json_response(session_for(cur.lastrowid, nick, fio, grp, "{}"))


def session_for(uid, nick, fio, grp, progress):
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions(th,uid,created) VALUES(?,?,?)", (th(token), uid, int(time.time())))
    db.execute("DELETE FROM sessions WHERE uid=? AND th NOT IN (SELECT th FROM sessions WHERE uid=? ORDER BY created DESC LIMIT 8)", (uid, uid))
    db.commit()
    try:
        pr = json.loads(progress or "{}")
    except Exception:
        pr = {}
    return {"ok": True, "token": token, "nick": nick, "fio": fio, "group": grp, "progress": pr}


async def login(req):
    d = await body(req)
    nick, pw = str(d.get("nick", "")).strip(), str(d.get("password", ""))
    ip = client_ip(req)
    # много учеников сидят за одним школьным Wi-Fi (один IP), поэтому общий лимит по IP щедрый; главная защита идёт по паре «ник + IP» и по самому нику
    if is_bot(req):
        return jerr(BOT_MSG, 403)
    if limited("login:" + ip, 300, 600):
        return jerr("Слишком много попыток с этой сети. Подожди несколько минут.", 429)
    k1, k2 = "u:%s|%s" % (nick.lower(), ip), "n:" + nick.lower()
    w = max(lock_wait(k1), lock_wait(k2))
    if w:
        return web.json_response({"ok": False, "error": "Слишком много неверных паролей. Подожди %d с." % w, "wait": w}, status=429, headers={"Retry-After": str(w)})
    row = db.execute("SELECT id,nick,fio,grp,salt,hash,progress FROM users WHERE nick=?", (nick,)).fetchone()
    # хэш считаем и для несуществующего ника, чтобы по времени ответа нельзя было узнать, есть ли такой ник
    ok = hmac.compare_digest(pw_hash(pw, row[4] if row else b"\0" * 16), row[5] if row else b"\0" * 32) and bool(row)
    if not ok:
        wait = lock_fail(k1)
        # по самому нику блокируем мягче (десять неудач с разных адресов подряд): так чужой не сможет надолго «запереть» ученика
        f = FAILS.setdefault(k2, [0, 0, time.time()])
        if time.time() - f[2] > FAIL_FORGET:
            f[0] = 0
        f[0] += 1
        f[2] = time.time()
        if f[0] >= 10:
            f[1] = time.time() + 120
            wait = max(wait, 120)
        msg = "Неверный ник или пароль." + (" Подожди %d с." % wait if wait else "")
        return web.json_response({"ok": False, "error": msg, "wait": wait}, status=401)
    FAILS.pop(k1, None)
    FAILS.pop(k2, None)
    return web.json_response(session_for(row[0], row[1], row[2], row[3], row[6]))


async def logout(req):
    h = req.headers.get("Authorization", "")
    if h.startswith("Bearer "):
        db.execute("DELETE FROM sessions WHERE th=?", (th(h[7:]),))
        db.commit()
    return web.json_response({"ok": True})


async def me(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    try:
        pr = json.loads(u[4] or "{}")
    except Exception:
        pr = {}
    return web.json_response({"ok": True, "nick": u[1], "fio": u[2], "group": u[3], "progress": pr})


async def put_progress(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    if limited("prog:%d" % u[0], 60, 600):
        return jerr("Слишком часто.", 429)
    d = await body(req)
    new = d.get("progress")
    if not isinstance(new, dict) or len(json.dumps(new)) > MAX_PROGRESS:
        return jerr("Неверные данные.")
    try:
        old = json.loads(u[4] or "{}")
    except Exception:
        old = {}
    # «passed/done» нельзя подделать пачкой из консоли: не больше MAX_NEW новых отметок за окно времени
    now = time.time()
    times = [t for t in old.get("_t", []) if isinstance(t, (int, float)) and now - t < NEW_WINDOW]
    dropped, new = 0, dict(new)
    for k in ("passed", "done"):
        nb = new.get(k) if isinstance(new.get(k), dict) else {}
        ob = old.get(k) if isinstance(old.get(k), dict) else {}
        keep = {}
        for i, v in nb.items():
            if v and i not in ob and re.match(r"^\d{1,2}\.\d{1,2}$", str(i)):
                if guard() and len(times) >= MAX_NEW:
                    dropped += 1
                    continue
                times.append(now)
            keep[i] = v
        new[k] = keep
    merged = merge_progress(old, new)
    merged["_t"] = times
    if dropped or old.get("sus"):
        sus = old.get("sus") if isinstance(old.get("sus"), dict) else {}
        merged["sus"] = {"n": int(sus.get("n", 0)) + dropped, "last": int(now) if dropped else sus.get("last", 0)}
    db.execute("UPDATE users SET progress=?, updated=? WHERE id=?", (json.dumps(merged, ensure_ascii=False), int(time.time()), u[0]))
    db.commit()
    return web.json_response({"ok": True, "progress": merged})


async def t_users(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    rows = db.execute("SELECT nick,fio,grp,created,updated,progress,email FROM users ORDER BY grp,fio").fetchall()
    out = []
    for nick, fio, grp, cr, up, pr, em in rows:
        try:
            p = json.loads(pr or "{}")
        except Exception:
            p = {}
        out.append({"nick": nick, "fio": fio, "group": grp, "created": cr, "updated": up, "email": em or "",
                    "passed": sorted((p.get("passed") or {}).keys()), "done": sorted((p.get("done") or {}).keys()), "subj": sorted((p.get("subj") or {}).keys()) if isinstance(p.get("subj"), dict) else [], "subject": p.get("subject", ""),
                    "streak": (p.get("streak") or {}).get("n", 0), "sus": (p.get("sus") or {}).get("n", 0)})
    return web.json_response({"ok": True, "users": out})


async def t_reset(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    d = await body(req)
    nick, pw = str(d.get("nick", "")).strip(), str(d.get("password", ""))
    if len(pw) < 6:
        return jerr("Пароль: минимум 6 символов.")
    salt = secrets.token_bytes(16)
    cur = db.execute("UPDATE users SET salt=?, hash=? WHERE nick=?", (salt, pw_hash(pw, salt), nick))
    db.execute("DELETE FROM sessions WHERE uid IN (SELECT id FROM users WHERE nick=?)", (nick,))
    db.commit()
    for k in [k for k in FAILS if k == "n:" + nick.lower() or k.startswith("u:" + nick.lower() + "|")]:
        FAILS.pop(k, None)
    return web.json_response({"ok": cur.rowcount > 0}) if cur.rowcount else jerr("Такого ника нет.", 404)


async def t_delete(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    nick = req.query.get("nick", "")
    db.execute("DELETE FROM sessions WHERE uid IN (SELECT id FROM users WHERE nick=?)", (nick,))
    cur = db.execute("DELETE FROM users WHERE nick=?", (nick,))
    db.commit()
    return web.json_response({"ok": cur.rowcount > 0})


async def t_login(req):
    if is_bot(req):
        return jerr(BOT_MSG, 403)
    if limited("tl:" + client_ip(req), 120, 600):
        return jerr("Слишком много попыток. Подожди несколько минут.", 429)
    d = await body(req)
    login, pw = str(d.get("login", "")).strip(), str(d.get("password", ""))
    ok = bool(TEACHER_USER and TEACHER_SALT and TEACHER_HASH)
    h = pw_hash(pw, bytes.fromhex(TEACHER_SALT)).hex() if ok else ""
    ok = ok and hmac.compare_digest(login.lower().encode(), TEACHER_USER.lower().encode()) and hmac.compare_digest(h.encode(), TEACHER_HASH.encode())
    if not ok:
        return jerr("Неверный логин или пароль.", 401)
    now = time.time()
    for k in [k for k, v in TSESS.items() if v < now]:
        del TSESS[k]
    while len(TSESS) >= 50:
        del TSESS[min(TSESS, key=TSESS.get)]
    tok = secrets.token_urlsafe(24)
    TSESS[tok] = now + 12 * 3600
    return web.json_response({"ok": True, "token": tok})


async def t_check(req):
    return web.json_response({"ok": teacher_ok(req)})


# ---------------------------------------------------------------- живые комнаты
ROOMS = {}
WORD_RE = re.compile(r"[^\w\-+# ]", re.U)


def clean_word(w):
    w = WORD_RE.sub("", str(w)).strip().lower()
    w = " ".join(w.split())
    return w[:24]


def new_code():
    for _ in range(50):
        c = "%04d" % secrets.randbelow(10000)
        if c not in ROOMS:
            return c
    return None


class Room:
    def __init__(self, code, kind, title, questions, host):
        self.code, self.kind, self.title, self.qs, self.host = code, kind, title, questions, host
        self.players = {}       # ws -> dict(nick, score, ans, words)
        self.state = "lobby"    # lobby | q | res | end | open | closed
        self.i = -1
        self.t0 = 0
        self.timer = None
        self.words = {}         # слово -> set(ников)
        self.dirty = False
        self.touched = time.time()
        self.cloud_task = None
        self.fp_strikes = {}    # устройство (адрес + User-Agent) -> штрафы, чтобы не обходить бан новым ником
        self.banned = set()     # ники, заблокированные в этой комнате
        self.saved = {}         # ник -> счёт, чтобы при обрыве связи очки не терялись

    def board(self, n=10):
        rows = sorted(self.players.values(), key=lambda p: -p["score"])
        return [{"nick": p["nick"], "score": int(p["score"])} for p in rows[:n]]

    def rank(self, p):
        return 1 + sum(1 for x in self.players.values() if x["score"] > p["score"])


async def send(ws, obj):
    if ws is None or ws.closed:
        return
    try:
        await ws.send_str(json.dumps(obj, ensure_ascii=False))
    except Exception:
        pass


async def to_all(room, obj, host=True):
    for ws in list(room.players):
        await send(ws, obj)
    if host:
        await send(room.host, obj)


async def plist(room):
    await to_all(room, {"t": "players", "n": len(room.players), "list": [p["nick"] for p in list(room.players.values())[-40:]]})


def question_view(room):
    q = room.qs[room.i]
    return {"t": "q", "i": room.i, "n": len(room.qs), "q": q["q"], "code": q.get("code", ""), "o": q["o"], "sec": q["sec"]}


async def open_question(room):
    room.i += 1
    if room.i >= len(room.qs):
        room.state = "end"
        await to_all(room, {"t": "end", "board": room.board(10)})
        return
    room.state, room.t0 = "q", time.time()
    for p in room.players.values():
        p["ans"] = None
    await to_all(room, question_view(room))
    sec = room.qs[room.i]["sec"]
    idx = room.i
    if room.timer:
        room.timer.cancel()
    room.timer = asyncio.create_task(timeout_q(room, idx, sec))


async def timeout_q(room, idx, sec):
    try:
        await asyncio.sleep(sec + 0.6)
        if room.state == "q" and room.i == idx:
            await close_question(room)
    except asyncio.CancelledError:
        pass


async def close_question(room):
    if room.state != "q":
        return
    room.state = "res"
    q = room.qs[room.i]
    counts = [0, 0, 0, 0]
    for p in room.players.values():
        if p["ans"] is not None and 0 <= p["ans"][0] < 4:
            counts[p["ans"][0]] += 1
    board = room.board(5)
    for ws, p in room.players.items():
        a = p["ans"]
        ok = a is not None and a[0] == q["a"]
        await send(ws, {"t": "res", "i": room.i, "a": q["a"], "why": q.get("why", ""), "ok": ok, "gain": a[1] if ok else 0, "score": int(p["score"]), "rank": room.rank(p), "board": board, "counts": counts, "last": room.i + 1 >= len(room.qs)})
    await send(room.host, {"t": "res", "i": room.i, "a": q["a"], "why": q.get("why", ""), "board": board, "counts": counts, "last": room.i + 1 >= len(room.qs)})


async def cloud_loop(room):
    """Раз в полсекунды рассылает облако, если оно изменилось (чтобы 100 человек не заваливали экран обновлениями)."""
    try:
        while room.state in ("open", "closed", "lobby"):
            await asyncio.sleep(0.5)
            if room.dirty:
                room.dirty = False
                words = sorted(((w, len(s)) for w, s in room.words.items()), key=lambda x: (-x[1], x[0]))[:80]
                await to_all(room, {"t": "cloud", "words": words, "people": len({n for s in room.words.values() for n in s})})
    except asyncio.CancelledError:
        pass


def valid_questions(qs):
    out = []
    if not isinstance(qs, list) or not 1 <= len(qs) <= 60:
        return None
    for q in qs:
        try:
            o = [str(x)[:120] for x in q["o"]][:4]
            a = int(q["a"])
            if len(o) != 4 or not 0 <= a < 4:
                return None
            out.append({"q": str(q["q"])[:300], "code": str(q.get("code", ""))[:600], "o": o, "a": a, "why": str(q.get("why", ""))[:300], "sec": max(5, min(120, int(q.get("sec", 20))))})
        except Exception:
            return None
    return out


async def ws_handler(req):
    ws = web.WebSocketResponse(heartbeat=25, max_msg_size=8192)
    await ws.prepare(req)
    ip = client_ip(req)
    if is_bot(req):
        await send(ws, {"t": "err", "m": BOT_MSG})
        await ws.close()
        return ws
    if limited("ws:" + ip, 60, 60):
        await send(ws, {"t": "err", "m": "Слишком много подключений."})
        await ws.close()
        return ws
    role = {"room": None, "host": False}
    stamps = []
    try:
        async for m in ws:
            if m.type != WSMsgType.TEXT:
                continue
            now = time.time()
            stamps = [x for x in stamps if now - x < 1] + [now]
            if len(stamps) > 25:
                continue
            try:
                d = json.loads(m.data)
                if not isinstance(d, dict):
                    continue
            except Exception:
                continue
            await on_msg(ws, role, d)
    finally:
        r = role["room"]
        if r:
            if role["host"]:
                r.host = None
                r.touched = time.time()
                await to_all(r, {"t": "hostoff"}, host=False)
            elif ws in r.players:
                r.saved[r.players[ws]["nick"].lower()] = r.players[ws]["score"]
                del r.players[ws]
                await plist(r)
    return ws


async def on_msg(ws, role, d):
    t = d.get("t")
    room = role["room"]
    if t == "host" or t == "rehost":
        if not teacher_ok_key(d.get("key")):
            await send(ws, {"t": "err", "m": "Неверный ключ учителя."})
            return
        if t == "rehost":
            r = ROOMS.get(str(d.get("code", "")))
            if not r:
                await send(ws, {"t": "err", "m": "Комната уже закрыта."})
                return
            r.host = ws
            role.update(room=r, host=True)
            await send(ws, {"t": "hosted", "code": r.code, "kind": r.kind, "title": r.title, "state": r.state, "n": len(r.players)})
            return
        kind = d.get("kind")
        code = new_code()
        if not code or len(ROOMS) > 200:
            await send(ws, {"t": "err", "m": "Слишком много комнат."})
            return
        title = clean_str(d.get("title"), 60)
        if kind == "quiz":
            qs = valid_questions(d.get("questions"))
            if not qs:
                await send(ws, {"t": "err", "m": "Неверный набор вопросов."})
                return
            r = Room(code, "quiz", title, qs, ws)
        elif kind == "cloud":
            r = Room(code, "cloud", title or "Облако слов", [], ws)
            r.state = "open"
            r.cloud_task = asyncio.create_task(cloud_loop(r))
        else:
            return
        ROOMS[code] = r
        role.update(room=r, host=True)
        await send(ws, {"t": "hosted", "code": code, "kind": kind, "title": r.title, "state": r.state, "n": 0, "total": len(r.qs)})
        return
    if t == "join":
        r = ROOMS.get(str(d.get("code", "")).strip())
        nick = clean_str(d.get("nick"), 20)
        if not r:
            await send(ws, {"t": "err", "m": "Комнаты с таким кодом нет. Проверь цифры."})
            return
        if len(nick) < 2:
            await send(ws, {"t": "err", "m": "Впиши ник (минимум 2 символа)."})
            return
        if len(r.players) >= 150:
            await send(ws, {"t": "err", "m": "В комнате нет мест."})
            return
        fp = role.get("fp", "")
        if nick.lower() in r.banned or r.fp_strikes.get(fp, 0) >= 6:
            await send(ws, {"t": "err", "m": "Ай-ай-ай! Ты заблокирован в этой игре за бота."})
            return
        if any(p["nick"].lower() == nick.lower() for p in r.players.values()):
            await send(ws, {"t": "err", "m": "Такой ник уже есть в комнате. Добавь цифру."})
            return
        r.players[ws] = {"nick": nick, "score": r.saved.get(nick.lower(), 0), "ans": None, "words": 0, "fp": fp, "strikes": r.fp_strikes.get(fp, 0) % 3}
        role["room"] = r
        await send(ws, {"t": "joined", "kind": r.kind, "title": r.title, "state": r.state, "total": len(r.qs)})
        await plist(r)
        if r.kind == "cloud":
            r.dirty = True
        elif r.state == "q":
            await send(ws, question_view(r))
        return
    if not room:
        return
    room.touched = time.time()
    if role["host"]:
        if t == "start" and room.kind == "quiz" and room.state == "lobby":
            await open_question(room)
        elif t == "skip" and room.kind == "quiz":
            await close_question(room)
        elif t == "next" and room.kind == "quiz" and room.state == "res":
            await open_question(room)
        elif t == "clear" and room.kind == "cloud":
            room.words.clear()
            for p in room.players.values():
                p["words"] = 0
            room.dirty = True
            await to_all(room, {"t": "cleared"})
        elif t == "lock" and room.kind == "cloud":
            room.state = "closed" if room.state == "open" else "open"
            await to_all(room, {"t": "state", "state": room.state})
        elif t == "close":
            await to_all(room, {"t": "closed"}, host=False)
            if room.timer:
                room.timer.cancel()
            if room.cloud_task:
                room.cloud_task.cancel()
            ROOMS.pop(room.code, None)
        return
    p = room.players.get(ws)
    if not p:
        return
    if t == "a" and room.kind == "quiz" and room.state == "q" and p["ans"] is None:
        try:
            i, k = int(d.get("i")), int(d.get("k"))
        except Exception:
            return
        if i != room.i or not 0 <= k < 4:
            return
        q = room.qs[room.i]
        if guard() and time.time() - room.t0 < MIN_ANSWER_SEC:
            p["strikes"] = p.get("strikes", 0) + 1
            room.fp_strikes[p.get("fp", "")] = room.fp_strikes.get(p.get("fp", ""), 0) + 1
            if p["strikes"] >= 3:
                room.banned.add(p["nick"].lower())
                await send(ws, {"t": "err", "m": "Ай-ай-ай! Ответы быстрее человека. Ты заблокирован в этой игре."})
                await send(room.host, {"t": "err", "m": "Заблокирован за бота: " + p["nick"]})
                await ws.close()
            else:
                await send(ws, {"t": "err", "m": "Ай-ай-ай! Слишком быстро, так отвечает бот. Предупреждение %d из 3." % p["strikes"]})
            return
        left = max(0.0, q["sec"] - (time.time() - room.t0))
        gain = int(500 + 500 * left / q["sec"]) if k == q["a"] else 0
        p["ans"] = (k, gain)
        if k == q["a"]:
            p["score"] += gain
        await send(ws, {"t": "got"})
        await send(room.host, {"t": "cnt", "n": sum(1 for x in room.players.values() if x["ans"] is not None), "of": len(room.players)})
        if all(x["ans"] is not None for x in room.players.values()):
            await close_question(room)
    elif t == "w" and room.kind == "cloud" and room.state == "open":
        ws_list = d.get("words")
        if not isinstance(ws_list, list):
            return
        added = 0
        for w in ws_list[:5]:
            w = clean_word(w)
            if not w or p["words"] >= 5:
                continue
            s = room.words.setdefault(w, set())
            if p["nick"] not in s:
                s.add(p["nick"])
                p["words"] += 1
                added += 1
        if added:
            room.dirty = True
        await send(ws, {"t": "wok", "left": 5 - p["words"], "added": added})


# ---------------------------------------------------------------- почта и восстановление пароля
def mail_ready():
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def _send_sync(to, subject, text):
    m = EmailMessage()
    m["From"], m["To"], m["Subject"] = SMTP_FROM, to, subject
    m.set_content(text)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as sm:
        sm.starttls()
        sm.login(SMTP_USER, SMTP_PASS)
        sm.send_message(m)


MAIL_LOG = []          # (время, адрес) отправленных писем: нужно, чтобы не заспамить почту и не получить бан от почтовика
MAIL_PER_10MIN, MAIL_PER_HOUR, MAIL_TO_ONE_10MIN = 6, 20, 2
TEACHER_GAP = 600      # учителю уведомления уходят не чаще, чем раз в 10 минут (накопленное одним письмом)
_teacher = {"last": 0.0, "pending": [], "task": None}


def mail_allowed(to, now=None):
    now = now or time.time()
    MAIL_LOG[:] = [m for m in MAIL_LOG if now - m[0] < 3600]
    ten = [m for m in MAIL_LOG if now - m[0] < 600]
    return len(ten) < MAIL_PER_10MIN and len(MAIL_LOG) < MAIL_PER_HOUR and sum(1 for m in ten if m[1] == to.lower()) < MAIL_TO_ONE_10MIN


async def send_mail(to, subject, text):
    """Отправляет письмо в фоне. Возвращает True, если письмо ушло. Без настроенной почты или при превышении лимита просто False."""
    if not mail_ready() or not to or not mail_allowed(to):
        return False
    MAIL_LOG.append((time.time(), to.lower()))
    try:
        await asyncio.get_running_loop().run_in_executor(None, _send_sync, to, subject, text)
        return True
    except Exception:
        return False


async def _flush_teacher():
    await asyncio.sleep(max(1, TEACHER_GAP - (time.time() - _teacher["last"])))
    lines, _teacher["pending"], _teacher["task"] = _teacher["pending"], [], None
    if lines:
        _teacher["last"] = time.time()
        await send_mail(TEACHER_EMAIL, "Python-курс: %d уведомл." % len(lines), "\n".join(lines[-30:]) + "\n\nПодробности в кабинете учителя.")


def notify_teacher(line):
    """Уведомление учителю на почту: не чаще раза в 10 минут, всё накопленное одним письмом."""
    if not (mail_ready() and TEACHER_EMAIL):
        return
    _teacher["pending"].append(line)
    if _teacher["task"] is None:
        if time.time() - _teacher["last"] >= TEACHER_GAP:
            _teacher["last"] = time.time()
            lines, _teacher["pending"] = _teacher["pending"], []
            asyncio.create_task(send_mail(TEACHER_EMAIL, "Python-курс: " + lines[0][:60], "\n".join(lines) + "\n\nПодробности в кабинете учителя."))
        else:
            _teacher["task"] = asyncio.create_task(_flush_teacher())


async def recover(req):
    """Шаг 1: ученик называет логин или почту. Всегда отвечаем одинаково, чтобы нельзя было узнать, есть ли такой ник."""
    ip = client_ip(req)
    if limited("rec:" + ip, 30, 3600):
        return jerr("Слишком много запросов. Попробуй позже.", 429)
    d = await body(req)
    who = clean_str(d.get("login"), 150)
    ans = {"ok": True, "mailer": mail_ready(), "msg": "Если такой ученик есть, код отправлен на его почту. Если письмо не приходит, назови логин учителю: он продиктует код."}
    if not who:
        return jerr("Впиши логин или почту.")
    row = db.execute("SELECT id,nick,email FROM users WHERE nick=? OR (email<>'' AND lower(email)=lower(?))", (who, who)).fetchone()
    if not row or limited("recu:%d" % row[0], 3, 3600):
        return web.json_response(ans)
    code = "%06d" % secrets.randbelow(10 ** 6)
    now = int(time.time())
    db.execute("DELETE FROM recov WHERE uid=?", (row[0],))
    db.execute("INSERT INTO recov(uid,ch,exp,ts,code) VALUES(?,?,?,?,?)", (row[0], th(code), now + 1800, now, code))
    mailed = await send_mail(row[2], "Код для восстановления пароля", "Привет, %s!\n\nКод для нового пароля: %s\nОн действует 30 минут. Если это был не ты, просто игнорируй письмо.\n" % (row[1], code))
    db.execute("UPDATE recov SET mailed=? WHERE uid=?", (1 if mailed else 0, row[0]))
    db.commit()
    notify_teacher("Забыт пароль: %s (письмо с кодом ученику %s). Код виден в кабинете, вкладка «Пароли»." % (row[1], "отправлено" if mailed else "НЕ отправлено, продиктуй код"))
    return web.json_response(ans)


async def recover_confirm(req):
    d = await body(req)
    nick, code, pw = str(d.get("nick", "")).strip(), str(d.get("code", "")).strip(), str(d.get("password", ""))
    if limited("recc:" + client_ip(req), 20, 3600):
        return jerr("Слишком много попыток. Попробуй позже.", 429)
    if len(pw) < 6 or len(pw) > 100:
        return jerr("Пароль: минимум 6 символов.")
    row = db.execute("SELECT u.id,u.nick,u.fio,u.grp,u.progress,r.id,r.ch,r.exp,r.tries FROM users u JOIN recov r ON r.uid=u.id WHERE u.nick=?", (nick,)).fetchone()
    if not row or row[7] < time.time() or row[8] >= 5:
        return jerr("Код не подошёл или устарел. Запроси новый.", 400)
    if not hmac.compare_digest(th(code), row[6]):
        db.execute("UPDATE recov SET tries=tries+1 WHERE id=?", (row[5],))
        db.commit()
        return jerr("Неверный код.", 400)
    salt = secrets.token_bytes(16)
    db.execute("UPDATE users SET salt=?, hash=? WHERE id=?", (salt, pw_hash(pw, salt), row[0]))
    db.execute("DELETE FROM sessions WHERE uid=?", (row[0],))
    db.execute("DELETE FROM recov WHERE uid=?", (row[0],))
    db.commit()
    for k in [k for k in FAILS if k == "n:" + nick.lower() or k.startswith("u:" + nick.lower() + "|")]:
        FAILS.pop(k, None)
    return web.json_response(session_for(row[0], row[1], row[2], row[3], row[4]))


async def t_recov(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    now = int(time.time())
    rows = db.execute("SELECT u.nick,u.fio,u.email,r.code,r.ts,r.exp,r.mailed FROM recov r JOIN users u ON u.id=r.uid ORDER BY r.ts DESC LIMIT 50").fetchall()
    return web.json_response({"ok": True, "mailer": mail_ready(), "rows": [{"nick": a, "fio": b, "email": c, "code": d if e + 1800 > now else "", "ts": e, "mailed": bool(g), "live": f > now} for a, b, c, d, e, f, g in rows]})


# ---------------------------------------------------------------- сдача заданий (вместо GitHub)
try:
    import check as CHK
    TASK_BY_ID = {t["id"]: t for t in CHK.load_tasks()}
except Exception:  # pragma: no cover
    CHK, TASK_BY_ID = None, {}
SUB_SEM = None
TASK_ID_RE = re.compile(r"^\d{1,2}\.\d{1,2}$")


def mark_progress(uid, task, passed):
    row = db.execute("SELECT progress FROM users WHERE id=?", (uid,)).fetchone()
    try:
        pr = json.loads(row[0] or "{}")
    except Exception:
        pr = {}
    new = {"done": {task: 1}}
    if passed:
        new["passed"] = {task: 1}
    pr = merge_progress(pr, new)
    db.execute("UPDATE users SET progress=?, updated=? WHERE id=?", (json.dumps(pr, ensure_ascii=False), int(time.time()), uid))


def _judge_task(task, code):
    work = tempfile.mkdtemp(prefix="sub_")
    try:
        path = os.path.join(work, "solution.py")
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)
        return CHK.check_task(task, file_override=path)
    finally:
        import shutil
        shutil.rmtree(work, ignore_errors=True)


async def submit(req):
    """Ученик сдаёт решение. Сервер сам проверяет код в песочнице, результат видит и ученик, и учитель."""
    global SUB_SEM
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    if CHK is None:
        return jerr("Проверка сейчас недоступна.", 503)
    d = await body(req)
    tid, code, meta = str(d.get("id", "")), d.get("code"), str(d.get("meta", ""))[:200]
    task = TASK_BY_ID.get(tid) if TASK_ID_RE.match(tid) else None
    if not task:
        return jerr("Такого задания нет.")
    if not isinstance(code, str) or not code.strip():
        return jerr("Код пустой.")
    if len(code) > 8000:
        return jerr("Код слишком длинный.")
    if limited("sub:%d" % u[0], 10, 60):
        return jerr("Не так быстро. Подожди минуту.", 429)
    if SUB_SEM is None:
        SUB_SEM = asyncio.Semaphore(3)
    async with SUB_SEM:
        res = await asyncio.get_running_loop().run_in_executor(None, _judge_task, task, code)
    status = res.get("status", "fail")
    msgs = [str(m)[:300] for m in res.get("messages", [])][:6]
    now = int(time.time())
    db.execute("INSERT INTO subs(uid,task,ts,status,msgs,code,meta) VALUES(?,?,?,?,?,?,?)", (u[0], tid, now, status, json.dumps(msgs, ensure_ascii=False), code, meta))
    db.execute("DELETE FROM subs WHERE uid=? AND task=? AND id NOT IN (SELECT id FROM subs WHERE uid=? AND task=? ORDER BY id DESC LIMIT 6)", (u[0], tid, u[0], tid))
    if status != "todo":
        mark_progress(u[0], tid, status == "ok")
    db.commit()
    return web.json_response({"ok": True, "verdict": status, "messages": msgs})


async def t_subs(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    rows = db.execute("SELECT s.id,u.nick,u.fio,u.grp,s.task,s.ts,s.status,s.msgs,s.meta FROM subs s JOIN users u ON u.id=s.uid ORDER BY s.id DESC LIMIT 300").fetchall()
    out = []
    for i, nick, fio, grp, task, ts, st, msgs, meta in rows:
        fl = R.meta_flags(meta) or {}
        why = [n for k, n in (("a", "бот"), ("d", "F12"), ("e", "правка из консоли"), ("p", "пытался вставить"), ("b", "вставка кусками")) if fl.get(k)]
        if not fl:
            why.append("без служебной метки")
        out.append({"id": i, "nick": nick, "fio": fio, "group": grp, "task": task, "ts": ts, "status": st, "msgs": json.loads(msgs or "[]"), "flags": why})
    return web.json_response({"ok": True, "rows": out})


async def t_sub(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    try:
        i = int(req.query.get("id", "0"))
    except Exception:
        return jerr("Неверный номер.")
    row = db.execute("SELECT code FROM subs WHERE id=?", (i,)).fetchone()
    return web.json_response({"ok": bool(row), "code": row[0] if row else ""})


# ---------------------------------------------------------------- рулетка «три черепа»
import random as _rnd
# Все настройки рулетки учитель меняет из кабинета (действие lucky_cfg); здесь только значения по умолчанию.
LCFG = {"odds": float(os.environ.get("LUCKY_ODDS", "0.25")),   # шанс трёх черепов при одном вращении
        "auto": True,                                           # сам выбирать случайного ученика
        "every_min": 3600, "every_max": 7200,                   # раз в 1–2 часа
        "window": 600}                                          # на рулетку 10 минут
ONLINE = {}                                                     # uid -> время последнего опроса (кто сейчас на сайте)
SYMS = ["skull", "bone", "coin", "heart", "star"]
LUCKY = {"next": time.time() + _rnd.uniform(3600, 7200)}        # когда сервер выберет следующего сам
LK = {}                                                         # uid -> {id, nick, until, spun, token, t0}: у скольких угодно учеников сразу
SCARES = {}                                                     # uid -> {id, kind}: скример, ждёт, когда ученик опросит сервер


def lucky_active(uid, now=None):
    now = now or time.time()
    e = LK.get(uid)
    return bool(e) and not e["spun"] and now < e["until"]


def lucky_grant(uid, nick, now=None):
    """Даёт ученику новую попытку рулетки. Ограничений на число попыток нет: учитель может повторять сколько угодно."""
    now = now or time.time()
    LK[uid] = {"id": int(now * 1000) + len(LK), "nick": nick, "until": now + LCFG["window"], "spun": False, "token": "", "t0": 0.0}


def online_uids(now=None):
    now = now or time.time()
    for u in [u for u, t in ONLINE.items() if now - t > 30]:
        ONLINE.pop(u, None)
    return list(ONLINE)


def lucky_pick(now=None, nick=None, count=1, everyone=False):
    """Выбирает учеников: по нику, случайных из тех, кто на сайте последние 30 секунд, или всех онлайн. Возвращает список ников."""
    now = now or time.time()
    if nick:
        row = db.execute("SELECT id FROM users WHERE nick=? COLLATE NOCASE", (nick,)).fetchone()
        cand = [row[0]] if row else []
    else:
        cand = online_uids(now)
        if not everyone:
            cand = _rnd.sample(cand, min(max(1, int(count)), len(cand)))
    out = []
    for uid in cand:
        row = db.execute("SELECT nick FROM users WHERE id=?", (uid,)).fetchone()
        if row:
            lucky_grant(uid, row[0], now)
            out.append(row[0])
    return out


def lucky_schedule(now=None):
    now = now or time.time()
    lo, hi = sorted((max(60, int(LCFG["every_min"])), max(60, int(LCFG["every_max"]))))
    LUCKY["next"] = now + _rnd.uniform(lo, hi)


def lucky_tick(now=None):
    now = now or time.time()
    if LCFG["auto"] and now >= LUCKY["next"]:
        if lucky_pick(now):
            lucky_schedule(now)
        else:
            LUCKY["next"] = now + 120          # никого нет на сайте: попробуем через две минуты


async def lucky_spin(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    now = time.time()
    if not lucky_active(u[0], now):
        return jerr("Рулетка сейчас не для тебя.", 403)
    e = LK[u[0]]
    e["spun"] = True
    win = _rnd.random() < LCFG["odds"]
    if win:
        reels = ["skull"] * 3
        e["token"], e["t0"] = secrets.token_urlsafe(16), now
    else:
        reels = [_rnd.choice(SYMS) for _ in range(3)]
        while reels == ["skull"] * 3 or (reels[0] == reels[1] == reels[2]):
            reels = [_rnd.choice(SYMS) for _ in range(3)]
        db.execute("INSERT INTO lucky(uid,ts,kind,note) VALUES(?,?,?,?)", (u[0], int(now), "no-skulls", ""))
        db.commit()
    return web.json_response({"ok": True, "reels": reels, "win": win, "token": e["token"]})


async def lucky_finish(req):
    """Игра закончена: победа даёт «красную пятёрку», проигрыш сжигает оценку. Попытка одна: токен гасится сразу."""
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    d = await body(req)
    now = time.time()
    e = LK.get(u[0])
    if not e or not e["token"] or not hmac.compare_digest(str(d.get("token", "")), e["token"]):
        return jerr("Попытки нет.", 403)
    e["token"] = ""
    took = now - e["t0"]
    won = bool(d.get("win")) and took >= 12          # быстрее 12 секунд дойти до верха нельзя: значит, подделка
    db.execute("INSERT INTO lucky(uid,ts,kind,note) VALUES(?,?,?,?)", (u[0], int(now), "five" if won else "burned", "%ds" % took))
    db.commit()
    if won:
        notify_teacher("Красная пятёрка: %s прошёл игру за %d с." % (u[1], took))
    return web.json_response({"ok": True, "five": won, "nick": u[1], "ts": int(now)})


async def t_lucky(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    now = time.time()
    rows = db.execute("SELECT u.nick,u.fio,l.ts,l.kind,l.note FROM lucky l JOIN users u ON u.id=l.uid ORDER BY l.id DESC LIMIT 100").fetchall()
    cur = [e["nick"] for u, e in LK.items() if lucky_active(u, now)]
    return web.json_response({"ok": True, "online": len(online_uids(now)), "cur": ", ".join(cur), "active": cur, "cfg": LCFG, "next_in": max(0, int(LUCKY["next"] - now)), "scare": dict(SCFG, next_in=max(0, int(SCARE["next"] - now))),
                              "rows": [{"nick": a, "fio": b, "ts": c, "kind": k, "note": n} for a, b, c, k, n in rows]})


def _num(v, lo, hi, default):
    try:
        x = float(v)
    except Exception:
        return default
    return max(lo, min(hi, x))


def lucky_set_cfg(d):
    """Меняет настройки рулетки из кабинета. Всё, что не прислано, остаётся как было."""
    if "odds" in d:
        LCFG["odds"] = _num(d["odds"], 0.0, 1.0, LCFG["odds"])
    if "auto" in d:
        LCFG["auto"] = bool(d["auto"])
    if "every_min" in d:
        LCFG["every_min"] = int(_num(d["every_min"], 60, 86400, LCFG["every_min"]))
    if "every_max" in d:
        LCFG["every_max"] = int(_num(d["every_max"], 60, 86400, LCFG["every_max"]))
    if "window" in d:
        LCFG["window"] = int(_num(d["window"], 30, 7200, LCFG["window"]))
    lucky_schedule()


# ---------------------------------------------------------------- скример (шутка учителя)
SCARE_KINDS = ("skull",)


# Сам по себе скример выдаётся случайному ученику из онлайн в случайный момент (настройки меняются в кабинете).
SCFG = {"auto": True, "every_min": 900, "every_max": 2700}        # по умолчанию раз в 15–45 минут
SCARE = {"next": time.time() + _rnd.uniform(900, 2700)}


def scare_schedule(now=None):
    now = now or time.time()
    lo, hi = sorted((max(30, int(SCFG["every_min"])), max(30, int(SCFG["every_max"]))))
    SCARE["next"] = now + _rnd.uniform(lo, hi)


def scare_tick(now=None):
    now = now or time.time()
    if SCFG["auto"] and now >= SCARE["next"]:
        if scare_send(None, "random", now):
            scare_schedule(now)
        else:
            SCARE["next"] = now + 60           # на сайте никого нет: попробуем через минуту


def scare_set_cfg(d):
    if "auto" in d:
        SCFG["auto"] = bool(d["auto"])
    if "every_min" in d:
        SCFG["every_min"] = int(_num(d["every_min"], 30, 86400, SCFG["every_min"]))
    if "every_max" in d:
        SCFG["every_max"] = int(_num(d["every_max"], 30, 86400, SCFG["every_max"]))
    scare_schedule()


def scare_send(nick=None, kind="random", now=None):
    """Ставит скример одному ученику: по нику или случайному из онлайн. Возвращает ник или ''."""
    now = now or time.time()
    if nick:
        row = db.execute("SELECT id,nick FROM users WHERE nick=? COLLATE NOCASE", (nick,)).fetchone()
    else:
        c = online_uids(now)
        row = db.execute("SELECT id,nick FROM users WHERE id=?", (_rnd.choice(c),)).fetchone() if c else None
    if not row:
        return ""
    k = "thanks" if kind == "thanks" else "skull"
    SCARES[row[0]] = {"id": int(now * 1000), "kind": k}
    return row[1]


def thanks_all(now=None):
    """«Спасибо за урок»: каждому ученику, который сейчас на сайте, выскакивает скелет с большим сердцем. Возвращает число учеников."""
    now = now or time.time()
    c = online_uids(now)
    for uid in c:
        SCARES[uid] = {"id": int(now * 1000), "kind": "thanks"}
    return len(c)


# ---------------------------------------------------------------- таблицы лидеров
# game -> (название, лучше меньше или больше, подпись, границы правдоподобия для игр, где счёт присылает браузер, или None для серверных)
BOARDS = {
    "mines": ("Сапёр", "asc", "с", (5, 3600)),
    "snake": ("Змейка", "desc", "очк.", (1, 397)),
    "runner": ("Бегун", "desc", "очк.", (1, 100000)),
    "maze": ("Лабиринт", "desc", "очк.", (1, 500)),
    "barrels": ("Скелет и бочки (тренировка)", "asc", "с", (12, 75)),
    "skull": ("Убеги от скелета", "asc", "с", (10, 3600)),
    "chick": ("Пернатый бой", "desc", "очк.", (10, 200000)),
    "dungeon": ("Подземелье багов", "desc", "очк.", (50, 20000)),
    "race": ("Гонка по Python", "asc", "с", None),
    "boss": ("Босс-арена: урон за бой", "desc", "урона", None),
}


def score_record(uid, game, val, now=None):
    """Запоминает лучший результат ученика в игре. Возвращает True, если это новый личный рекорд."""
    b = BOARDS.get(game)
    if not b:
        return False
    now = int(now or time.time())
    row = db.execute("SELECT best FROM scores WHERE uid=? AND game=?", (uid, game)).fetchone()
    better = row is None or (val < row[0] if b[1] == "asc" else val > row[0])
    if better:
        db.execute("INSERT INTO scores(uid,game,best,ts) VALUES(?,?,?,?) ON CONFLICT(uid,game) DO UPDATE SET best=excluded.best, ts=excluded.ts", (uid, game, float(val), now))
        db.commit()
    return better


def board_rows(game, uid=None, limit=10):
    b = BOARDS[game]
    order = "ASC" if b[1] == "asc" else "DESC"
    rows = db.execute("SELECT s.uid,u.nick,s.best FROM scores s JOIN users u ON u.id=s.uid WHERE s.game=? ORDER BY s.best %s, s.ts ASC LIMIT ?" % order, (game, limit)).fetchall()
    out = [{"rank": i + 1, "nick": n, "score": round(v, 1) if v != int(v) else int(v), "me": u == uid} for i, (u, n, v) in enumerate(rows)]
    me = None
    if uid is not None:
        r = db.execute("SELECT best FROM scores WHERE uid=? AND game=?", (uid, game)).fetchone()
        if r:
            cmp = "<" if b[1] == "asc" else ">"
            rank = db.execute("SELECT COUNT(*) FROM scores WHERE game=? AND best %s ?" % cmp, (game, r[0])).fetchone()[0] + 1
            me = {"rank": rank, "score": round(r[0], 1) if r[0] != int(r[0]) else int(r[0])}
    return {"game": game, "title": b[0], "unit": b[2], "better": b[1], "rows": out, "me": me}


async def score_post(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    if limited("score:%d" % u[0], 40, 60):
        return jerr("Слишком часто.", 429)
    d = await body(req)
    g = str(d.get("game", ""))
    b = BOARDS.get(g)
    if not b or not b[3]:
        return jerr("Для этой игры результат не принимается.")
    try:
        v = float(d.get("score"))
    except Exception:
        return jerr("Неверный результат.")
    lo, hi = b[3]
    if not (lo <= v <= hi) or v != v:
        return web.json_response({"ok": True, "record": False, "ignored": True})   # нереальный результат молча не засчитываем
    return web.json_response({"ok": True, "record": score_record(u[0], g, v)})


async def leaderboards(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти, чтобы видеть таблицы лидеров.", 401)
    game = req.query.get("game")
    if game:
        if game not in BOARDS:
            return jerr("Такой игры нет.")
        return web.json_response({"ok": True, **board_rows(game, u[0], 20)})
    return web.json_response({"ok": True, "boards": [board_rows(g, u[0], 10) for g in BOARDS]})


def boss_record():
    """Когда бой кончился, лучший урон каждого игрока попадает в таблицу лидеров (один раз за бой)."""
    if BOSS.phase == "end" and not BOSS.recorded:
        BOSS.recorded = True
        for uid, p in BOSS.players.items():
            if p["dmg"] > 0:
                score_record(uid, "boss", p["dmg"])


# ---------------------------------------------------------------- гонка
RACE = R.Race()
BOSS = B.Boss()
JUDGE_SEM = None


async def play_state(req):
    """Дешёвый публичный запрос: ученики опрашивают его раз в несколько секунд, чтобы узнать, не началась ли игра."""
    RACE.tick()
    BOSS.tick()
    if BOSS.phase in ("intro", "lobby", "run"):
        out = {"ok": True, "game": "boss", "id": BOSS.id, "phase": BOSS.phase, "intro": max(0, int(BOSS.intro_end - time.time() + .999)) if BOSS.phase == "intro" else 0, "n": len(BOSS.players), "t": int(time.time() * 1000)}
    else:
        out = {"ok": True, "game": "race", "id": RACE.id, "phase": RACE.phase, "intro": max(0, int(RACE.intro_end - time.time() + .999)) if RACE.phase == "intro" else 0, "n": len(RACE.players), "t": int(time.time() * 1000)}
    u = user_from(req) if req.headers.get("Authorization") else None
    if u:
        ONLINE[u[0]] = time.time()
        lucky_tick()
        scare_tick()
        if lucky_active(u[0]):
            e = LK[u[0]]
            out["lucky"] = {"id": e["id"], "left": int(e["until"] - time.time())}
        sc = SCARES.pop(u[0], None)
        if sc:
            out["scare"] = sc
    resp = web.json_response(out)
    resp.headers["Cache-Control"] = "no-store"
    return resp


async def t_play(req):
    if not teacher_ok(req):
        return jerr("Нужен ключ учителя.", 403)
    d = await body(req)
    a = d.get("action")
    if a == "boss_announce":
        RACE.reset()
        BOSS.announce()
        return web.json_response(BOSS.view())
    elif a == "boss_start":
        if not BOSS.start(d):
            return jerr("Сначала нажми «Запустить арену».")
        return web.json_response(BOSS.view())
    elif a == "boss_cfg":
        BOSS.edit(d)
        boss_record()
        return web.json_response(BOSS.view())
    elif a == "boss_stop":
        BOSS.stop()
        boss_record()
        return web.json_response(BOSS.view())
    elif a == "boss_reset":
        BOSS.reset()
        return web.json_response(BOSS.view())
    elif a == "boss_kick":
        if not BOSS.kick(d.get("nick", "")):
            return jerr("Такого игрока нет.")
        return web.json_response(BOSS.view())
    elif a == "boss_state":
        return web.json_response(BOSS.view())
    elif a == "announce":
        BOSS.reset()
        RACE.announce()
    elif a == "start":
        RACE.tick()
        if not RACE.start():
            return jerr("Сначала нажми «Давайте поиграем».")
    elif a == "stop":
        RACE.stop()
    elif a == "reset":
        RACE.reset()
    elif a == "lucky":
        nick = str(d.get("nick", "")).strip() or None
        who = lucky_pick(nick=nick, count=int(_num(d.get("count", 1), 1, 150, 1)), everyone=bool(d.get("everyone")))
        if not who:
            return jerr("Такого ученика нет." if nick else "Сейчас на сайте нет вошедших учеников.")
        out = RACE.view(); out["lucky_nick"] = ", ".join(who); out["lucky_nicks"] = who
        return web.json_response(out)
    elif a == "lucky_reset":
        LK.clear()
        if d.get("history"):
            db.execute("DELETE FROM lucky")
            db.commit()
        lucky_schedule()
        return web.json_response({"ok": True})
    elif a == "lucky_cfg":
        lucky_set_cfg(d)
        return web.json_response({"ok": True, "cfg": LCFG})
    elif a == "scare_cfg":
        scare_set_cfg(d)
        return web.json_response({"ok": True, "scare": SCFG})
    elif a == "thanks":
        n = thanks_all()
        if not n:
            return jerr("Сейчас на сайте нет вошедших учеников.")
        return web.json_response({"ok": True, "count": n})
    elif a == "scare":
        who = scare_send(str(d.get("nick", "")).strip() or None, str(d.get("kind", "random")))
        if not who:
            return jerr("Такого ученика нет." if d.get("nick") else "Сейчас на сайте нет вошедших учеников.")
        return web.json_response({"ok": True, "scare_nick": who})
    elif a == "kick":
        if not RACE.kick(d.get("nick", "")):
            return jerr("Такого игрока нет.")
    else:
        return jerr("Неизвестное действие.")
    return web.json_response(RACE.view())


# ---------------------------------------------------------------- босс-арена
def _i(x):
    try:
        return int(x or 0)
    except Exception:
        return 0


async def boss_join(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти или зарегистрироваться.", 401)
    e = BOSS.join(u[0], u[1])
    if e:
        return jerr(e)
    return web.json_response(BOSS.view(u[0]))


async def boss_state(req):
    u = user_from(req) if req.headers.get("Authorization") else None
    try:
        since = int(req.query.get("since", "0"))
    except Exception:
        since = 0
    if u:
        ONLINE[u[0]] = time.time()
    resp = web.json_response(BOSS.view(u[0] if u else None, since))
    resp.headers["Cache-Control"] = "no-store"
    return resp


async def boss_ask(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    d = await body(req)
    q, err = BOSS.ask(u[0], str(d.get("lvl", "")))
    if err:
        return jerr(err)
    return web.json_response({"ok": True, "q": q, **BOSS.view(u[0], _i(d.get("since")))})


async def boss_answer(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    d = await body(req)
    r = BOSS.answer(u[0], d.get("a"))
    boss_record()
    return web.json_response({**BOSS.view(u[0], _i(d.get("since"))), **r})


async def race_join(req):
    u = user_from(req)
    if not u:
        return jerr("Нужно войти или зарегистрироваться.", 401)
    RACE.tick()
    e = RACE.join(u[0], u[1])
    if e:
        return jerr(e, 409)
    return web.json_response(RACE.view(u[0]))


async def race_state(req):
    u = user_from(req)
    resp = web.json_response(RACE.view(u[0] if u else None))
    resp.headers["Cache-Control"] = "no-store"
    return resp


async def race_submit(req):
    global JUDGE_SEM
    u = user_from(req)
    if not u:
        return jerr("Нужно войти.", 401)
    d = await body(req)
    try:
        i = int(d.get("i"))
    except Exception:
        return jerr("Неверная задача.")
    code = d.get("code")
    RACE.tick()
    e = RACE.submit_precheck(u[0], i, code, d.get("meta"))
    if e:
        return web.json_response({"ok": True, "passed": False, "msg": e, **RACE.view(u[0])})
    if JUDGE_SEM is None:
        JUDGE_SEM = asyncio.Semaphore(3)
    async with JUDGE_SEM:
        ok, msg = await asyncio.get_running_loop().run_in_executor(None, R.judge, i, code)
    # за время проверки игра могла закончиться или игрока могли исключить
    if ok and RACE.phase == "run" and u[0] in RACE.players and RACE.players[u[0]]["done"] == i:
        RACE.accepted(u[0])
        pl = RACE.players.get(u[0])
        if pl and pl.get("fin") is not None:
            score_record(u[0], "race", pl["fin"])
    elif ok:
        ok, msg = False, "Игра уже закончилась."
    return web.json_response({"ok": True, "passed": ok, "msg": msg, **RACE.view(u[0])})


def teacher_ok_key(k):
    return tkey_valid(k)


async def janitor(app):
    async def run():
        while True:
            await asyncio.sleep(120)
            now = time.time()
            for c, r in list(ROOMS.items()):
                if now - r.touched > 3 * 3600:
                    ROOMS.pop(c, None)
            for k in [k for k, v in HITS.items() if not v or now - v[-1] > 3600]:
                HITS.pop(k, None)
            for k in [k for k, v in FAILS.items() if now - v[2] > FAIL_FORGET]:
                FAILS.pop(k, None)
            db.execute("DELETE FROM sessions WHERE created<?", (int(now) - 90 * 86400,))
            db.commit()
    task = asyncio.create_task(run())
    yield
    task.cancel()


def make_app():
    init_db()
    app = web.Application(middlewares=[cors], client_max_size=64 * 1024)
    app.add_routes([
        web.post("/api/teacher/login", t_login), web.get("/api/ping", ping), web.post("/api/register", register), web.post("/api/login", login), web.post("/api/logout", logout),
        web.post("/api/recover", recover), web.post("/api/recover/confirm", recover_confirm), web.get("/api/teacher/recov", t_recov), web.post("/api/submit", submit), web.get("/api/teacher/subs", t_subs), web.get("/api/teacher/sub", t_sub),
        web.get("/api/play", play_state), web.post("/api/lucky/spin", lucky_spin), web.post("/api/lucky/finish", lucky_finish), web.get("/api/teacher/lucky", t_lucky), web.post("/api/teacher/play", t_play), web.post("/api/race/join", race_join), web.post("/api/boss/join", boss_join), web.post("/api/score", score_post), web.get("/api/leaderboards", leaderboards), web.get("/api/boss/state", boss_state), web.post("/api/boss/ask", boss_ask), web.post("/api/boss/answer", boss_answer), web.get("/api/race/state", race_state), web.post("/api/race/submit", race_submit),
        web.get("/api/me", me), web.put("/api/progress", put_progress),
        web.get("/api/teacher/check", t_check), web.get("/api/teacher/users", t_users), web.post("/api/teacher/reset", t_reset), web.delete("/api/teacher/user", t_delete),
        web.get("/ws", ws_handler),
        web.route("OPTIONS", "/{tail:.*}", ping),
    ])
    app.cleanup_ctx.append(janitor)
    return app


if __name__ == "__main__":
    if not TEACHER_KEY or len(TEACHER_KEY) < 8:
        raise SystemExit("Задай TEACHER_KEY (минимум 8 символов) в окружении.")
    web.run_app(make_app(), host="127.0.0.1", port=PORT, access_log=None)
