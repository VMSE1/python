#!/usr/bin/env python3
"""Собирает раздел ЕГЭ (subjects/ege/topics.json) в docs/data/ege.js.

Запуск из корня репозитория:
  python tools/ege.py          — собрать
  python tools/ege.py --check  — только проверить эталоны
Эталонные решения на сайт не попадают: туда идёт только ожидаемый вывод (по строкам).
"""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "subjects", "ege", "topics.json")
OUT = os.path.join(ROOT, "docs", "data", "ege.js")


def run_ref(code, stdin):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "ref.py")
        open(p, "w", encoding="utf-8").write(code)
        r = subprocess.run([sys.executable, "-I", p], input="\n".join(stdin) + "\n", capture_output=True, text=True, timeout=10, cwd=d)
    if r.returncode:
        raise RuntimeError(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "ошибка")
    return [l.rstrip() for l in r.stdout.strip().splitlines() if l.strip()]


def main(check=False):
    data = json.load(open(SRC, encoding="utf-8"))
    errors, ids = [], set()
    for t in data["topics"]:
        for k in t["tasks"]:
            if k["id"] in ids:
                errors.append("повтор id " + k["id"])
            ids.add(k["id"])
            cases = []
            for inp in k["inputs"]:
                try:
                    out = run_ref(k["ref"], inp)
                except Exception as e:
                    errors.append("%s: эталон упал на %r: %s" % (k["id"], inp, e)); continue
                if not out:
                    errors.append("%s: пустой вывод на %r" % (k["id"], inp)); continue
                cases.append({"stdin": inp, "must": out})
            if len(k["inputs"]) and len(cases) != len(k["inputs"]):
                continue
            if k["starter"].strip() == k["ref"].strip():
                errors.append(k["id"] + ": заготовка совпадает с эталоном")
            k["cases"] = cases
            del k["ref"], k["inputs"]
    if errors:
        print("\n".join(errors)); sys.exit(1)
    n = sum(len(t["tasks"]) for t in data["topics"])
    if check or "--check" in sys.argv:
        print("ЕГЭ: тем %d, заданий %d, эталоны проходят" % (len(data["topics"]), n)); return
    open(OUT, "w", encoding="utf-8").write("/* Собрано tools/ege.py из subjects/ege/topics.json. Не править руками. */\nvar EGE = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("ЕГЭ: тем %d, заданий %d -> docs/data/ege.js" % (len(data["topics"]), n))


if __name__ == "__main__":
    main()
