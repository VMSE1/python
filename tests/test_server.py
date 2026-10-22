"""Проверка сервера: регистрация, вход, прогресс, живая викторина, облако слов. Запуск: python3 -m unittest tests.test_server"""
import asyncio, json, os, sys, tempfile, time, unittest

try:
    from aiohttp import web
    from aiohttp.test_utils import TestClient, TestServer
except ImportError:  # на машине без aiohttp тест пропускается
    web = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))


@unittest.skipIf(web is None, "нет aiohttp")
class TestServerApi(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.mkdtemp()
        os.environ["DB_PATH"] = os.path.join(self.tmp, "t.sqlite"); os.environ["TEACHER_KEY"] = "teacher-secret"
        import importlib, app as A
        self.A = importlib.reload(A); self.A.HITS.clear(); self.A.FAILS.clear(); self.A.ROOMS.clear()
        self.cl = TestClient(TestServer(self.A.make_app())); await self.cl.start_server()

    async def asyncTearDown(self):
        await self.cl.close()

    async def reg(self, nick="anya", pw="secret1", fio="Иванова Аня", grp="9А"):
        r = await self.cl.post("/api/register", json={"nick": nick, "password": pw, "fio": fio, "group": grp, "email": "a@b.ru"}); return r.status, await r.json()

    async def test_register_login_progress(self):
        st, d = await self.reg(); self.assertEqual(st, 200); tok = d["token"]
        st, d2 = await self.reg(); self.assertEqual(st, 409)
        st, _ = await self.reg(nick="ab"); self.assertEqual(st, 400)
        st, _ = await self.reg(nick="petya", pw="123"); self.assertEqual(st, 400)
        r = await self.cl.post("/api/login", json={"nick": "ANYA", "password": "secret1"}); self.assertEqual(r.status, 200)
        r = await self.cl.post("/api/login", json={"nick": "anya", "password": "bad"}); self.assertEqual(r.status, 401)
        h = {"Authorization": "Bearer " + tok}
        r = await self.cl.put("/api/progress", json={"progress": {"passed": {"1.1": 1}, "done": {"1.1": 1}, "streak": {"last": "2026-10-20", "n": 2, "best": 2, "days": ["2026-10-20"]}}}, headers=h); self.assertEqual(r.status, 200)
        r = await self.cl.put("/api/progress", json={"progress": {"passed": {"1.2": 1, "<x>": 1}, "streak": {"last": "2026-10-21", "n": 3, "best": 3}}}, headers=h); d = await r.json()
        self.assertEqual(sorted(d["progress"]["passed"]), ["1.1", "1.2"]); self.assertEqual(d["progress"]["streak"]["n"], 3)
        r = await self.cl.get("/api/me", headers=h); d = await r.json(); self.assertEqual(d["nick"], "anya"); self.assertIn("1.2", d["progress"]["passed"])
        r = await self.cl.get("/api/me"); self.assertEqual(r.status, 401)
        r = await self.cl.put("/api/progress", json={"progress": {"x": "y" * 30000}}, headers=h); self.assertEqual(r.status, 400)

    async def test_lockout_and_teacher(self):
        await self.reg()
        for _ in range(6): await self.cl.post("/api/login", json={"nick": "anya", "password": "bad"})
        r = await self.cl.post("/api/login", json={"nick": "anya", "password": "secret1"}); self.assertEqual(r.status, 429)
        r = await self.cl.get("/api/teacher/users"); self.assertEqual(r.status, 403)
        r = await self.cl.get("/api/teacher/users", headers={"X-Teacher-Key": "teacher-secret"}); d = await r.json()
        self.assertEqual(d["users"][0]["fio"], "Иванова Аня"); self.assertNotIn("hash", json.dumps(d))
        r = await self.cl.post("/api/teacher/reset", json={"nick": "anya", "password": "newpass1"}, headers={"X-Teacher-Key": "teacher-secret"}); self.assertEqual(r.status, 200)
        self.A.FAILS.clear()
        r = await self.cl.post("/api/login", json={"nick": "anya", "password": "newpass1"}); self.assertEqual(r.status, 200)

    async def test_cors(self):
        r = await self.cl.get("/api/ping", headers={"Origin": "https://vmse1.github.io"}); self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), "https://vmse1.github.io")
        r = await self.cl.get("/api/ping", headers={"Origin": "https://evil.example"}); self.assertIsNone(r.headers.get("Access-Control-Allow-Origin"))

    async def recv(self, ws, t, n=20):
        for _ in range(n):
            m = json.loads((await asyncio.wait_for(ws.receive(), 5)).data)
            if m["t"] == t: return m
        self.fail("не пришло " + t)

    async def test_quiz_room(self):
        qs = [{"q": "2+2?", "o": ["3", "4", "5", "6"], "a": 1, "why": "Четыре.", "sec": 10}, {"q": "3*3?", "o": ["6", "9", "12", "1"], "a": 1, "sec": 10}]
        h = await self.cl.ws_connect("/ws"); await h.send_json({"t": "host", "key": "bad", "kind": "quiz", "questions": qs}); await self.recv(h, "err")
        await h.send_json({"t": "host", "key": "teacher-secret", "kind": "quiz", "title": "Т", "questions": qs}); code = (await self.recv(h, "hosted"))["code"]
        a = await self.cl.ws_connect("/ws"); b = await self.cl.ws_connect("/ws")
        await a.send_json({"t": "join", "code": "0000" if code != "0000" else "0001", "nick": "Аня"}); await self.recv(a, "err")
        await a.send_json({"t": "join", "code": code, "nick": "Аня"}); await self.recv(a, "joined")
        await b.send_json({"t": "join", "code": code, "nick": "аня"}); await self.recv(b, "err")
        await b.send_json({"t": "join", "code": code, "nick": "Боря"}); await self.recv(b, "joined")
        await h.send_json({"t": "start"}); q = await self.recv(a, "q"); self.assertNotIn("a", q); self.assertEqual(q["o"][1], "4")
        await a.send_json({"t": "a", "i": 0, "k": 1}); await b.send_json({"t": "a", "i": 0, "k": 0}); await b.send_json({"t": "a", "i": 0, "k": 1})
        ra = await self.recv(a, "res"); rb = await self.recv(b, "res")
        self.assertTrue(ra["ok"]); self.assertGreaterEqual(ra["gain"], 900); self.assertFalse(rb["ok"]); self.assertEqual(ra["rank"], 1); self.assertEqual(rb["rank"], 2)
        await h.send_json({"t": "next"}); await self.recv(a, "q")
        await a.send_json({"t": "a", "i": 1, "k": 1}); await b.send_json({"t": "a", "i": 1, "k": 1}); await self.recv(a, "res")
        await h.send_json({"t": "next"}); e = await self.recv(a, "end"); self.assertEqual(e["board"][0]["nick"], "Аня")

    async def test_cloud_room(self):
        h = await self.cl.ws_connect("/ws"); await h.send_json({"t": "host", "key": "teacher-secret", "kind": "cloud", "title": "Что такое цикл"}); code = (await self.recv(h, "hosted"))["code"]
        a = await self.cl.ws_connect("/ws"); b = await self.cl.ws_connect("/ws")
        await a.send_json({"t": "join", "code": code, "nick": "Аня"}); await b.send_json({"t": "join", "code": code, "nick": "Боря"})
        await a.send_json({"t": "w", "words": ["Повтор", "for", "<b>x</b>", "", "повтор"]}); await b.send_json({"t": "w", "words": ["повтор", "цикл"]})
        for _ in range(10):
            m = await self.recv(h, "cloud")
            if dict(m["words"]).get("повтор") == 2: break
        w = dict(m["words"]); self.assertEqual(w["повтор"], 2); self.assertIn("for", w); self.assertNotIn("", w)
        for ws_ in (a,):
            await ws_.send_json({"t": "w", "words": list("abcdefg")})
        await h.send_json({"t": "lock"}); await asyncio.sleep(0.2); await b.send_json({"t": "w", "words": ["новое"]}); await asyncio.sleep(0.8)
        r = self.A.ROOMS[code]; self.assertNotIn("новое", r.words)

    # ---------------- гонка
    async def race_user(self, nick):
        r = await self.cl.post("/api/register", json={"nick": nick, "password": "secret1", "quick": True}); d = await r.json(); self.assertEqual(r.status, 200, d)
        return {"Authorization": "Bearer " + d["token"]}

    def meta(self, code):
        return "v1;t=%d;p=0;b=0;e=0;s=30;h=00000000" % len(code.strip())

    async def test_quick_register(self):
        r = await self.cl.post("/api/register", json={"nick": "vasya", "password": "secret1", "quick": True}); self.assertEqual(r.status, 200)
        r = await self.cl.post("/api/register", json={"nick": "petya", "password": "secret1"}); self.assertEqual(r.status, 400)

    async def test_race_flow(self):
        A = self.A; A.RACE.reset(); T = {"X-Teacher-Key": "teacher-secret"}
        A.R.MIN_GAP = 0; A.R.TYPE_RATE = 1e9
        r = await self.cl.post("/api/teacher/play", json={"action": "announce"}); self.assertEqual(r.status, 403)
        d = await (await self.cl.get("/api/play")).json(); self.assertEqual(d["phase"], "idle")
        r = await self.cl.post("/api/teacher/play", json={"action": "announce"}, headers=T); d = await r.json(); self.assertEqual(d["phase"], "intro")
        h1, h2, h3 = await self.race_user("anya"), await self.race_user("boris"), await self.race_user("vera")
        r = await self.cl.post("/api/race/join", json={}); self.assertEqual(r.status, 401)
        for h in (h1, h2, h3):
            r = await self.cl.post("/api/race/join", json={}, headers=h); self.assertEqual(r.status, 200)
        d = await (await self.cl.get("/api/play")).json(); self.assertEqual(d["n"], 3)
        sub = lambda h, i, code: self.cl.post("/api/race/submit", json={"i": i, "code": code, "meta": self.meta(code)}, headers=h)
        d = await (await sub(h1, 0, 'print("Привет, Аня!")')).json(); self.assertFalse(d["passed"])  # гонка ещё не идёт
        r = await self.cl.post("/api/teacher/play", json={"action": "start"}, headers=T); d = await r.json(); self.assertEqual(d["phase"], "run")
        st = await (await self.cl.get("/api/race/state", headers=h1)).json(); self.assertEqual(st["task"]["i"], 0); self.assertNotIn("cases", st["task"])
        good = ['name = input()\nprint(f"Привет, {name}!")', 'a = int(input())\nb = int(input())\nprint(a + b)', 'x = int(input())\nprint(4 * x)',
                'n = int(input())\nprint("Чётное" if n % 2 == 0 else "Нечётное")', 'b = int(input())\nprint(5 if b >= 85 else 4 if b >= 70 else 3 if b >= 50 else 2)']
        d = await (await sub(h1, 0, 'print("Привет, Анна!")')).json(); self.assertFalse(d["passed"]); self.assertIn("ждали", d["msg"])  # зашитый ответ не проходит
        d = await (await sub(h1, 1, good[1])).json(); self.assertFalse(d["passed"])  # нельзя перепрыгнуть задачу
        for i, c in enumerate(good):
            d = await (await sub(h1, i, c)).json(); self.assertTrue(d["passed"], d)
        self.assertEqual(d["me"]["place"], 1)
        d = await (await sub(h1, 0, good[0])).json(); self.assertFalse(d["passed"])  # уже финишировал
        d = await (await sub(h2, 0, "while True: pass")).json(); self.assertFalse(d["passed"])  # бесконечный цикл не вешает сервер
        d = await (await sub(h2, 0, 'import os\nos.system("echo hi")')).json(); self.assertFalse(d["passed"])  # запретные действия
        for h in (h2, h3):
            for i, c in enumerate(good):
                d = await (await sub(h, i, c)).json(); self.assertTrue(d["passed"], d)
        st = await (await self.cl.get("/api/race/state")).json(); self.assertEqual([w["nick"] for w in st["winners"]], ["anya", "boris", "vera"]); self.assertEqual(st["phase"], "run")
        r = await self.cl.post("/api/teacher/play", json={"action": "kick", "nick": "vera"}, headers=T); d = await r.json(); self.assertEqual([w["nick"] for w in d["winners"]], ["anya", "boris"])
        r = await self.cl.post("/api/teacher/play", json={"action": "stop"}, headers=T); d = await r.json(); self.assertEqual(d["phase"], "end")

    async def test_boss_arena(self):
        A = self.A; A.BOSS.reset(); T = {"X-Teacher-Key": "teacher-secret"}
        A.BOSS.set_cfg({"min_think": 0, "answer_gap": 0})
        r = await self.cl.post("/api/teacher/play", json={"action": "boss_announce"}); self.assertEqual(r.status, 403)
        d = await (await self.cl.get("/api/play")).json(); self.assertEqual(d["game"], "race")
        d = await (await self.cl.post("/api/teacher/play", json={"action": "boss_announce"}, headers=T)).json(); self.assertEqual(d["phase"], "intro")
        d = await (await self.cl.get("/api/play")).json(); self.assertEqual((d["game"], d["phase"]), ("boss", "intro"))
        h1, h2 = await self.race_user("anya"), await self.race_user("boris")
        r = await self.cl.post("/api/boss/join", json={}); self.assertEqual(r.status, 401)
        for h in (h1, h2):
            self.assertEqual((await self.cl.post("/api/boss/join", json={}, headers=h)).status, 200)
        r = await self.cl.post("/api/boss/ask", json={"lvl": "easy"}, headers=h1); self.assertEqual(r.status, 400)  # бой ещё не идёт
        d = await (await self.cl.post("/api/teacher/play", json={"action": "boss_start", "hp_per": 10000, "hp_min": 40000}, headers=T)).json()
        self.assertEqual((d["phase"], d["hpmax"], d["hp"]), ("run", 40000, 40000))   # минимум 40 000
        r = await self.cl.post("/api/boss/ask", json={"lvl": "nope"}, headers=h1); self.assertEqual(r.status, 400)
        d = await (await self.cl.post("/api/boss/ask", json={"lvl": "easy"}, headers=h1)).json()
        self.assertEqual(len(d["q"]["opts"]), 4); self.assertNotIn("ok", d["q"]); self.assertNotIn("right_i", json.dumps(d))
        uid1 = [u for u, p in A.BOSS.players.items() if p["nick"] == "anya"][0]
        right = A.BOSS.players[uid1]["q"]["ok"]
        d = await (await self.cl.post("/api/boss/answer", json={"a": right}, headers=h1)).json()
        self.assertTrue(d["right"]); self.assertEqual(d["dmg"], 100); self.assertEqual(d["hp"], 39900); self.assertEqual(d["me"]["dmg"], 100)
        # сложный вопрос, верно, серия 2 даёт множитель 1.1
        d = await (await self.cl.post("/api/boss/ask", json={"lvl": "hard"}, headers=h1)).json(); self.assertEqual(d["q"]["dmg"], 300)
        d = await (await self.cl.post("/api/boss/answer", json={"a": A.BOSS.players[uid1]["q"]["ok"]}, headers=h1)).json(); self.assertEqual(d["dmg"], 330)
        # ответ без вопроса
        d = await (await self.cl.post("/api/boss/answer", json={"a": 0}, headers=h1)).json(); self.assertIn("error", d)
        # неверный ответ лечит босса и оглушает
        uid2 = [u for u, p in A.BOSS.players.items() if p["nick"] == "boris"][0]
        await self.cl.post("/api/boss/ask", json={"lvl": "easy"}, headers=h2)
        wrong = (A.BOSS.players[uid2]["q"]["ok"] + 1) % 4; hp0 = A.BOSS.hp
        d = await (await self.cl.post("/api/boss/answer", json={"a": wrong}, headers=h2)).json()
        self.assertFalse(d["right"]); self.assertGreater(d["heal"], 0); self.assertGreaterEqual(A.BOSS.hp, hp0)
        r = await self.cl.post("/api/boss/ask", json={"lvl": "easy"}, headers=h2); self.assertEqual(r.status, 400); self.assertIn("Оглушён", (await r.json())["error"])
        # лечение босса со временем
        A.BOSS.hp = 30000; A.BOSS.tick(A.BOSS.last_tick + 60); self.assertGreater(A.BOSS.hp, 30000)
        # рейтинг
        st = await (await self.cl.get("/api/boss/state", headers=h2)).json(); self.assertEqual(st["players"][0]["nick"], "anya"); self.assertEqual(st["me"]["rank"], 2)
        # победа
        A.BOSS.hp = 50
        await self.cl.post("/api/boss/ask", json={"lvl": "easy"}, headers=h1)
        d = await (await self.cl.post("/api/boss/answer", json={"a": A.BOSS.players[uid1]["q"]["ok"]}, headers=h1)).json()
        self.assertEqual((d["phase"], d["won"], d["hp"]), ("end", True, 0))
        # учитель выключает игру
        d = await (await self.cl.post("/api/teacher/play", json={"action": "boss_reset"}, headers=T)).json(); self.assertEqual(d["phase"], "idle")
        d = await (await self.cl.get("/api/play")).json(); self.assertEqual(d["game"], "race")
        # запуск гонки гасит арену
        await self.cl.post("/api/teacher/play", json={"action": "boss_announce"}, headers=T); await self.cl.post("/api/teacher/play", json={"action": "announce"}, headers=T)
        self.assertEqual(A.BOSS.phase, "idle")
        await self.cl.post("/api/teacher/play", json={"action": "reset"}, headers=T)

    async def test_race_antiscript(self):
        A = self.A; A.RACE.reset(); T = {"X-Teacher-Key": "teacher-secret"}; A.R.MIN_GAP = 0; A.R.TYPE_RATE = 1e9
        await self.cl.post("/api/teacher/play", json={"action": "announce"}, headers=T)
        h = await self.race_user("hacker"); await self.cl.post("/api/race/join", json={}, headers=h)
        await self.cl.post("/api/teacher/play", json={"action": "start"}, headers=T)
        code = 'name = input()\nprint(f"Привет, {name}!")'
        async def sub(meta):
            return await (await self.cl.post("/api/race/submit", json={"i": 0, "code": code, "meta": meta}, headers=h)).json()
        for bad in (None, "", "v2;t=99", "v1;t=%d;a=1" % len(code), "v1;t=%d;d=1" % len(code), "v1;t=%d;e=3" % len(code), "v1;t=3"):
            d = await sub(bad); self.assertFalse(d["passed"], bad)
        A.R.TYPE_RATE = 14.0; d = await sub(self.meta(code)); self.assertFalse(d["passed"]); self.assertIn("быстро", d["msg"])  # мгновенная отправка = не набирал руками
        A.R.TYPE_RATE = 1e9; d = await sub(self.meta(code)); self.assertTrue(d["passed"], d)

    async def test_race_late_and_idle(self):
        A = self.A; A.RACE.reset(); h = await self.race_user("lena")
        r = await self.cl.post("/api/race/join", json={}, headers=h); self.assertEqual(r.status, 409)  # игры нет
        r = await self.cl.post("/api/teacher/play", json={"action": "start"}, headers={"X-Teacher-Key": "teacher-secret"}); self.assertEqual(r.status, 400)

    async def test_email_required_and_recovery(self):
        r = await self.cl.post("/api/register", json={"nick": "noemail", "password": "secret1", "fio": "Без Почты", "group": "9А"}); self.assertEqual(r.status, 400)
        r = await self.cl.post("/api/register", json={"nick": "badmail", "password": "secret1", "fio": "Без Почты", "group": "9А", "email": "no-at"}); self.assertEqual(r.status, 400)
        r = await self.cl.post("/api/register", json={"nick": "gater", "password": "secret1", "quick": True, "need_email": True}); self.assertEqual(r.status, 400)
        r = await self.cl.post("/api/register", json={"nick": "gater", "password": "secret1", "quick": True, "need_email": True, "email": "Gater@Mail.ru"}); self.assertEqual(r.status, 200)
        T = {"X-Teacher-Key": "teacher-secret"}
        # запрос восстановления: ответ одинаковый для существующего и несуществующего логина
        a = await (await self.cl.post("/api/recover", json={"login": "gater"})).json(); b = await (await self.cl.post("/api/recover", json={"login": "nobody"})).json(); self.assertEqual(a["msg"], b["msg"])
        d = await (await self.cl.get("/api/teacher/recov", headers=T)).json(); self.assertEqual(len(d["rows"]), 1); code = d["rows"][0]["code"]; self.assertEqual(len(code), 6)
        r = await self.cl.get("/api/teacher/recov"); self.assertEqual(r.status, 403)
        r = await self.cl.post("/api/recover/confirm", json={"nick": "gater", "code": "000000" if code != "000000" else "111111", "password": "newpass1"}); self.assertEqual(r.status, 400)
        r = await self.cl.post("/api/recover/confirm", json={"nick": "gater", "code": code, "password": "new"}); self.assertEqual(r.status, 400)
        r = await self.cl.post("/api/recover/confirm", json={"nick": "gater", "code": code, "password": "newpass1"}); self.assertEqual(r.status, 200)
        r = await self.cl.post("/api/login", json={"nick": "gater", "password": "newpass1"}); self.assertEqual(r.status, 200)
        r = await self.cl.post("/api/login", json={"nick": "gater", "password": "secret1"}); self.assertEqual(r.status, 401)
        r = await self.cl.post("/api/recover/confirm", json={"nick": "gater", "code": code, "password": "again123"}); self.assertEqual(r.status, 400)  # код одноразовый
        # вход и по почте тоже находит ученика
        await self.cl.post("/api/recover", json={"login": "gater@mail.ru"}); d = await (await self.cl.get("/api/teacher/recov", headers=T)).json(); self.assertEqual(len(d["rows"]), 1)

    async def test_submit_checked_on_server(self):
        st, d = await self.reg(); h = {"Authorization": "Bearer " + d["token"]}; T = {"X-Teacher-Key": "teacher-secret"}
        r = await self.cl.post("/api/submit", json={"id": "1.1", "code": "x"}); self.assertEqual(r.status, 401)
        r = await self.cl.post("/api/submit", json={"id": "9.9", "code": "print(1)"}, headers=h); self.assertEqual(r.status, 400)
        bad = await (await self.cl.post("/api/submit", json={"id": "1.1", "code": 'print("привет")', "meta": "v1;t=15;p=0;e=0"}, headers=h)).json(); self.assertEqual(bad["verdict"], "fail")
        good = await (await self.cl.post("/api/submit", json={"id": "1.1", "code": 'name = input()\ncity = input()\nprint(f"Меня зовут {name}, я из {city}")', "meta": "v1;t=70;p=0;e=0"}, headers=h)).json(); self.assertEqual(good["verdict"], "ok", good)
        me = await (await self.cl.get("/api/me", headers=h)).json(); self.assertIn("1.1", me["progress"]["passed"]); self.assertIn("1.1", me["progress"]["done"])
        rows = (await (await self.cl.get("/api/teacher/subs", headers=T)).json())["rows"]; self.assertEqual([x["status"] for x in rows], ["ok", "fail"]); self.assertEqual(rows[0]["nick"], "anya")
        r = await self.cl.get("/api/teacher/subs"); self.assertEqual(r.status, 403)
        c = await (await self.cl.get("/api/teacher/sub?id=%d" % rows[0]["id"], headers=T)).json(); self.assertIn("input()", c["code"])
        d = await (await self.cl.post("/api/submit", json={"id": "1.2", "code": "while True: pass", "meta": ""}, headers=h)).json(); self.assertEqual(d["verdict"], "fail")

    async def test_login_lockout_escalates(self):
        await self.reg(nick="lock1", pw="secret1"); A = self.A
        async def bad():
            r = await self.cl.post("/api/login", json={"nick": "lock1", "password": "wrong"}); return r.status, await r.json()
        for i in range(2):
            st, d = await bad(); self.assertEqual(st, 401); self.assertEqual(d["wait"], 0)
        st, d = await bad(); self.assertEqual(st, 401); self.assertEqual(d["wait"], 30)     # третья неудача: 30 секунд
        st, d = await bad(); self.assertEqual(st, 429); self.assertGreater(d["wait"], 0)    # во время блока даже верный пароль не пробуют
        r = await self.cl.post("/api/login", json={"nick": "lock1", "password": "secret1"}); self.assertEqual(r.status, 429)
        for k in list(A.FAILS):
            A.FAILS[k][1] = 0                                                                # блок прошёл
        waits = []
        for _ in range(5):                                                                   # 4-я, 5-я, 6-я, 7-я, 8-я неудачи
            for k in list(A.FAILS):
                A.FAILS[k][1] = 0                                                            # прошлый блок закончился
            st, d = await bad(); waits.append(d["wait"])
        self.assertEqual(waits, [30, 120, 120, 300, 300])                                    # 30 с, затем 2 минуты, затем потолок 5 минут
        for k in list(A.FAILS):
            A.FAILS[k][1] = 0
        r = await self.cl.post("/api/login", json={"nick": "lock1", "password": "secret1"}); self.assertEqual(r.status, 200)  # верный пароль сбрасывает счётчик
        st, d = await bad(); self.assertEqual(d["wait"], 0)

    async def test_lockout_does_not_hit_other_users(self):
        await self.reg(nick="victim", pw="secret1"); await self.reg(nick="friend", pw="secret1")
        for _ in range(5):
            await self.cl.post("/api/login", json={"nick": "victim", "password": "x"})
        r = await self.cl.post("/api/login", json={"nick": "friend", "password": "secret1"}); self.assertEqual(r.status, 200)  # другой ученик с того же Wi-Fi входит свободно

    async def test_class_can_register_from_one_ip(self):
        for i in range(30):
            r = await self.cl.post("/api/register", json={"nick": "kid%02d" % i, "password": "secret1", "quick": True, "email": "k%d@mail.ru" % i}); self.assertEqual(r.status, 200, i)

    async def test_mail_is_throttled(self):
        A = self.A; sent = []
        A.SMTP_HOST, A.SMTP_USER, A.SMTP_PASS, A.TEACHER_EMAIL = "smtp.test", "u", "p", "teacher@test.ru"; A.SMTP_FROM = "u"
        A._send_sync = lambda to, subj, text: sent.append((to, subj)); A.MAIL_LOG.clear(); A._teacher.update(last=0.0, pending=[], task=None)
        for i in range(12):
            await self.reg(nick="mm%02d" % i, pw="secret1", fio="Ученик %d" % i)
            await self.cl.post("/api/recover", json={"login": "mm%02d" % i}); await asyncio.sleep(0.05)
        await asyncio.sleep(0.3)
        self.assertLessEqual(len(sent), A.MAIL_PER_10MIN)                                    # за 10 минут не больше шести писем всего
        self.assertEqual(sum(1 for t, _ in sent if t == "teacher@test.ru"), 1)               # учителю одно письмо, остальное копится
        self.assertGreaterEqual(len(A._teacher["pending"]), 5)
        d = await (await self.cl.get("/api/teacher/recov", headers={"X-Teacher-Key": "teacher-secret"})).json(); self.assertEqual(len(d["rows"]), 12)  # коды всё равно видны учителю
        # один и тот же адрес не засыпаем письмами
        A.MAIL_LOG.clear(); self.assertTrue(A.mail_allowed("x@y.ru")); A.MAIL_LOG.extend([(time.time(), "x@y.ru")] * 2); self.assertFalse(A.mail_allowed("x@y.ru")); self.assertTrue(A.mail_allowed("z@y.ru"))

    async def test_lucky_roulette(self):
        A = self.A; T = {"X-Teacher-Key": "teacher-secret"}; A.LUCKY.update(next=time.time() + 99999); A.LK.clear(); A.ONLINE.clear()
        h1, h2 = await self.race_user("счастливчик"), await self.race_user("другой")
        for h in (h1, h2):
            d = await (await self.cl.get("/api/play", headers=h)).json(); self.assertNotIn("lucky", d)
        d = await (await self.cl.get("/api/play")).json(); self.assertNotIn("lucky", d)                    # без входа ничего не показываем
        r = await self.cl.post("/api/teacher/play", json={"action": "lucky", "nick": "счастливчик"}, headers=T); self.assertEqual((await r.json())["lucky_nick"], "счастливчик")
        d1 = await (await self.cl.get("/api/play", headers=h1)).json(); d2 = await (await self.cl.get("/api/play", headers=h2)).json()
        self.assertIn("lucky", d1); self.assertNotIn("lucky", d2)                                          # рулетка только у одного
        r = await self.cl.post("/api/lucky/spin", json={}, headers=h2); self.assertEqual(r.status, 403)
        A.LCFG["odds"] = 1.0
        d = await (await self.cl.post("/api/lucky/spin", json={}, headers=h1)).json(); self.assertTrue(d["win"]); self.assertEqual(d["reels"], ["skull"] * 3); tok = d["token"]
        r = await self.cl.post("/api/lucky/spin", json={}, headers=h1); self.assertEqual(r.status, 403)    # крутить можно один раз
        d = await (await self.cl.get("/api/play", headers=h1)).json(); self.assertNotIn("lucky", d)
        r = await self.cl.post("/api/lucky/finish", json={"win": True, "token": "bad"}, headers=h1); self.assertEqual(r.status, 403)
        d = await (await self.cl.post("/api/lucky/finish", json={"win": True, "token": tok}, headers=h1)).json(); self.assertFalse(d["five"])    # слишком быстро: подделка
        r = await self.cl.post("/api/lucky/finish", json={"win": True, "token": tok}, headers=h1); self.assertEqual(r.status, 403)                 # попытка одна
        # победа за нормальное время
        A.lucky_pick(nick="счастливчик"); d = await (await self.cl.post("/api/lucky/spin", json={}, headers=h1)).json(); [e.update(t0=e["t0"] - 30) for e in A.LK.values()]
        d = await (await self.cl.post("/api/lucky/finish", json={"win": True, "token": d["token"]}, headers=h1)).json(); self.assertTrue(d["five"]); self.assertEqual(d["nick"], "счастливчик")
        # проигрыш сжигает оценку
        A.lucky_pick(nick="другой"); A.LCFG["odds"] = 1.0; d = await (await self.cl.post("/api/lucky/spin", json={}, headers=h2)).json(); [e.update(t0=e["t0"] - 30) for e in A.LK.values()]
        d = await (await self.cl.post("/api/lucky/finish", json={"win": False, "token": d["token"]}, headers=h2)).json(); self.assertFalse(d["five"])
        # без черепов: игры не будет
        A.LCFG["odds"] = 0.0; A.lucky_pick(nick="другой"); d = await (await self.cl.post("/api/lucky/spin", json={}, headers=h2)).json(); self.assertFalse(d["win"]); self.assertNotEqual(d["reels"], ["skull"] * 3); self.assertEqual(d["token"], "")
        rows = (await (await self.cl.get("/api/teacher/lucky", headers=T)).json())["rows"]
        self.assertEqual(sorted(r["kind"] for r in rows), ["burned", "burned", "five", "no-skulls"])
        r = await self.cl.get("/api/teacher/lucky"); self.assertEqual(r.status, 403)

    async def test_lucky_no_limits_reset_cfg(self):
        A = self.A; T = {"X-Teacher-Key": "teacher-secret"}; A.LUCKY.update(next=time.time() + 99999); A.LK.clear(); A.ONLINE.clear()
        h1, h2, h3 = await self.race_user("pl_1"), await self.race_user("pl_2"), await self.race_user("pl_3")
        for h in (h1, h2, h3): await self.cl.get("/api/play", headers=h)
        play = lambda body: self.cl.post("/api/teacher/play", json=body, headers=T)
        # сразу у нескольких: всем онлайн
        d = await (await play({"action": "lucky", "everyone": True})).json(); self.assertEqual(sorted(d["lucky_nicks"]), ["pl_1", "pl_2", "pl_3"])
        for h in (h1, h2, h3):
            self.assertIn("lucky", await (await self.cl.get("/api/play", headers=h)).json())
        # случайные двое
        A.LK.clear(); d = await (await play({"action": "lucky", "count": 2})).json(); self.assertEqual(len(d["lucky_nicks"]), 2)
        # неограниченные повторы одному и тому же ученику
        A.LCFG["odds"] = 0.0
        for _ in range(4):
            await play({"action": "lucky", "nick": "pl_1"}); d = await (await self.cl.post("/api/lucky/spin", json={}, headers=h1)).json(); self.assertTrue(d["ok"])
        # сброс отменяет активные рулетки
        await play({"action": "lucky", "everyone": True})
        for h in (h1, h2, h3): self.assertIn("lucky", await (await self.cl.get("/api/play", headers=h)).json())
        await play({"action": "lucky_reset"})
        for h in (h1, h2, h3): self.assertNotIn("lucky", await (await self.cl.get("/api/play", headers=h)).json())
        # сброс вместе с историей
        self.assertGreater(len((await (await self.cl.get("/api/teacher/lucky", headers=T)).json())["rows"]), 0)
        await play({"action": "lucky_reset", "history": True}); self.assertEqual((await (await self.cl.get("/api/teacher/lucky", headers=T)).json())["rows"], [])
        # настройки: шанс, окно, автовыбор (с зажатием в границы)
        d = await (await play({"action": "lucky_cfg", "odds": 5, "window": 5, "auto": False, "every_min": 120, "every_max": 240})).json()
        self.assertEqual((d["cfg"]["odds"], d["cfg"]["window"], d["cfg"]["auto"]), (1.0, 30, False))
        A.LUCKY.update(next=0); A.lucky_tick(); self.assertEqual(len(A.LK), 0)                    # автовыбор выключен
        r = await self.cl.post("/api/teacher/play", json={"action": "lucky_cfg", "odds": 0.1}); self.assertEqual(r.status, 403)
        d = await (await play({"action": "lucky", "nick": "нет такого"})).json(); self.assertFalse(d["ok"])

    async def test_scare(self):
        A = self.A; T = {"X-Teacher-Key": "teacher-secret"}; A.ONLINE.clear(); A.LUCKY.update(next=time.time() + 99999)
        h1, h2 = await self.race_user("sc_1"), await self.race_user("sc_2")
        await self.cl.get("/api/play", headers=h1); await self.cl.get("/api/play", headers=h2)
        r = await self.cl.post("/api/teacher/play", json={"action": "scare", "nick": "sc_1"}); self.assertEqual(r.status, 403)
        d = await (await self.cl.post("/api/teacher/play", json={"action": "scare", "nick": "sc_1", "kind": "bunny"}, headers=T)).json(); self.assertEqual(d["scare_nick"], "sc_1")
        d1 = await (await self.cl.get("/api/play", headers=h1)).json(); d2 = await (await self.cl.get("/api/play", headers=h2)).json()
        self.assertEqual(d1["scare"]["kind"], "bunny"); self.assertNotIn("scare", d2)
        d1 = await (await self.cl.get("/api/play", headers=h1)).json(); self.assertNotIn("scare", d1)       # показывается один раз
        d = await (await self.cl.post("/api/teacher/play", json={"action": "scare", "kind": "что-то"}, headers=T)).json(); self.assertIn(d["scare_nick"], ("sc_1", "sc_2"))
        got = [await (await self.cl.get("/api/play", headers=h)).json() for h in (h1, h2)]
        self.assertEqual(sum("scare" in g for g in got), 1); self.assertIn([g for g in got if "scare" in g][0]["scare"]["kind"], A.SCARE_KINDS)
        d = await (await self.cl.post("/api/teacher/play", json={"action": "scare", "nick": "нет"}, headers=T)).json(); self.assertFalse(d["ok"])

    async def test_boss_settings(self):
        A = self.A; T = {"X-Teacher-Key": "teacher-secret"}; A.BOSS.reset(); A.BOSS.cfg.update(A.B.DEFAULT_CFG)
        play = lambda body: self.cl.post("/api/teacher/play", json=body, headers=T)
        await play({"action": "boss_announce"}); h1 = await self.race_user("bos_1"); await self.cl.post("/api/boss/join", json={}, headers=h1)
        d = await (await play({"action": "boss_start"})).json(); self.assertEqual(d["hpmax"], 8000)           # 1 игрок × 8000, минимума 40 000 больше нет
        await play({"action": "boss_stop"}); await play({"action": "boss_announce"}); await self.cl.post("/api/boss/join", json={}, headers=h1)
        d = await (await play({"action": "boss_start", "hp": 500, "dmg_easy": 250, "heal_easy": 5, "stun": 0, "min_think": 0, "answer_gap": 0, "big_heal": 0})).json()
        self.assertEqual((d["hpmax"], d["hp"], d["cfg"]["dmg_easy"], d["cfg"]["stun"]), (500, 500, 250, 0))
        uid = list(A.BOSS.players)[0]
        d = await (await self.cl.post("/api/boss/ask", json={"lvl": "easy"}, headers=h1)).json()
        d = await (await self.cl.post("/api/boss/answer", json={"a": A.BOSS.players[uid]["q"]["ok"]}, headers=h1)).json(); self.assertEqual(d["dmg"], 250)
        # правка на ходу: здоровье, полное лечение, настройки
        d = await (await play({"action": "boss_cfg", "hpmax": 2000, "hp_now": 1500, "dmg_easy": 10})).json(); self.assertEqual((d["hpmax"], d["hp"], d["cfg"]["dmg_easy"]), (2000, 1500, 10))
        d = await (await play({"action": "boss_cfg", "heal_full": True})).json(); self.assertEqual(d["hp"], 2000)
        d = await (await play({"action": "boss_cfg", "dmg_easy": -5, "stun": 9999, "hp_per": "мусор"})).json(); self.assertEqual((d["cfg"]["dmg_easy"], d["cfg"]["stun"], d["cfg"]["hp_per"]), (1, 60, 8000))  # границы
        d = await (await play({"action": "boss_cfg", "hp_now": 0})).json(); self.assertEqual((d["phase"], d["won"]), ("end", True))               # HP 0 = босс повержен
        # настройки переживают «Выключить игру»
        await play({"action": "boss_reset"}); self.assertEqual(A.BOSS.cfg["dmg_easy"], 1)

    async def test_lucky_schedule(self):
        A = self.A; A.ONLINE.clear(); A.LUCKY.update(next=0); A.LK.clear()
        h = await self.race_user("online1"); d = await (await self.cl.get("/api/play", headers=h)).json()
        self.assertIn("lucky", d); self.assertGreater(A.LUCKY["next"], time.time() + 3000)                   # следующий раз через 1–2 часа
        A.LK.clear(); A.LUCKY.update(next=0); A.ONLINE.clear(); A.lucky_tick(); self.assertLess(A.LUCKY["next"], time.time() + 200)   # некого выбирать: повтор через пару минут

if __name__ == "__main__":
    unittest.main()
