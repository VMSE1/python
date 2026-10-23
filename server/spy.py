"""Игра «Шпион» (аналог «Мафии» про Python).

Все игроки получают программу. У большинства она одна и та же, у шпиона похожая, но с другим результатом.
Никто не знает, шпион он или нет. Раунд:
  describe: каждый одной фразой описывает, что делает его программа (дословно код пересказывать нельзя);
  vote:     все голосуют, кто шпион;
  guess:    если шпиона нашли, у него последний шанс: угадать, что выводит программа большинства;
  result:   очки, потом учитель запускает следующий раунд (новый шпион, новая пара программ).
Роль и чужие программы клиентам не отдаются до конца раунда.
"""
import random
import time

try:
    from spy_bank import PAIRS
except ImportError:
    from .spy_bank import PAIRS

MAX_PLAYERS = 40
MIN_PLAYERS = 3
DEFAULT_CFG = {"t_say": 75, "t_vote": 60, "t_guess": 25, "spies": 0, "topic": 0}   # spies=0: сами (1 на каждые 8 игроков)
CFG_LIMITS = {"t_say": (10, 600), "t_vote": (10, 600), "t_guess": (5, 120), "spies": (0, 10), "topic": (0, 5)}
INTRO_SEC = 5
SAY_MAX = 70


def _code_lines(code):
    return [ln.strip() for ln in code.splitlines() if len(ln.strip()) >= 6]


class Spy:
    def __init__(self):
        self.cfg = dict(DEFAULT_CFG)
        self.reset()

    def set_cfg(self, d):
        for k, (lo, hi) in CFG_LIMITS.items():
            if k in d and d[k] not in (None, ""):
                try:
                    self.cfg[k] = int(max(lo, min(hi, float(d[k]))))
                except Exception:
                    pass

    def reset(self):
        self.id = 0
        self.phase = "idle"        # idle | intro | lobby | describe | vote | guess | result | end
        self.intro_end = 0.0
        self.t_end = 0.0           # когда кончается текущий этап
        self.players = {}          # uid -> {"nick", "score", "say", "vote", "role"}
        self.banned = set()
        self.round = 0
        self.pair = None
        self.used = []             # номера уже сыгранных пар
        self.spies = set()
        self.options = []
        self.out = None            # итог раунда
        self.recorded = False

    # --- фазы
    def announce(self, now=None):
        now = now or time.time()
        nid = max(self.id + 1, int(now * 1000))
        keep = self.cfg
        self.reset()
        self.cfg = keep
        self.id, self.phase, self.intro_end = nid, "intro", now + INTRO_SEC

    def tick(self, now=None):
        now = now or time.time()
        if self.phase == "intro" and now >= self.intro_end:
            self.phase = "lobby"
        elif self.phase == "describe" and (now >= self.t_end or self._all("say")):
            self._to_vote(now)
        elif self.phase == "vote" and (now >= self.t_end or self._all("vote")):
            self._count(now)
        elif self.phase == "guess" and now >= self.t_end:
            self._finish(False, now)
        return self.phase

    def _all(self, key):
        return bool(self.players) and all(p[key] is not None for p in self.players.values())

    def start_round(self, cfg=None, now=None):
        now = now or time.time()
        self.tick(now)
        if self.phase not in ("lobby", "intro", "result"):
            return "Сначала запусти игру и дождись игроков."
        if len(self.players) < MIN_PLAYERS:
            return "Нужно хотя бы %d игрока." % MIN_PLAYERS
        if cfg:
            self.set_cfg(cfg)
        topic = int(self.cfg["topic"])
        pool = [i for i, p in enumerate(PAIRS) if (not topic or p[0] == topic) and i not in self.used]
        if not pool:
            self.used = [i for i in self.used if topic and PAIRS[i][0] != topic] if topic else []
            pool = [i for i, p in enumerate(PAIRS) if not topic or p[0] == topic]
        i = random.choice(pool)
        self.used.append(i)
        self.pair = PAIRS[i]
        n = len(self.players)
        k = int(self.cfg["spies"]) or max(1, n // 8)
        k = max(1, min(k, (n - 1) // 2))
        self.spies = set(random.sample(list(self.players), k))
        for uid, p in self.players.items():
            p["say"], p["vote"], p["role"] = None, None, ("spy" if uid in self.spies else "civ")
        outs = {self.pair[2], self.pair[4]}
        extra = [q[2] for q in PAIRS] + [q[4] for q in PAIRS]
        random.shuffle(extra)
        for o in extra:
            if len(outs) >= 4:
                break
            outs.add(o)
        self.options = sorted(outs)
        random.shuffle(self.options)
        self.round += 1
        self.out = None
        self.phase, self.t_end = "describe", now + self.cfg["t_say"]
        return ""

    def _to_vote(self, now):
        for p in self.players.values():
            if p["say"] is None:
                p["say"] = ""
        self.phase, self.t_end = "vote", now + self.cfg["t_vote"]

    def _count(self, now):
        votes = {}
        for p in self.players.values():
            if p["vote"]:
                votes[p["vote"]] = votes.get(p["vote"], 0) + 1
        top = max(votes.values()) if votes else 0
        leaders = [u for u, c in votes.items() if c == top]
        self.out = {"votes": {self.players[u]["nick"]: c for u, c in votes.items() if u in self.players}, "caught": None}
        if top and len(leaders) == 1 and leaders[0] in self.spies:
            self.out["caught"] = self.players[leaders[0]]["nick"]
            self.phase, self.t_end = "guess", now + self.cfg["t_guess"]
            return
        self.out["tie"] = len(leaders) > 1 and top > 0
        self.out["out_nick"] = self.players[leaders[0]]["nick"] if top and len(leaders) == 1 and leaders[0] in self.players else ""
        self._finish(False, now)

    def _finish(self, guessed, now):
        """Очки: шпион выжил +4, шпион нашёлся, но угадал +3; мирные: нашли шпиона +3, иначе +1 тем, кто голосовал за настоящего шпиона."""
        caught = bool(self.out and self.out.get("caught"))
        spy_wins = (not caught) or guessed
        self.out["guessed"] = guessed
        self.out["spy_wins"] = spy_wins
        for uid, p in self.players.items():
            if p["role"] == "spy":
                p["score"] += (3 if guessed else 4) if spy_wins else 0
            else:
                right = p["vote"] in self.spies
                p["score"] += (3 if right else 1) if not spy_wins else (1 if right else 0)
        self.phase = "result"

    def stop(self, now=None):
        if self.phase != "idle":
            self.phase = "end"

    # --- игроки
    def join(self, uid, nick):
        if self.phase in ("idle", "end"):
            return "Игра не идёт."
        if uid in self.banned:
            return "Тебя исключили из этой игры."
        if uid not in self.players:
            if self.phase in ("describe", "vote", "guess"):
                return "Раунд уже идёт. Присоединишься со следующего."
            if len(self.players) >= MAX_PLAYERS:
                return "В игре нет мест."
            self.players[uid] = {"nick": nick, "score": 0, "say": None, "vote": None, "role": None}
        return ""

    def kick(self, nick):
        for uid, p in list(self.players.items()):
            if p["nick"].lower() == str(nick).lower():
                self.banned.add(uid)
                del self.players[uid]
                self.spies.discard(uid)
                return True
        return False

    def say(self, uid, text, now=None):
        self.tick(now)
        p = self.players.get(uid)
        if self.phase != "describe" or not p:
            return "Сейчас нельзя."
        text = " ".join(str(text or "").split())[:SAY_MAX]
        if len(text) < 3:
            return "Напиши хотя бы пару слов."
        mine = self.pair[1] if p["role"] == "civ" else self.pair[3]
        low = text.lower()
        for ln in _code_lines(mine):
            if ln.lower() in low:
                return "Не пересказывай код дословно. Опиши, что он делает, своими словами."
        p["say"] = text
        return ""

    def vote(self, uid, nick, now=None):
        self.tick(now)
        p = self.players.get(uid)
        if self.phase != "vote" or not p:
            return "Сейчас нельзя."
        for u, q in self.players.items():
            if q["nick"].lower() == str(nick).lower():
                if u == uid:
                    return "За себя голосовать нельзя."
                p["vote"] = u
                return ""
        return "Такого игрока нет."

    def guess(self, uid, i, now=None):
        self.tick(now)
        p = self.players.get(uid)
        if self.phase != "guess" or not p or p["role"] != "spy" or self.out.get("caught") != p["nick"]:
            return "Сейчас нельзя."
        try:
            ok = self.options[int(i)] == self.pair[2]
        except Exception:
            return "Выбери вариант."
        self._finish(ok, now or time.time())
        return ""

    # --- что видит игрок
    def view(self, uid=None, now=None):
        now = now or time.time()
        self.tick(now)
        ph = self.phase
        board = sorted(({"nick": p["nick"], "score": p["score"]} for p in self.players.values()), key=lambda r: (-r["score"], r["nick"].lower()))
        v = {"ok": True, "game": "spy", "id": self.id, "phase": ph, "round": self.round, "n": len(self.players), "cfg": self.cfg,
             "left": max(0, int(self.t_end - now + .999)) if ph in ("describe", "vote", "guess") else 0,
             "intro": max(0, int(self.intro_end - now + .999)) if ph == "intro" else 0,
             "board": board[:30], "players": [p["nick"] for p in self.players.values()]}
        me = self.players.get(uid)
        v["joined"] = bool(me)
        if me:
            v["me"] = {"nick": me["nick"], "score": me["score"]}
        if ph in ("describe", "vote", "guess") and me and self.pair:
            v["code"] = self.pair[1] if me["role"] == "civ" else self.pair[3]       # свою программу видит каждый, роль не сообщается
            v["said"] = me["say"] is not None
            v["voted"] = me["vote"] is not None
            v["sent"] = sum(1 for p in self.players.values() if p["say"] is not None)
            v["votes_in"] = sum(1 for p in self.players.values() if p["vote"] is not None)
            if ph in ("vote", "guess"):
                v["says"] = [{"nick": p["nick"], "text": p["say"] or "(молчит)"} for p in self.players.values()]
                if me["vote"] in self.players:
                    v["my_vote"] = self.players[me["vote"]]["nick"]
            if ph == "guess" and me["role"] == "spy" and self.out and self.out.get("caught") == me["nick"]:
                v["guess"] = {"options": self.options}
            if ph == "guess":
                v["caught"] = self.out.get("caught")
        if ph == "result" and self.pair:
            v["result"] = {"spies": [self.players[u]["nick"] for u in self.spies if u in self.players], "civ_code": self.pair[1], "civ_out": self.pair[2],
                           "spy_code": self.pair[3], "spy_out": self.pair[4], **(self.out or {})}
            if me:
                v["result"]["you"] = me["role"]
        return v

    def tview(self, now=None):
        """Вид для учителя: то же и роли с программами, чтобы он видел ход игры."""
        v = self.view(None, now)
        v["teacher"] = True
        if self.pair and self.phase in ("describe", "vote", "guess", "result"):
            v["spies"] = [self.players[u]["nick"] for u in self.spies if u in self.players]
            v["pair"] = {"civ_code": self.pair[1], "spy_code": self.pair[3], "civ_out": self.pair[2], "spy_out": self.pair[4]}
            v["sent"] = sum(1 for p in self.players.values() if p["say"] is not None)
            v["votes_in"] = sum(1 for p in self.players.values() if p["vote"] is not None)
            v["says"] = [{"nick": p["nick"], "text": p["say"] or ""} for p in self.players.values()]
        return v
