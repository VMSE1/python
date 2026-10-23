/* SQL-тренажёр в браузере: SQLite внутри Pyodide (лежит на этом же сайте). База создаётся заново при каждом запуске. */
import { loadPyodide } from "../pyodide/pyodide.mjs";
var PY = String.raw`
import sqlite3, json, time

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

def ru(e):
    m = str(e)
    low = m.lower()
    if low.startswith("no such table"):
        return "Нет таблицы «%s». Проверь название: список таблиц справа." % m.split(":", 1)[1].strip()
    if low.startswith("no such column"):
        return "Нет столбца «%s». Проверь название или кавычки: текст пишут в одинарных кавычках." % m.split(":", 1)[1].strip()
    if "syntax error" in low:
        near = m.split('"')[1] if '"' in m else ""
        return "Ошибка в записи запроса" + (" рядом с «%s»" % near if near else "") + ". Проверь запятые, кавычки и порядок слов."
    if "incomplete input" in low:
        return "Запрос не закончен: проверь скобки и кавычки."
    if "interrupted" in low:
        return "Запрос выполнялся слишком долго и был остановлен."
    if "unique constraint" in low:
        return "Такой id уже есть в таблице: id должен быть уникальным."
    if "values were supplied" in low or "has " in low and "columns but" in low:
        return "Количество значений не совпадает с количеством столбцов."
    return "Ошибка: " + m

def execute(seed, sql, verify):
    con = sqlite3.connect(":memory:")
    t0 = time.time()
    con.set_progress_handler(lambda: 1 if time.time() - t0 > 3 else 0, 20000)
    con.executescript(seed or "")
    cols, rows, changed, n = None, None, 0, 0
    for st in split_sql(sql):
        n += 1
        cur = con.execute(st)
        if cur.description:
            cols, rows = [d[0] for d in cur.description], cur.fetchmany(MAX_ROWS + 1)
        elif cur.rowcount and cur.rowcount > 0:
            changed += cur.rowcount
    if verify:
        cur = con.execute(verify)
        cols, rows = [d[0] for d in cur.description], cur.fetchmany(MAX_ROWS + 1)
    rows = rows or []
    return {"cols": cols, "rows": [list(r) for r in rows[:MAX_ROWS]], "more": len(rows) > MAX_ROWS, "changed": changed, "n": n}

def norm(v):
    if isinstance(v, float):
        v = round(v, 2)
        return int(v) if v == int(v) else v
    return v

def key(r):
    return json.dumps([norm(x) for x in r], ensure_ascii=False)

def compare(got, exp, task):
    if got["cols"] is None:
        return "Запрос ничего не вернул. Нужен SELECT, который покажет результат."
    gr, er = [[norm(x) for x in r] for r in got["rows"]], [[norm(x) for x in r] for r in exp["rows"]]
    if len(got["cols"]) != len(exp["cols"]):
        return "Столбцов получилось %d, а нужно %d." % (len(got["cols"]), len(exp["cols"]))
    if task.get("names") and [c.lower() for c in got["cols"]] != [c.lower() for c in exp["cols"]]:
        return "Названия столбцов должны быть такими: " + ", ".join(exp["cols"]) + "."
    if len(gr) != len(er):
        return "Строк получилось %d, а нужно %d." % (len(gr), len(er))
    if task.get("verify"):
        if sorted(map(key, gr)) != sorted(map(key, er)):
            return "Таблица после твоих команд не такая, как нужно. Сравни её с ожидаемой."
        return ""
    if sorted(map(key, gr)) != sorted(map(key, er)):
        return "Строк столько, сколько нужно, но значения другие. Проверь условие и столбцы."
    if task.get("ordered") and list(map(key, gr)) != list(map(key, er)):
        return "Строки правильные, но порядок другой. Проверь ORDER BY."
    return ""

def handle(msg):
    m = json.loads(msg)
    try:
        got = execute(m.get("seed"), m.get("sql", ""), m.get("verify"))
    except Exception as e:
        return json.dumps({"ok": False, "error": ru(e)}, ensure_ascii=False)
    out = {"ok": True, "res": got}
    if m.get("expect"):
        bad = compare(got, m["expect"], m)
        out["pass"] = not bad
        out["msg"] = bad
    return json.dumps(out, ensure_ascii=False, default=str)
`;
var ready = loadPyodide({ indexURL: "../pyodide/" }).then(function (py) { py.runPython(PY); postMessage({ type: "ready" }); return py; });
onmessage = function (e) {
  var m = e.data;
  ready.then(function (py) {
    try { py.globals.set("MSG", m.msg); postMessage({ type: "result", id: m.id, result: JSON.parse(py.runPython("handle(MSG)")) }); }
    catch (err) { postMessage({ type: "result", id: m.id, result: { ok: false, error: "Ошибка тренажёра: " + err.message } }); }
  });
};
