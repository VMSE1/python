"""Проверка сервера: регистрация, вход, прогресс, живая викторина, облако слов. Запуск: python3 -m unittest tests.test_server"""
import asyncio, json, os, sys, tempfile, unittest

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
        r = await self.cl.post("/api/register", json={"nick": nick, "password": pw, "fio": fio, "group": grp}); return r.status, await r.json()

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

if __name__ == "__main__":
    unittest.main()
