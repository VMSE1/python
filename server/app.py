"""Сервер курса: регистрация, прогресс, живые викторины и облако слов.
Один процесс на aiohttp. База: SQLite (файл). Пароли: scrypt с солью. Запуск: см. documentation/13-server.md"""
import asyncio
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time

from aiohttp import web, WSMsgType

DB_PATH = os.environ.get("DB_PATH", "data.sqlite")
TEACHER_KEY = os.environ.get("TEACHER_KEY", "")
ORIGINS = [o.strip() for o in os.environ.get("ALLOW_ORIGINS", "https://vmse1.github.io,http://127.0.0.1:8000,http://localhost:8000").split(",") if o.strip()]
PORT = int(os.environ.get("PORT", "8080"))
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
    """)
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


FAILS = {}  # ник -> (число, до какого времени блок)


def client_ip(req):
    return req.headers.get("X-Forwarded-For", req.remote or "?").split(",")[0].strip()


def jerr(msg, status=400):
    return web.json_response({"ok": False, "error": msg}, status=status)


def teacher_ok(req):
    k = req.headers.get("X-Teacher-Key", "")
    return bool(TEACHER_KEY) and hmac.compare_digest(k.encode(), TEACHER_KEY.encode())


def user_from(req):
    h = req.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        return None
    row = db.execute("SELECT u.id,u.nick,u.fio,u.grp,u.progress FROM sessions s JOIN users u ON u.id=s.uid WHERE s.th=?", (th(h[7:]),)).fetchone()
    return row


def clean_str(v, n):
    return " ".join(str(v or "").split())[:n]


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
    return web.json_response({"ok": True, "t": int(time.time())})


async def register(req):
    ip = client_ip(req)
    if limited("reg:" + ip, 15, 3600):
        return jerr("Слишком много регистраций с этого адреса. Попробуй позже.", 429)
    d = await body(req)
    nick, fio, grp, pw = str(d.get("nick", "")).strip(), clean_str(d.get("fio"), 60), clean_str(d.get("group"), 12), str(d.get("password", ""))
    if not NICK_RE.match(nick):
        return jerr("Ник: 3–20 символов, буквы, цифры, точка, дефис или подчёркивание.")
    if len(fio) < 3:
        return jerr("Впиши фамилию и имя.")
    if not grp:
        return jerr("Впиши группу (например 9А) или «нет».")
    if len(pw) < 6 or len(pw) > 100:
        return jerr("Пароль: минимум 6 символов.")
    salt = secrets.token_bytes(16)
    try:
        now = int(time.time())
        cur = db.execute("INSERT INTO users(nick,fio,grp,salt,hash,created,updated) VALUES(?,?,?,?,?,?,?)", (nick, fio, grp, salt, pw_hash(pw, salt), now, now))
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
    if limited("login:" + ip, 40, 600):
        return jerr("Слишком много попыток. Подожди несколько минут.", 429)
    f = FAILS.get(nick.lower())
    if f and f[1] > time.time():
        return jerr("Слишком много неверных паролей. Подожди 5 минут.", 429)
    row = db.execute("SELECT id,nick,fio,grp,salt,hash,progress FROM users WHERE nick=?", (nick,)).fetchone()
    ok = bool(row) and hmac.compare_digest(pw_hash(pw, row[4]), row[5])
    if not ok:
        n = (f[0] if f else 0) + 1
        FAILS[nick.lower()] = (n, time.time() + 300 if n >= 6 else 0)
        return jerr("Неверный ник или пароль.", 401)
    FAILS.pop(nick.lower(), None)
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
    merged = merge_progress(old, new)
    db.execute("UPDATE users SET progress=?, updated=? WHERE id=?", (json.dumps(merged, ensure_ascii=False), int(time.time()), u[0]))
    db.commit()
    return web.json_response({"ok": True, "progress": merged})


async def t_users(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    rows = db.execute("SELECT nick,fio,grp,created,updated,progress FROM users ORDER BY grp,fio").fetchall()
    out = []
    for nick, fio, grp, cr, up, pr in rows:
        try:
            p = json.loads(pr or "{}")
        except Exception:
            p = {}
        out.append({"nick": nick, "fio": fio, "group": grp, "created": cr, "updated": up,
                    "passed": sorted((p.get("passed") or {}).keys()), "done": sorted((p.get("done") or {}).keys()),
                    "streak": (p.get("streak") or {}).get("n", 0)})
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
    FAILS.pop(nick.lower(), None)
    return web.json_response({"ok": cur.rowcount > 0}) if cur.rowcount else jerr("Такого ника нет.", 404)


async def t_delete(req):
    if not teacher_ok(req):
        return jerr("Нет доступа.", 403)
    nick = req.query.get("nick", "")
    db.execute("DELETE FROM sessions WHERE uid IN (SELECT id FROM users WHERE nick=?)", (nick,))
    cur = db.execute("DELETE FROM users WHERE nick=?", (nick,))
    db.commit()
    return web.json_response({"ok": cur.rowcount > 0})


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
        if any(p["nick"].lower() == nick.lower() for p in r.players.values()):
            await send(ws, {"t": "err", "m": "Такой ник уже есть в комнате. Добавь цифру."})
            return
        r.players[ws] = {"nick": nick, "score": 0, "ans": None, "words": 0}
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


def teacher_ok_key(k):
    return bool(TEACHER_KEY) and hmac.compare_digest(str(k or "").encode(), TEACHER_KEY.encode())


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
            db.execute("DELETE FROM sessions WHERE created<?", (int(now) - 90 * 86400,))
            db.commit()
    task = asyncio.create_task(run())
    yield
    task.cancel()


def make_app():
    init_db()
    app = web.Application(middlewares=[cors], client_max_size=64 * 1024)
    app.add_routes([
        web.get("/api/ping", ping), web.post("/api/register", register), web.post("/api/login", login), web.post("/api/logout", logout),
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
