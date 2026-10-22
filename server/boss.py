"""Босс-арена: весь класс бьёт одного скелета-босса правильными ответами.
Логика без aiohttp, чтобы её можно было проверять обычными тестами.

Как устроено:
- ученик выбирает «простой» (100 урона) или «сложный» (300 урона) вопрос;
- верный ответ бьёт босса, серия подряд даёт множитель до x2;
- неверный ответ лечит босса и на 3 секунды оглушает ученика;
- босс сам лечится: понемногу всё время и раз в 45–75 секунд большим «залечиванием»;
- учитель может остановить и выключить игру в любой момент.
Правильные ответы лежат только на сервере: клиент получает вопрос и перемешанные варианты."""
import random
import time

INTRO_SEC = 6
MAX_PLAYERS = 150
# Все числа ниже учитель меняет из кабинета (бой «Применить» и «Начать бой»). Здесь значения по умолчанию.
DEFAULT_CFG = {
    "hp": 0,             # точное здоровье босса; 0 = считать как «игроков × hp_per»
    "hp_per": 8000,      # здоровье на каждого игрока на старте
    "hp_min": 1000,      # нижняя граница при расчёте по игрокам
    "dmg_easy": 100, "dmg_hard": 300,        # удар за верный ответ
    "heal_easy": 60, "heal_hard": 200,       # лечение босса за неверный ответ
    "stun": 3.0,         # на сколько секунд оглушается ошибившийся
    "limit_easy": 25.0, "limit_hard": 45.0,  # секунд на вопрос
    "regen_min": 3.6,    # самолечение босса, процентов максимума в минуту
    "big_heal": 4.0,     # большое залечивание, процентов максимума
    "big_min": 45, "big_max": 75,            # раз в сколько секунд (0 и 0 = выключить)
    "combo_step": 0.1, "combo_max": 2.0,     # рост удара за серию и потолок множителя
    "min_think": 1.2,    # быстрее ответить нельзя (секунд)
    "answer_gap": 0.5,   # пауза между ответами
}
# допустимые границы (нижняя, верхняя): защита от опечаток
CFG_LIMITS = {"hp": (0, 100000000), "hp_per": (1, 10000000), "hp_min": (1, 100000000), "dmg_easy": (1, 1000000), "dmg_hard": (1, 1000000),
              "heal_easy": (0, 1000000), "heal_hard": (0, 1000000), "stun": (0, 60), "limit_easy": (5, 300), "limit_hard": (5, 600),
              "regen_min": (0, 100), "big_heal": (0, 100), "big_min": (0, 3600), "big_max": (0, 3600), "combo_step": (0, 5), "combo_max": (1, 20),
              "min_think": (0, 10), "answer_gap": (0, 10)}
EVENTS_KEEP = 60

# (вопрос, [варианты], номер верного). Простые: основы первых уроков.
EASY = [
    ("Что выведет print(2 + 3)?", ["5", "23", "2 + 3", "Ошибка"], 0),
    ("Какая функция читает ввод с клавиатуры?", ["input()", "print()", "scan()", "read()"], 0),
    ("Как получить целое число из строки \"7\"?", ["int(\"7\")", "str(7)", "float(7)", "num(\"7\")"], 0),
    ("Какой тип у значения 3.14?", ["float", "int", "str", "bool"], 0),
    ("Что выведет print(\"При\" + \"вет\")?", ["Привет", "При вет", "При+вет", "Ошибка"], 0),
    ("Какой знак даёт остаток от деления?", ["%", "//", "/", "&"], 0),
    ("Чему равно 10 // 3?", ["3", "3.33", "1", "4"], 0),
    ("Чему равно 10 % 3?", ["1", "3", "0", "10"], 0),
    ("С какого знака начинается комментарий в Python?", ["#", "//", "--", "/*"], 0),
    ("Что выведет print(len(\"мир\"))?", ["3", "2", "4", "мир"], 0),
    ("Какой оператор проверяет равенство?", ["==", "=", "!=", "=>"], 0),
    ("Чему равно 2 ** 3?", ["8", "6", "5", "9"], 0),
    ("Какой тип у значения True?", ["bool", "int", "str", "float"], 0),
    ("Какой цикл удобен, когда число повторов известно заранее?", ["for", "if", "def", "else"], 0),
    ("Сколько раз сработает print в цикле for i in range(4)?", ["4", "3", "5", "0"], 0),
    ("Как взять первый элемент списка a?", ["a[0]", "a[1]", "a(0)", "a.first"], 0),
    ("Каким методом добавляют элемент в конец списка?", ["append", "add", "push", "insert_end"], 0),
    ("Каким словом объявляют функцию?", ["def", "func", "function", "make"], 0),
    ("Что выведет print(\"a\" * 3)?", ["aaa", "a3", "a a a", "Ошибка"], 0),
    ("Какое слово выполняется, когда условие if ложно?", ["else", "then", "other", "stop"], 0),
    ("x = 5, потом x += 2. Чему равно x?", ["7", "5", "2", "52"], 0),
    ("Что выведет print(7 > 3)?", ["True", "False", "7", "Ошибка"], 0),
    ("Что вернёт input()?", ["Строку", "Целое число", "Дробное число", "Список"], 0),
    ("Как узнать длину списка a?", ["len(a)", "a.len", "size(a)", "a.count"], 0),
    ("Что выведет print(10 / 4)?", ["2.5", "2", "3", "2.0"], 0),
    ("Какое слово означает логическое «и»?", ["and", "or", "not", "&&"], 0),
    ("Какая ошибка бывает при неверных отступах?", ["IndentationError", "NameError", "ValueError", "TypeError"], 0),
    ("Что выведет print(type(5))?", ["<class 'int'>", "<class 'str'>", "int", "5"], 0),
    ("Что выведет print(\"5\" + \"5\")?", ["55", "10", "5 5", "Ошибка"], 0),
    ("Что делает print()?", ["Выводит на экран", "Читает с клавиатуры", "Считает сумму", "Создаёт список"], 0),
]

# Сложные: код надо «прогнать в голове».
HARD = [
    ("x = \"5\"\nprint(x * 2)", ["55", "10", "5 5", "Ошибка"], 0),
    ("for i in range(1, 6, 2):\n    print(i, end=\" \")", ["1 3 5", "1 2 3 4 5", "2 4", "1 3 5 7"], 0),
    ("a = [1, 2, 3]\na.append(4)\nprint(a[-1] + len(a))", ["8", "7", "4", "9"], 0),
    ("print(7 // 2 + 7 % 2)", ["4", "3", "5", "4.5"], 0),
    ("s = \"python\"\nprint(s[1:4])", ["yth", "pyt", "ytho", "pyth"], 0),
    ("d = {\"a\": 1, \"b\": 2}\nprint(d[\"b\"] + len(d))", ["4", "3", "2", "Ошибка"], 0),
    ("def f(x):\n    return x * 2\nprint(f(f(3)))", ["12", "6", "9", "None"], 0),
    ("x = 10\nif x > 5 and x < 8:\n    print(\"A\")\nelif x >= 10:\n    print(\"B\")\nelse:\n    print(\"C\")", ["B", "A", "C", "AB"], 0),
    ("n = 0\nwhile n < 10:\n    n += 4\nprint(n)", ["12", "10", "8", "4"], 0),
    ("print(bool(0), bool(\"0\"))", ["False True", "False False", "True True", "True False"], 0),
    ("a = [3, 1, 2]\na.sort()\nprint(a)", ["[1, 2, 3]", "[3, 2, 1]", "[3, 1, 2]", "None"], 0),
    ("print(\"abc\".upper().lower() + \"D\")", ["abcD", "ABCD", "abcd", "ABCd"], 0),
    ("x = 5\ny = x\nx = 8\nprint(y)", ["5", "8", "13", "Ошибка"], 0),
    ("print(2 ** 3 ** 2)", ["512", "64", "36", "256"], 0),
    ("print(10 - 2 * 3 ** 2)", ["-8", "72", "-26", "28"], 0),
    ("total = 0\nfor i in range(5):\n    if i % 2 == 0:\n        total += i\nprint(total)", ["6", "10", "4", "2"], 0),
    ("print(\"5\" + \"5\" == \"55\")", ["True", "False", "55", "Ошибка"], 0),
    ("s = \"a,b,c\"\nprint(len(s.split(\",\")))", ["3", "5", "1", "2"], 0),
    ("try:\n    print(int(\"x\"))\nexcept ValueError:\n    print(\"ой\")", ["ой", "x", "0", "Ошибка без обработки"], 0),
    ("print(not (3 > 2 or 1 > 5))", ["False", "True", "3", "Ошибка"], 0),
    ("a = [1, 2, 3]\nb = a\nb.append(9)\nprint(len(a))", ["4", "3", "9", "Ошибка"], 0),
    ("print(type(5 / 1))", ["<class 'float'>", "<class 'int'>", "<class 'str'>", "5"], 0),
    ("x = 7\nx -= 3\nx *= 2\nprint(x)", ["8", "4", "11", "14"], 0),
    ("for ch in \"abc\":\n    print(ch.upper(), end=\"\")", ["ABC", "abc", "A B C", "Aabc"], 0),
]
BANK = {"easy": EASY, "hard": HARD}


def _check_bank():
    for lvl, qs in BANK.items():
        for q, opts, ok in qs:
            assert len(opts) == 4 and len(set(opts)) == 4 and 0 <= ok < 4, q


_check_bank()


class Boss:
    def __init__(self):
        self.cfg = dict(DEFAULT_CFG)
        self.reset()

    def set_cfg(self, d):
        """Принимает настройки из кабинета. Лишние и неверные поля игнорируются, числа зажимаются в границы."""
        for k, (lo, hi) in CFG_LIMITS.items():
            if k in d and d[k] not in (None, ""):
                try:
                    v = float(d[k])
                except Exception:
                    continue
                v = max(lo, min(hi, v))
                self.cfg[k] = v if isinstance(DEFAULT_CFG[k], float) else int(v)
        if self.cfg["big_max"] < self.cfg["big_min"]:
            self.cfg["big_max"] = self.cfg["big_min"]

    def reset(self):
        self.id = 0
        self.phase = "idle"        # idle | intro | lobby | run | end
        self.intro_end = 0.0
        self.t0 = 0.0
        self.t_end = 0.0
        self.hp_max = self.cfg["hp_min"]
        self.hp = self.hp_max
        self.players = {}          # uid -> dict
        self.banned = set()
        self.events = []           # {"n": номер, "k": тип, "nick":.., "v":..}
        self.seq = 0
        self.last_tick = 0.0
        self.next_big = 0.0
        self.won = False
        self.recorded = False

    # --- события
    def ev(self, kind, nick="", v=0):
        self.seq += 1
        self.events.append({"n": self.seq, "k": kind, "nick": nick, "v": int(v)})
        if len(self.events) > EVENTS_KEEP:
            del self.events[: len(self.events) - EVENTS_KEEP]

    # --- фазы
    def announce(self, now=None):
        now = now or time.time()
        nid = max(self.id + 1, int(now * 1000))
        self.reset()
        self.id, self.phase, self.intro_end = nid, "intro", now + INTRO_SEC

    def start(self, cfg=None, now=None):
        now = now or time.time()
        self.tick(now)
        if self.phase not in ("intro", "lobby"):
            return False
        if cfg:
            self.set_cfg(cfg)
        c = self.cfg
        self.hp_max = int(c["hp"]) if c["hp"] > 0 else max(int(c["hp_min"]), len(self.players) * int(c["hp_per"]))
        self.hp = self.hp_max
        self.phase, self.t0, self.last_tick = "run", now, now
        self.next_big = self.big_time(now)
        self.ev("start", "", self.hp_max)
        return True

    def big_time(self, now):
        c = self.cfg
        if c["big_heal"] <= 0 or c["big_max"] <= 0:
            return float("inf")
        return now + random.uniform(c["big_min"], max(c["big_min"], c["big_max"]))

    def edit(self, d, now=None):
        """Правка на ходу: настройки, здоровье босса, полное лечение. Работает и в бою, и до него."""
        now = now or time.time()
        self.set_cfg(d)
        if d.get("heal_full"):
            self.hp = float(self.hp_max)
        if d.get("hpmax") not in (None, ""):
            try:
                self.hp_max = max(1, min(100000000, int(float(d["hpmax"]))))
                self.hp = min(self.hp, float(self.hp_max))
            except Exception:
                pass
        if d.get("hp_now") not in (None, ""):
            try:
                self.hp_max = max(self.hp_max, 1)
                self.hp = float(max(0, min(self.hp_max, int(float(d["hp_now"])))))
            except Exception:
                pass
        if self.phase == "run":
            self.next_big = self.big_time(now)
            if self.hp <= 0:
                self.hp, self.phase, self.t_end, self.won = 0.0, "end", now, True
                self.ev("dead", "учитель", 0)

    def stop(self, now=None):
        now = now or time.time()
        if self.phase in ("run", "lobby", "intro"):
            self.phase, self.t_end = "end", now

    def tick(self, now=None):
        """Двигает время: заставка -> зал ожидания, лечение босса."""
        now = now or time.time()
        if self.phase == "intro" and now >= self.intro_end:
            self.phase = "lobby"
        if self.phase == "run":
            dt = max(0.0, min(5.0, now - self.last_tick))
            self.last_tick = now
            if self.hp > 0:
                heal = self.hp_max * self.cfg["regen_min"] / 100.0 / 60.0 * dt
                self.hp = min(self.hp_max, self.hp + heal)
                if now >= self.next_big:
                    add = int(self.hp_max * self.cfg["big_heal"] / 100.0)
                    self.hp = min(self.hp_max, self.hp + add)
                    self.next_big = self.big_time(now)
                    self.ev("bigheal", "", add)
        return self.phase

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
            self.players[uid] = {"nick": nick, "dmg": 0, "ok": 0, "bad": 0, "streak": 0, "best": 0, "stun": 0.0, "last": 0.0, "q": None, "seen": {"easy": [], "hard": []}}
        return ""

    def kick(self, nick):
        for uid, p in list(self.players.items()):
            if p["nick"].lower() == str(nick).lower():
                self.banned.add(uid)
                del self.players[uid]
                return True
        return False

    # --- вопросы
    def ask(self, uid, lvl, now=None):
        """Выдаёт игроку вопрос. Возвращает (вопрос или None, ошибка)."""
        now = now or time.time()
        self.tick(now)
        if self.phase != "run":
            return None, "Бой сейчас не идёт."
        p = self.players.get(uid)
        if not p:
            return None, "Сначала войди в игру."
        if lvl not in BANK:
            return None, "Выбери простой или сложный вопрос."
        if p["q"] and now - p["q"]["t0"] <= self.limit(p["q"]["lvl"]):
            return self.q_view(p), ""      # тот же вопрос, если страницу обновили
        if p["q"]:                          # время вышло: считаем промахом без лечения
            p["streak"] = 0
            p["q"] = None
        if now < p["stun"]:
            return None, "Оглушён, подожди %d с." % (int(p["stun"] - now) + 1)
        bank = BANK[lvl]
        seen = p["seen"][lvl]
        free = [i for i in range(len(bank)) if i not in seen]
        if not free:
            seen.clear()
            free = list(range(len(bank)))
        i = random.choice(free)
        seen.append(i)
        text, opts, ok = bank[i]
        order = list(range(4))
        random.shuffle(order)
        p["q"] = {"lvl": lvl, "i": i, "t0": now, "order": order, "ok": order.index(ok)}
        return self.q_view(p), ""

    def limit(self, lvl):
        return float(self.cfg["limit_" + lvl])

    def q_view(self, p):
        q = p["q"]
        text, opts, _ = BANK[q["lvl"]][q["i"]]
        return {"lvl": q["lvl"], "text": text, "opts": [opts[k] for k in q["order"]], "limit": self.limit(q["lvl"]), "left": max(0.0, self.limit(q["lvl"]) - (time.time() - q["t0"])), "dmg": int(self.cfg["dmg_" + q["lvl"]])}

    def answer(self, uid, choice, now=None):
        """Ответ ученика. Возвращает словарь результата."""
        now = now or time.time()
        self.tick(now)
        if self.phase != "run":
            return {"ok": False, "error": "Бой сейчас не идёт."}
        p = self.players.get(uid)
        if not p or not p["q"]:
            return {"ok": False, "error": "Сначала возьми вопрос."}
        q = p["q"]
        if now - q["t0"] < self.cfg["min_think"]:
            return {"ok": False, "error": "Слишком быстро. Прочитай вопрос."}
        if now - p["last"] < self.cfg["answer_gap"]:
            return {"ok": False, "error": "Не так быстро."}
        p["last"] = now
        p["q"] = None
        lvl = q["lvl"]
        if now - q["t0"] > self.limit(lvl):
            p["streak"] = 0
            return {"ok": True, "right": False, "late": True, "dmg": 0, "msg": "Время вышло."}
        try:
            c = int(choice)
        except Exception:
            c = -1
        if c == q["ok"]:
            p["streak"] += 1
            p["best"] = max(p["best"], p["streak"])
            mult = min(self.cfg["combo_max"], 1 + self.cfg["combo_step"] * (p["streak"] - 1))
            dmg = int(self.cfg["dmg_" + lvl] * mult)
            if self.hp <= 0:
                dmg = 0
            if dmg >= self.hp:
                dmg = int(self.hp) + (1 if self.hp % 1 else 0)
                self.hp = 0.0
            else:
                self.hp -= dmg
            p["dmg"] += dmg
            p["ok"] += 1
            self.ev("hit" if lvl == "easy" else "bighit", p["nick"], dmg)
            if self.hp <= 0 and self.phase == "run":
                self.hp = 0
                self.phase, self.t_end, self.won = "end", now, True
                self.ev("dead", p["nick"], dmg)
            return {"ok": True, "right": True, "dmg": dmg, "streak": p["streak"], "mult": round(mult, 1)}
        p["streak"] = 0
        p["bad"] += 1
        p["stun"] = now + self.cfg["stun"]
        heal = min(int(self.cfg["heal_" + lvl]), int(self.hp_max - self.hp))
        self.hp += heal
        self.ev("heal", p["nick"], heal)
        return {"ok": True, "right": False, "dmg": 0, "heal": heal, "right_i": q["ok"]}

    # --- вид для клиентов
    def view(self, uid=None, since=0, now=None):
        now = now or time.time()
        self.tick(now)
        rows = sorted(self.players.items(), key=lambda kv: (-kv[1]["dmg"], kv[1]["nick"].lower()))
        v = {"ok": True, "id": self.id, "game": "boss", "phase": self.phase, "n": len(self.players), "t": int(now * 1000),
             "intro": max(0, int(self.intro_end - now + .999)) if self.phase == "intro" else 0,
             "hp": int(self.hp), "hpmax": int(self.hp_max), "won": self.won, "cfg": self.cfg,
             "elapsed": round((self.t_end if self.phase == "end" else now) - self.t0, 1) if self.t0 else 0,
             "players": [{"nick": p["nick"], "dmg": p["dmg"], "streak": p["streak"], "ok": p["ok"], "bad": p["bad"], "me": u == uid} for u, p in rows[:40]],
             "events": [e for e in self.events if e["n"] > since], "seq": self.seq}
        me = self.players.get(uid) if uid is not None else None
        if me:
            rank = [u for u, _ in rows].index(uid) + 1
            v["me"] = {"joined": True, "dmg": me["dmg"], "rank": rank, "streak": me["streak"], "best": me["best"], "ok": me["ok"], "bad": me["bad"], "stun": max(0.0, round(me["stun"] - now, 1))}
            if me["q"] and self.phase == "run":
                if now - me["q"]["t0"] <= self.limit(me["q"]["lvl"]):
                    v["q"] = self.q_view(me)
        else:
            v["me"] = {"joined": False}
        return v
