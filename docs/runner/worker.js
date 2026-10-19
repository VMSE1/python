/* Проверка заданий в браузере (Pyodide, всё хранится на этом же сайте) */
import { loadPyodide } from "../pyodide/pyodide.mjs";
var PY = String.raw`
import sys, io, json, builtins, os

def norm(t):
    return " ".join(str(t).casefold().split())

def same(a, b):
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) < 1e-9
        except Exception:
            return False
    return a == b

def short_err(e):
    return type(e).__name__ + ": " + str(e)

def run_program(code, stdin):
    out = io.StringIO()
    it = iter(stdin)
    def fake_input(prompt=""):
        out.write(str(prompt))
        try:
            return next(it)
        except StopIteration:
            raise EOFError("input() вызван больше раз, чем есть данных")
    old_in, old_out = builtins.input, sys.stdout
    builtins.input = fake_input
    sys.stdout = out
    err = ""
    try:
        exec(compile(code, "main.py", "exec"), {"__name__": "__main__"})
    except SystemExit:
        pass
    except BaseException as e:
        err = short_err(e)
    finally:
        builtins.input, sys.stdout = old_in, old_out
    return out.getvalue(), err

def run_funcs(code, name, calls):
    g = {"__name__": "student"}
    def no_input(*a, **k):
        raise RuntimeError("input() вызван при импорте")
    old_in = builtins.input
    builtins.input = no_input
    try:
        exec(compile(code, "main.py", "exec"), g)
    except BaseException as e:
        builtins.input = old_in
        return None, short_err(e)
    builtins.input = old_in
    if name not in g:
        return None, "функция " + name + " не найдена"
    res = []
    for args in calls:
        try:
            res.append({"ok": True, "value": g[name](*args)})
        except BaseException as e:
            res.append({"ok": False, "error": short_err(e)})
    return res, ""

def check(spec_json, code):
    spec = json.loads(spec_json)
    problems, sample = [], ""
    for fs in spec.get("funcs", []):
        res, err = run_funcs(code, fs["name"], [c["args"] for c in fs["calls"]])
        if res is None:
            problems.append("Функция %s: %s" % (fs["name"], err))
            continue
        for c, item in zip(fs["calls"], res):
            shown = "%s(%s)" % (fs["name"], ", ".join(repr(a) for a in c["args"]))
            if not item["ok"]:
                problems.append("%s вызвала ошибку: %s" % (shown, item["error"]))
            elif not same(item["value"], c["expect"]):
                problems.append("%s вернула %r, а нужно %r" % (shown, item["value"], c["expect"]))
    for case in spec.get("cases", []):
        for fn in case.get("files", {}):
            try: os.remove(fn)
            except Exception: pass
        out, err = run_program(code, case.get("stdin", []))
        if not sample: sample = out
        inp = ", ".join(case.get("stdin", [])) or "(без ввода)"
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
            if not os.path.exists(fname):
                problems.append("Ввод [%s]: программа должна создать файл %s" % (inp, fname))
            else:
                got = [ln.strip() for ln in open(fname, encoding="utf-8").read().splitlines() if ln.strip()]
                if got != expected:
                    problems.append("Файл %s: ожидали %r, получили %r" % (fname, expected, got))
    return json.dumps({"ok": not problems, "messages": problems[:6], "sample": sample}, ensure_ascii=False)
`;
var ready = loadPyodide({ indexURL: "../pyodide/" }).then(function (py) { py.runPython(PY); postMessage({ type: "ready" }); return py; });
onmessage = function (e) {
  var m = e.data;
  ready.then(function (py) {
    try {
      py.globals.set("SPEC", m.spec); py.globals.set("CODE", m.code);
      var r = py.runPython("check(SPEC, CODE)");
      postMessage({ type: "result", id: m.id, result: JSON.parse(r) });
    } catch (err) {
      postMessage({ type: "result", id: m.id, result: { ok: false, messages: ["Ошибка проверки: " + err.message], sample: "" } });
    }
  });
};
