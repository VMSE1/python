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


def run_program(path, stdin):
    workdir = tempfile.mkdtemp()
    src = os.path.abspath(path)
    try:
        r = subprocess.run([sys.executable, src], input="\n".join(stdin) + "\n" if stdin else "",
                           capture_output=True, text=True, timeout=TIMEOUT, cwd=workdir, encoding="utf-8")
    except subprocess.TimeoutExpired:
        return None, "Программа не завершилась за %d с. Возможно, бесконечный цикл или лишний input()." % TIMEOUT, workdir
    err = ""
    if r.returncode != 0:
        lines = [ln for ln in r.stderr.strip().splitlines() if ln.strip()]
        err = lines[-1] if lines else "ошибка выполнения"
    return r.stdout, err, workdir


HARNESS = r"""
import importlib.util, json, sys, builtins
builtins.input = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("input() вызван при импорте"))
spec = importlib.util.spec_from_file_location("student", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
out = []
for call in json.loads(sys.argv[2]):
    try:
        res = getattr(mod, sys.argv[3])(*call)
        out.append({"ok": True, "value": res})
    except Exception as e:
        out.append({"ok": False, "error": type(e).__name__ + ": " + str(e)})
print("@@RESULT@@" + json.dumps(out, ensure_ascii=False, default=repr))
"""


def run_function(path, func, calls):
    workdir = tempfile.mkdtemp()
    try:
        r = subprocess.run([sys.executable, "-c", HARNESS, os.path.abspath(path), json.dumps(calls), func],
                           capture_output=True, text=True, timeout=TIMEOUT, cwd=workdir, encoding="utf-8")
    except subprocess.TimeoutExpired:
        return None, "Функция не завершилась за %d с." % TIMEOUT
    if "@@RESULT@@" not in r.stdout:
        lines = [ln for ln in r.stderr.strip().splitlines() if ln.strip()]
        return None, (lines[-1] if lines else "не удалось загрузить файл")
    return json.loads(r.stdout.split("@@RESULT@@")[1]), ""


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
