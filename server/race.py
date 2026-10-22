"""Гонка по Python: 5 задач, учитель запускает, сервер сам проверяет код.
Логика без aiohttp, чтобы её можно было проверять обычными тестами."""
import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.append(ROOT)
try:
    import check as CHK  # песочница и мягкое сравнение вывода из check.py (тот же код, что у робота на GitHub)
except Exception:  # pragma: no cover
    CHK = None

TOTAL = 5
INTRO_SEC = 6          # экран «Давайте поиграем» у всех
MAX_PLAYERS = 150
MAX_CODE = 2000
WIN_PLACES = 3         # призовые места
END_AFTER = 5          # гонка сама заканчивается, когда финишировали столько человек
MIN_GAP = 4.0          # не чаще одной отправки в 4 секунды
TYPE_RATE = 14.0       # быстрее 14 символов в секунду код не набрать: быстрее значит вставка/скрипт

# Первые две темы курса: ввод/вывод и числа, условия.
TASKS = [
    {"title": "Привет", "text": "Спроси имя через input() и выведи одну строку: Привет, <имя>!",
     "cases": [(["Анна"], "Привет, Анна!", []), (["Илья"], "Привет, Илья!", [])]},
    {"title": "Сумма", "text": "Введи два целых числа (каждое на своей строке) и выведи их сумму.",
     "cases": [(["7", "5"], "12", []), (["40", "2"], "42", []), (["-3", "10"], "7", [])]},
    {"title": "Периметр квадрата", "text": "Введи длину стороны квадрата и выведи его периметр.",
     "cases": [(["5"], "20", []), (["12"], "48", []), (["1"], "4", [])]},
    {"title": "Чётное или нет", "text": "Введи целое число. Выведи «Чётное» или «Нечётное».",
     "cases": [(["4"], "Чётное", ["нечётное"]), (["7"], "Нечётное", []), (["0"], "Чётное", ["нечётное"]), (["13"], "Нечётное", [])]},
    {"title": "Оценка", "text": "Введи баллы (0–100). От 85 это 5, от 70 это 4, от 50 это 3, иначе 2. Выведи только оценку.",
     "cases": [(["90"], "5", []), (["85"], "5", []), (["75"], "4", []), (["70"], "4", []), (["50"], "3", []), (["49"], "2", []), (["0"], "2", [])]},
]
assert len(TASKS) == TOTAL


def task_view(i):
    t = TASKS[i]
    ins, out, _ = t["cases"][0]
    return {"i": i, "n": TOTAL, "title": t["title"], "text": t["text"], "ex_in": "\n".join(ins), "ex_out": out}


def _line_ok(out, want, mustnot):
    lines = [ln for ln in str(out).splitlines() if ln.strip()]
    if not lines:
        return False
    line, w = CHK.canon(lines[-1]), CHK.canon(want)
    if not line.endswith(w) or any(line.endswith(CHK.canon(m)) for m in mustnot):
        return False
    if w[:1].isdigit() or w[:1] == "-":
        before = line[:-len(w)]
        if before[-1:].isdigit():
            return False
    return True


def judge(i, code):
    """Запускает код ученика в песочнице на тестах задачи i. Возвращает (ok, сообщение). Блокирующая функция."""
    if CHK is None:
        return False, "Проверка сейчас недоступна."
    if not isinstance(code, str) or not code.strip():
        return False, "Код пустой."
    if len(code) > MAX_CODE:
        return False, "Код слишком длинный."
    work = tempfile.mkdtemp(prefix="race_")
    try:
        path = os.path.join(work, "sol.py")
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)
        for ins, want, mustnot in TASKS[i]["cases"]:
            out, err, wd = CHK.run_program(path, ins)
            shutil.rmtree(wd, ignore_errors=True)
            if out is None:
                return False, err
            if err and not out.strip():
                return False, "Ошибка: " + err[:160]
            if not _line_ok(out, want, mustnot):
                shown = "\n".join(ins)
                got = [ln for ln in out.splitlines() if ln.strip()]
                return False, "На входе «%s» ждали «%s», а получили «%s»." % (shown.replace("\n", " "), want, (got[-1] if got else "пусто")[:60])
        return True, "Верно!"
    finally:
        shutil.rmtree(work, ignore_errors=True)


def meta_flags(m):
    """Служебная строка «честного ввода» (см. docs/honest.js): v1;t=..;p=..;e=..;a=1;d=1;h=.. Возвращает словарь."""
    out = {}
    if not isinstance(m, str) or not m.startswith("v1;"):
        return None
    for part in m.split(";")[1:]:
        kv = part.split("=")
        if len(kv) == 2 and kv[0] in "tpbeshad" and len(kv[0]) == 1:
            out[kv[0]] = kv[1][:8] if kv[0] == "h" else int(kv[1]) if kv[1].isdigit() else 0
    return out


class Race:
    def __init__(self):
        self.reset()

    def reset(self):
        self.id = 0
        self.phase = "idle"       # idle | intro | lobby | run | end
        self.intro_end = 0.0
        self.t0 = 0.0
        self.players = {}         # uid -> dict(nick, done, shown, last, fin, times, bad)
        self.finish = []          # uid в порядке финиша
        self.banned = set()

    # --- фазы
    def tick(self, now=None):
        now = now or time.time()
        if self.phase == "intro" and now >= self.intro_end:
            self.phase = "lobby"
        return self.phase

    def announce(self, now=None):
        now = now or time.time()
        nid = max(self.id + 1, int(now * 1000))
        self.reset()
        self.id, self.phase, self.intro_end = nid, "intro", now + INTRO_SEC

    def start(self, now=None):
        now = now or time.time()
        if self.phase not in ("intro", "lobby"):
            return False
        self.phase, self.t0 = "run", now
        for p in self.players.values():
            p["shown"] = now
        return True

    def stop(self):
        if self.phase in ("run", "lobby", "intro"):
            self.phase = "end"

    # --- игроки
    def join(self, uid, nick, now=None):
        now = now or time.time()
        if self.phase not in ("intro", "lobby", "run"):
            return "Игра не идёт."
        if uid in self.banned:
            return "Тебя исключили из этой игры."
        if uid not in self.players:
            if len(self.players) >= MAX_PLAYERS:
                return "В игре нет мест."
            self.players[uid] = {"nick": nick, "done": 0, "shown": self.t0 if self.phase == "run" and self.t0 else now, "last": 0.0, "fin": None, "times": [], "bad": 0}
            if self.phase == "run":
                self.players[uid]["shown"] = now
        return ""

    def kick(self, nick):
        for uid, p in list(self.players.items()):
            if p["nick"].lower() == str(nick).lower():
                self.banned.add(uid)
                del self.players[uid]
                if uid in self.finish:
                    self.finish.remove(uid)
                    for k, u in enumerate(self.finish):
                        self.players[u]["place"] = k + 1
                return True
        return False

    def submit_precheck(self, uid, i, code, meta, now=None):
        """Проверки до запуска кода. Возвращает текст ошибки или ''."""
        now = now or time.time()
        if self.phase != "run":
            return "Гонка сейчас не идёт."
        p = self.players.get(uid)
        if not p:
            return "Сначала войди в игру."
        if p["fin"] is not None:
            return "Ты уже финишировал."
        if i != p["done"]:
            return "Сейчас другая задача."
        if now - p["last"] < MIN_GAP:
            return "Не так быстро: подожди пару секунд."
        p["last"] = now
        if not isinstance(code, str) or not code.strip() or len(code) > MAX_CODE:
            return "Код пустой или слишком длинный."
        fl = meta_flags(meta)
        if fl is None:
            return "Код отправлен не через страницу гонки."
        if fl.get("a") or fl.get("d") or fl.get("e"):
            return "Ввод заблокирован защитой (бот, F12 или правка из консоли)."
        if len(code.strip()) > 20 and fl.get("t", 0) < len(code.strip()) * 0.6:
            return "Код не набран руками на странице."
        if now - p["shown"] < len(code) / TYPE_RATE:
            return "Слишком быстро для набора руками."
        return ""

    def accepted(self, uid, now=None):
        """Задача решена. Возвращает место, если игрок финишировал, иначе 0."""
        now = now or time.time()
        p = self.players[uid]
        p["times"].append(round(now - p["shown"], 1))
        p["done"] += 1
        p["shown"] = now
        if p["done"] >= TOTAL:
            p["fin"] = round(now - self.t0, 1)
            self.finish.append(uid)
            p["place"] = len(self.finish)
            if len(self.finish) >= END_AFTER:
                self.phase = "end"
            return p["place"]
        return 0

    # --- вид для клиентов
    def view(self, uid=None, now=None):
        now = now or time.time()
        self.tick(now)
        rows = sorted(self.players.items(), key=lambda kv: (-kv[1]["done"], kv[1]["fin"] if kv[1]["fin"] is not None else 1e9, kv[1]["nick"].lower()))
        v = {"ok": True, "id": self.id, "phase": self.phase, "total": TOTAL, "n": len(self.players), "intro": max(0, int(self.intro_end - now + .999)) if self.phase == "intro" else 0,
             "t": int(now * 1000), "elapsed": round(now - self.t0, 1) if self.phase in ("run", "end") and self.t0 else 0,
             "players": [{"nick": p["nick"], "done": p["done"], "fin": p["fin"], "me": u == uid} for u, p in rows[:60]],
             "winners": [{"nick": self.players[u]["nick"], "place": k + 1, "sec": self.players[u]["fin"]} for k, u in enumerate(self.finish) if u in self.players]}
        me = self.players.get(uid) if uid is not None else None
        v["me"] = {"joined": bool(me), "done": me["done"] if me else 0, "place": me.get("place", 0) if me else 0}
        if me and self.phase == "run" and me["done"] < TOTAL:
            v["task"] = task_view(me["done"])
        return v
