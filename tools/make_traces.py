"""Строит docs/decks/traces.js: настоящие пошаговые запуски примеров для презентации.
Запуск: python3 tools/make_traces.py   (результат коммитится в репозиторий)."""
import builtins, io, json, os, sys

SNIPPETS = {
 "print": ('# Это комментарий: компьютер его не выполняет\nprint("Привет, мир!")\nprint(2 + 3)\nprint("Городской" + " помощник")', []),
 "vars": ('name = input("Как вас зовут? ")\ndistance = float(input("Расстояние, км: "))\nprint("Привет,", name)\nprint("До цели", distance, "км")', ["Анна", "1.5"]),
 "for": ('cities = ["Москва", "Химки", "Мытищи"]\nfor city in cities:\n    print(city)', []),
 "range": ('for i in range(3):\n    print("Шаг", i)', []),
 "func": ('def recommend(distance):\n    if distance <= 2:\n        return "пешком"\n    return "на метро"\n\nprint(recommend(1.5))\nprint(recommend(9))', []),
 "lists": ('name = "Анна"\nprint(len(name))\nprint(name.upper())\ncities = ["Москва", "Химки", "Мытищи"]\nprint(cities[0])\ncities.append("Королёв")\nprint(len(cities))', []),
 "city": ('print("Городской помощник")\nname = input("Как вас зовут? ")\ndistance = float(input("Расстояние до цели, км: "))\n\nif distance <= 2:\n    transport = "пешком"\nelif distance <= 8:\n    transport = "на наземном транспорте"\nelse:\n    transport = "на метро"\n\nprint(f"{name}, рекомендуемый способ: {transport}.")', ["Анна", "1.5"]),
}

def short(v):
    r = repr(v)
    return r if len(r) <= 48 else r[:45] + "..."

def trace(code, inputs):
    out, steps, it = [], [], iter(inputs)
    def fake_input(prompt=""):
        v = next(it); out.append(prompt + v + "\n"); return v
    def fake_print(*a, sep=" ", end="\n", **k): out.append(sep.join(str(x) for x in a) + end)
    g = {"__name__": "__main__", "input": fake_input, "print": fake_print}
    def snap(frame):
        d = frame.f_globals if frame.f_code.co_name == "<module>" else frame.f_locals
        return {k: short(v) for k, v in d.items() if not k.startswith("__") and k not in ("input", "print") and not callable(v)}
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "<slide>": return tracer
        if event == "line":
            steps.append({"l": frame.f_lineno - 1, "v": snap(frame), "o": "".join(out), "f": frame.f_code.co_name if frame.f_code.co_name != "<module>" else ""})
        return tracer
    sys.settrace(tracer)
    try: exec(compile(code, "<slide>", "exec"), g)
    finally: sys.settrace(None)
    steps.append({"l": -1, "v": {k: short(v) for k, v in g.items() if not k.startswith("__") and k not in ("input", "print") and not callable(v)}, "o": "".join(out)})
    return steps

res = {k: {"code": c, "inputs": i, "steps": trace(c, i)} for k, (c, i) in SNIPPETS.items()}
here = os.path.dirname(os.path.abspath(__file__))
dst = os.path.join(here, "..", "docs", "decks", "traces.js")
with open(dst, "w", encoding="utf-8", newline="\n") as f:
    f.write("/* Сгенерировано tools/make_traces.py. Не править руками. */\nvar TRACES = " + json.dumps(res, ensure_ascii=False) + ";\n")
print("примеров:", len(res), "шагов:", sum(len(v["steps"]) for v in res.values()))
