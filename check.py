#!/usr/bin/env python3
"""Автопроверка заданий Python-курса.

Запуск:
    python check.py          проверить все задания
    python check.py 2        проверить урок 2
    python check.py 2.4      проверить одно задание
    python check.py 2.4 --file мой_файл.py   проверить другой файл вместо файла из папки задания
    python check.py --list   список заданий

Задания находятся автоматически: каждая папка lessons/*/*/ с файлом task.json — одно задание.

Статусы: OK — задание решено, FAIL — есть ошибки, -- — ещё не начато.
Работает без установки дополнительных библиотек (нужен только Python 3.8+).
"""
import json
import os
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
TIMEOUT = 5

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def norm(text):
    """Нормализация вывода: без регистра, лишних пробелов и пустых строк."""
    return " ".join(str(text).casefold().split())


def read_text(path):
    with open(path, "rb") as f:
        return f.read().decode("utf-8-sig").replace("\r\n", "\n").strip()


def same_text(a, b):
    return [ln.rstrip() for ln in a.strip().splitlines()] == [ln.rstrip() for ln in b.strip().splitlines()]


# --- Песочница для чужого кода -------------------------------------------------
# Код ученика запускается отдельным процессом с ограничениями: без сети и запуска программ,
# запись только во временную папку, лимиты по времени, памяти и размеру вывода.
# Это защита «для школы», а не абсолютная изоляция: сам запуск идёт на чистой виртуальной машине GitHub.
GUARD = r"""
import sys, os, json, runpy, importlib.util, builtins
mode, src = sys.argv[1], sys.argv[2]
work = os.path.realpath(os.getcwd())
allow_read = {os.path.realpath(src)}
deny_read = ("/proc", "/sys", "/home", "/root", "/run", "/var", "/mnt", "/boot", "/etc/shadow", "/etc/sudoers")
bad_import = {"ctypes", "_ctypes", "socket", "_socket", "subprocess", "_posixsubprocess", "multiprocessing",
              "pty", "ftplib", "smtplib", "telnetlib", "poplib", "imaplib", "webbrowser", "urllib.request",
              "http.client", "http.server", "socketserver", "xmlrpc", "asyncio.subprocess", "_winapi"}
bad_events = ("subprocess.", "socket.", "ctypes.", "os.system", "os.exec", "os.posix_spawn", "os.spawn",
              "os.fork", "os.forkpty", "os.kill", "os.killpg", "os.setuid", "os.setgid", "os.chroot",
              "os.startfile", "winreg.", "webbrowser.", "pty.", "shutil.chown")
write_events = {"os.remove", "os.rename", "os.rmdir", "os.mkdir", "os.chmod", "os.link", "os.symlink",
                "os.truncate", "os.utime", "os.replace", "shutil.copyfile", "shutil.copytree", "shutil.move",
                "shutil.rmtree", "os.mkfifo", "os.mknod", "os.chown"}
WFLAGS = os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_APPEND | os.O_TRUNC
def inside(p):
    try:
        p = os.path.realpath(os.fsdecode(p))
    except Exception:
        return False
    return p == work or p.startswith(work + os.sep) or p == os.devnull
def hook(ev, args):
    if ev == "import":
        n = args[0]
        if n in bad_import or n.split(".")[0] in ("ctypes", "_ctypes", "socket", "subprocess", "multiprocessing"):
            raise ImportError("модуль «%s» запрещён в проверке" % n)
    elif ev == "open":
        path, m, fl = args[0], args[1], args[2]
        if isinstance(path, int):
            return
        w = bool(fl & WFLAGS) if isinstance(fl, int) else False
        if m and any(c in str(m) for c in "wax+"):
            w = True
        if w:
            if not inside(path):
                raise PermissionError("запись разрешена только во временную папку проверки")
        else:
            rp = os.path.realpath(os.fsdecode(path))
            if rp in allow_read or rp.startswith(work):
                return
            if rp.startswith(deny_read):
                raise PermissionError("чтение этого пути запрещено")
    elif ev.startswith(bad_events):
        raise PermissionError("действие «%s» запрещено в проверке" % ev)
    elif ev in write_events:
        for a in args[:2]:
            if isinstance(a, (str, bytes, os.PathLike)) and not inside(a):
                raise PermissionError("запись разрешена только во временную папку проверки")
sys.addaudithook(hook)
if mode == "prog":
    sys.argv = [src]
    runpy.run_path(src, run_name="__main__")
else:
    builtins.input = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("input() вызван при импорте"))
    spec = importlib.util.spec_from_file_location("student", src)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    out = []
    for call in json.loads(sys.argv[3]):
        try:
            res = getattr(mod, sys.argv[4])(*call)
            out.append({"ok": True, "value": res})
        except Exception as e:
            out.append({"ok": False, "error": type(e).__name__ + ": " + str(e)})
    print("@@RESULT@@" + json.dumps(out, ensure_ascii=False, default=repr))
"""

MAX_OUT = 200_000


def _limits():
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (TIMEOUT + 2, TIMEOUT + 2))
        resource.setrlimit(resource.RLIMIT_AS, (1 << 30, 1 << 30))
        resource.setrlimit(resource.RLIMIT_FSIZE, (2_000_000, 2_000_000))
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    except Exception:
        pass


def sandbox(args, workdir, stdin=""):
    """Запустить python в песочнице. Возвращает (код, stdout, stderr) или бросает TimeoutExpired."""
    env = {"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "LANG": "C.UTF-8", "PATH": "/usr/bin:/bin"}
    if os.name == "nt":
        env["SYSTEMROOT"] = os.environ.get("SYSTEMROOT", "")
    with tempfile.TemporaryFile() as fo, tempfile.TemporaryFile() as fe:
        kw = {"preexec_fn": _limits} if os.name == "posix" else {}
        p = subprocess.run([sys.executable, "-I", "-c", GUARD] + args, input=stdin.encode("utf-8"),
                           stdout=fo, stderr=fe, timeout=TIMEOUT, cwd=workdir, env=env, **kw)
        fo.seek(0); fe.seek(0)
        return p.returncode, fo.read(MAX_OUT).decode("utf-8", "replace"), fe.read(MAX_OUT).decode("utf-8", "replace")


def run_program(path, stdin):
    workdir = tempfile.mkdtemp()
    src = os.path.abspath(path)
    try:
        code, out, errs = sandbox(["prog", src], workdir, "\n".join(stdin) + "\n" if stdin else "")
    except subprocess.TimeoutExpired:
        return None, "Программа не завершилась за %d с. Возможно, бесконечный цикл или лишний input()." % TIMEOUT, workdir
    err = ""
    if code != 0:
        if code < 0:
            err = "программа остановлена: превышен лимит времени, памяти или размера вывода"
        else:
            lines = [ln for ln in errs.strip().splitlines() if ln.strip()]
            err = lines[-1] if lines else "ошибка выполнения"
    return out, err, workdir


def run_function(path, func, calls):
    workdir = tempfile.mkdtemp()
    try:
        code, out, errs = sandbox(["func", os.path.abspath(path), json.dumps(calls), func], workdir)
    except subprocess.TimeoutExpired:
        return None, "Функция не завершилась за %d с." % TIMEOUT
    if "@@RESULT@@" not in out:
        lines = [ln for ln in errs.strip().splitlines() if ln.strip()]
        return None, (lines[-1] if lines else "не удалось загрузить файл")
    return json.loads(out.split("@@RESULT@@")[1]), ""


def same(a, b):
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) < 1e-9
        except Exception:
            return False
    return a == b


def check_task(task, file_override=None):
    path = file_override or os.path.join(task["_dir"], task["file"])
    result = {"id": task["id"], "title": task["title"], "status": "fail", "messages": []}
    if not os.path.exists(path):
        result["messages"].append("Файл %s не найден." % path)
        return result
    if task.get("starter") is not None and same_text(read_text(path), task["starter"]):
        result["status"] = "todo"
        return result
    problems = []
    for call_spec in task.get("funcs", []):
        res, err = run_function(path, call_spec["name"], [c["args"] for c in call_spec["calls"]])
        if res is None:
            problems.append("Функция %s: %s" % (call_spec["name"], err))
            continue
        for c, item in zip(call_spec["calls"], res):
            shown = "%s(%s)" % (call_spec["name"], ", ".join(repr(a) for a in c["args"]))
            if not item["ok"]:
                problems.append("%s вызвала ошибку: %s" % (shown, item["error"]))
            elif not same(item["value"], c["expect"]):
                problems.append("%s вернула %r, а нужно %r" % (shown, item["value"], c["expect"]))
    for case in task.get("cases", []):
        out, err, workdir = run_program(path, case.get("stdin", []))
        inp = ", ".join(case.get("stdin", [])) or "(без ввода)"
        if out is None:
            problems.append("Ввод [%s]: %s" % (inp, err))
            continue
        if err:
            problems.append("Ввод [%s]: программа упала: %s" % (inp, err))
            continue
        n = norm(out)
        for m in case.get("must", []):
            if norm(m) not in n:
                problems.append("Ввод [%s]: в выводе должно быть «%s»" % (inp, m))
        for m in case.get("must_not", []):
            if norm(m) in n:
                problems.append("Ввод [%s]: в выводе не должно быть «%s»" % (inp, m))
        for fname, expected in case.get("files", {}).items():
            fp = os.path.join(workdir, fname)
            if not os.path.exists(fp):
                problems.append("Ввод [%s]: программа должна создать файл %s" % (inp, fname))
            else:
                with open(fp, encoding="utf-8") as f:
                    got = [ln.strip() for ln in f.read().splitlines() if ln.strip()]
                if got != expected:
                    problems.append("Файл %s: ожидали %r, получили %r" % (fname, expected, got))
    result["status"] = "ok" if not problems else "fail"
    result["messages"] = problems[:6]
    return result


def load_tasks():
    tasks = []
    for d, _dirs, files in os.walk(os.path.join(ROOT, "lessons")):
        if "task.json" in files:
            with open(os.path.join(d, "task.json"), encoding="utf-8") as f:
                t = json.load(f)
            t["_dir"] = d
            tasks.append(t)
    def key(t):
        return [int(x) if x.isdigit() else 0 for x in t["id"].split(".")]
    return sorted(tasks, key=key)


def main():
    tasks = load_tasks()
    argv = sys.argv[1:]
    override = None
    if "--file" in argv:
        i = argv.index("--file")
        override = argv[i + 1] if i + 1 < len(argv) else None
        del argv[i:i + 2]
    args = [a for a in argv if not a.startswith("--")]
    if "--list" in argv:
        for t in tasks:
            print("%-5s %s" % (t["id"], t["title"]))
        return 0
    if args:
        sel = args[0]
        tasks = [t for t in tasks if t["id"] == sel or t["id"].split(".")[0] == sel]
        if not tasks:
            print("Нет такого урока или задания: %s. Список: python check.py --list" % sel)
            return 2
    if override and len(tasks) != 1:
        print("--file работает только с одним заданием, например: python check.py 2.4 --file мой.py")
        return 2
    results = [check_task(t, override) for t in tasks]
    icons = {"ok": "[ OK ]", "fail": "[FAIL]", "todo": "[ -- ]"}
    for r in results:
        print("%s %s  %s" % (icons[r["status"]], r["id"], r["title"]))
        for m in r["messages"]:
            print("         - " + m)
    ok = sum(r["status"] == "ok" for r in results)
    fail = sum(r["status"] == "fail" for r in results)
    todo = sum(r["status"] == "todo" for r in results)
    print("\nИтого: решено %d, с ошибками %d, не начато %d (всего %d)." % (ok, fail, todo, len(results)))
    if "--json" in argv:
        with open(os.path.join(ROOT, "results.json"), "w", encoding="utf-8") as f:
            json.dump({"time": time.strftime("%Y-%m-%d %H:%M:%S"), "results": results}, f, ensure_ascii=False, indent=1)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("## Результаты автопроверки\n\n| Задание | Статус | Замечания |\n|---|---|---|\n")
            em = {"ok": "✅ решено", "fail": "❌ ошибки", "todo": "⬜ не начато"}
            for r in results:
                f.write("| %s %s | %s | %s |\n" % (r["id"], r["title"], em[r["status"]], "<br>".join(r["messages"]).replace("|", "/")))
            f.write("\n**Решено %d из %d.**\n" % (ok, len(results)))
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
