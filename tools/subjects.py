#!/usr/bin/env python3
"""Собирает уроки других предметов (SQL, Blender, нейросети) в docs/data/subjects.js и проверяет их.

Запуск из корня репозитория:
  python tools/subjects.py          — собрать docs/data/subjects.js
  python tools/subjects.py --check  — только проверить уроки (эталонные SQL-запросы, ответы квизов)
Урок — файл subjects/<предмет>/lessonN.json, описание предмета — subjects/<предмет>/subject.json.
Эталонные решения SQL на сайт не попадают: туда идёт только ожидаемый результат запроса.
"""
import glob, json, os, re, sqlite3, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDIR = os.path.join(ROOT, "subjects")
ORDER = ["sql", "blender", "ai"]
TYPES = {"sql", "quiz", "steps", "keys", "neuron"}
MAX_ROWS = 200


def split_sql(src):
    out, buf = [], ""
    for ch in src:
        buf += ch
        if ch == ";" and sqlite3.complete_statement(buf):
            if buf.strip(" \n\t;"):
                out.append(buf.strip())
            buf = ""
    if buf.strip(" \n\t;"):
        out.append(buf.strip())
    return out


def run(seed, sql, verify=None):
    """Тот же порядок, что и в браузере (docs/runner/sqlworker.js): база с нуля, команды по очереди, затем проверочный запрос."""
    con = sqlite3.connect(":memory:")
    con.executescript(seed)
    cols, rows = None, None
    for st in split_sql(sql):
        cur = con.execute(st)
        if cur.description:
            cols, rows = [d[0] for d in cur.description], cur.fetchall()
    if verify:
        cur = con.execute(verify)
        cols, rows = [d[0] for d in cur.description], cur.fetchall()
    return {"cols": cols or [], "rows": [list(r) for r in (rows or [])][:MAX_ROWS]}


def schema(seed):
    con = sqlite3.connect(":memory:")
    con.executescript(seed)
    out = []
    for (name,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY rowid"):
        cols = [[r[1], r[2]] for r in con.execute("PRAGMA table_info(%s)" % name)]
        n = con.execute("SELECT COUNT(*) FROM %s" % name).fetchone()[0]
        cur = con.execute("SELECT * FROM %s LIMIT 6" % name)
        out.append({"name": name, "cols": cols, "count": n, "preview": [list(r) for r in cur.fetchall()]})
    return out


def load(errors):
    subjects = {}
    for sid in ORDER:
        d = os.path.join(SDIR, sid)
        if not os.path.isdir(d):
            continue
        meta = json.load(open(os.path.join(d, "subject.json"), encoding="utf-8"))
        lessons, dbs = [], {}
        files = sorted(glob.glob(os.path.join(d, "lesson*.json")), key=lambda p: int(re.findall(r"\d+", os.path.basename(p))[0]))
        for p in files:
            n = int(re.findall(r"\d+", os.path.basename(p))[0])
            L = json.load(open(p, encoding="utf-8"))
            where = "%s/%s" % (sid, os.path.basename(p))
            out = {"n": n, "title": L["title"], "goal": L.get("goal", ""), "theory": L.get("theory", []), "tasks": []}
            seed = None
            if L.get("db"):
                seed = open(os.path.join(d, "db", L["db"] + ".sql"), encoding="utf-8").read()
                if L["db"] not in dbs:
                    dbs[L["db"]] = {"seed": seed, "schema": schema(seed)}
                out["db"] = L["db"]
            for i, t in enumerate(L.get("tasks", []), 1):
                t = dict(t)
                t["id"] = "%d.%d" % (n, i)
                tw = "%s задание %s" % (where, t["id"])
                if t.get("type") not in TYPES:
                    errors.append("%s: неизвестный тип %r" % (tw, t.get("type")))
                    continue
                if t["type"] == "sql":
                    if not seed:
                        errors.append("%s: у урока нет базы (поле db)" % tw)
                        continue
                    try:
                        t["expect"] = run(seed, t.pop("solution"), t.get("verify"))
                    except Exception as e:
                        errors.append("%s: эталон не выполняется: %s" % (tw, e))
                        continue
                    if not t["expect"]["rows"]:
                        errors.append("%s: эталон вернул пустой ответ" % tw)
                if t["type"] == "quiz" and not (isinstance(t.get("a"), int) and 0 <= t["a"] < len(t.get("o", []))):
                    errors.append("%s: номер правильного ответа вне списка" % tw)
                if t["type"] == "steps" and not t.get("steps"):
                    errors.append("%s: нет шагов" % tw)
                if t["type"] == "keys" and not t.get("items"):
                    errors.append("%s: нет клавиш" % tw)
                out["tasks"].append(t)
            lessons.append(out)
        subjects[sid] = dict(meta, id=sid, lessons=lessons, dbs=dbs)
    return subjects


def main():
    errors = []
    subjects = load(errors)
    for e in errors:
        print("ОШИБКА", e)
    n = sum(len(L["tasks"]) for s in subjects.values() for L in s["lessons"])
    print("Предметов: %d, уроков: %d, заданий: %d" % (len(subjects), sum(len(s["lessons"]) for s in subjects.values()), n))
    if errors:
        sys.exit(1)
    if "--check" in sys.argv:
        return
    with open(os.path.join(ROOT, "docs", "data", "subjects.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Собрано из папки subjects/ (python tools/subjects.py). Руками не править. */\n")
        f.write("window.SUBJECTS=" + json.dumps(subjects, ensure_ascii=False, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
