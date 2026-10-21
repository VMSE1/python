"""Тесты песочницы check.py: чужой код не должен ходить в сеть, запускать программы и писать вне временной папки.
Запуск: python -m unittest tests.test_sandbox -v   (из корня репозитория)"""
import glob, os, sys, tempfile, unittest, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import check


def run(code, stdin=()):
    d = tempfile.mkdtemp()
    p = os.path.join(d, "s.py")
    with open(p, "w", encoding="utf-8") as f:
        f.write(code)
    return check.run_program(p, list(stdin))


class Attacks(unittest.TestCase):
    def blocked(self, code, word=""):
        out, err, _ = run(code)
        self.assertTrue(err, "ожидали ошибку, а программа отработала: %r" % out)
        self.assertNotIn("OK-ATTACK", out or "")
        if word:
            self.assertIn(word, err)

    def test_socket(self): self.blocked('import socket\ns=socket.socket();s.connect(("1.1.1.1",80));print("OK-ATTACK")', "socket")
    def test_urllib(self): self.blocked('import urllib.request\nurllib.request.urlopen("http://example.com");print("OK-ATTACK")')
    def test_asyncio_net(self): self.blocked('import asyncio\nprint("OK-ATTACK")')
    def test_subprocess(self): self.blocked('import subprocess\nprint("OK-ATTACK")', "subprocess")
    def test_os_system(self): self.blocked('import os\nos.system("id")\nprint("OK-ATTACK")')
    def test_popen(self): self.blocked('import os\nprint(os.popen("id").read(),"OK-ATTACK")')
    def test_fork(self): self.blocked('import os\nos.fork()\nprint("OK-ATTACK")')
    def test_exec(self): self.blocked('import os\nos.execv("/bin/id",["id"])\nprint("OK-ATTACK")')
    def test_kill_parent(self): self.blocked('import os,signal\nos.kill(os.getppid(),signal.SIGKILL)\nprint("OK-ATTACK")')
    def test_ctypes(self): self.blocked('import ctypes\nprint("OK-ATTACK")', "ctypes")
    def test_dynamic_import(self): self.blocked('m=__import__("sock"+"et")\nprint("OK-ATTACK")')
    def test_importlib(self): self.blocked('import importlib\nimportlib.import_module("subprocess")\nprint("OK-ATTACK")')
    def test_write_outside(self): self.blocked('open("/tmp/__evil.txt","w").write("x")\nprint("OK-ATTACK")', "временную")
    def test_write_pathlib(self): self.blocked('import pathlib\npathlib.Path("/tmp/__evil2.txt").write_text("x")\nprint("OK-ATTACK")')
    def test_os_open_outside(self): self.blocked('import os\nos.open("/tmp/__evil3.txt",os.O_WRONLY|os.O_CREAT)\nprint("OK-ATTACK")')
    def test_remove_outside(self): self.blocked('import os\nos.remove("/tmp/sub/out.txt")\nprint("OK-ATTACK")')
    def test_symlink(self): self.blocked('import os\nos.symlink("/etc/passwd","l")\nprint("OK-ATTACK")')
    def test_read_proc(self): self.blocked('print(open("/proc/self/environ").read(),"OK-ATTACK")')
    def test_read_home(self):
        self.blocked('import os\nprint(open("/home/"+os.listdir("/home")[0]+"/.bashrc").read(),"OK-ATTACK")')

    def test_no_leak_files(self):
        self.assertFalse(os.path.exists("/tmp/__evil.txt") or os.path.exists("/tmp/__evil2.txt") or os.path.exists("/tmp/__evil3.txt"))


class Limits(unittest.TestCase):
    def test_infinite_loop(self):
        t = time.time(); out, err, _ = run("while True: pass")
        self.assertIn("не завершилась", err); self.assertLess(time.time() - t, check.TIMEOUT + 4)

    def test_output_bomb(self):
        t = time.time(); out, err, _ = run('while True: print("x"*1000)')
        self.assertTrue(err); self.assertLess(len(out or ""), check.MAX_OUT + 1); self.assertLess(time.time() - t, check.TIMEOUT + 4)

    def test_memory_bomb(self):
        out, err, _ = run("a=[0]*(10**10)\nprint('x')")
        self.assertTrue(err)

    def test_thread_bomb(self):
        t = time.time(); out, err, _ = run("import threading,time\nfor i in range(100000): threading.Thread(target=time.sleep,args=(10,)).start()")
        self.assertLess(time.time() - t, check.TIMEOUT + 6)


class Legit(unittest.TestCase):
    def test_input_print(self):
        out, err, _ = run('n=input()\nprint("Привет,", n)', ["Аня"])
        self.assertEqual((out.strip(), err), ("Привет, Аня", ""))

    def test_files_in_workdir(self):
        out, err, _ = run('open("a.txt","w",encoding="utf-8").write("мир")\nprint(open("a.txt",encoding="utf-8").read())')
        self.assertEqual((out.strip(), err), ("мир", ""))

    def test_exception_message(self):
        out, err, _ = run('int("abc")')
        self.assertIn("ValueError", err)

    def test_stdlib(self):
        out, err, _ = run("import math, random, json, datetime, collections, re\nprint(math.sqrt(16))")
        self.assertEqual((out.strip(), err), ("4.0", ""))

    def test_tasks_found(self):
        self.assertGreaterEqual(len(check.load_tasks()), 25)


if __name__ == "__main__":
    unittest.main()


class TestLenient(unittest.TestCase):
    def test_text(self):
        import check as c
        self.assertTrue(c.has_text("Среднее:\t3.5 \n", "среднее: 3,5"))
        self.assertTrue(c.has_text("Ёлка  растёт", "елка растет"))
        self.assertTrue(c.has_text("Результат 3.3333333", "3.33"))
        self.assertTrue(c.has_text("x = 3.34", "3.33"))
        self.assertFalse(c.has_text("x = 3.5", "3.33"))
        self.assertFalse(c.has_text("Привет", "Пока"))

    def test_same(self):
        import check as c
        self.assertTrue(c.same(2.504, 2.5))
        self.assertTrue(c.same("a  b", "a b"))
        self.assertFalse(c.same("ПРИВЕТ", "привет"))
        self.assertTrue(c.same([1, 2.001], [1, 2.0]))
        self.assertFalse(c.same(3, 4))
