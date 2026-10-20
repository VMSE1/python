#!/usr/bin/env python3
"""Собирает данные сайта из папок заданий.

Запуск из корня репозитория:  python tools/build_site.py
Делает три вещи:
  1. docs/data/tasks.js — список заданий для сайта;
  2. .github/ISSUE_TEMPLATE/submit.yml — форма сдачи со списком заданий;
  3. таблицу заданий в README.md (между маркерами <!-- TASKS --> и <!-- /TASKS -->).
Запускается автоматически при каждой публикации сайта (workflow pages.yml).
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import check  # noqa: E402

def lesson_title(n):
    p = os.path.join(ROOT, "lessons", "lesson%s" % n, "lesson.json")
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8")).get("title", "Урок %s" % n)
    return "Урок %s" % n

def main():
    tasks = check.load_tasks()
    pub = []
    for t in tasks:
        lesson = int(t["id"].split(".")[0])
        rel = os.path.relpath(t["_dir"], ROOT).replace(os.sep, "/")
        pub.append(dict(id=t["id"], title=t["title"], lesson=lesson, lessonTitle=lesson_title(lesson),
                        text=t["text"], example=t.get("example"), hint=t.get("hint", ""),
                        starter=t.get("starter", ""), file=t["file"], dir=rel, func=bool(t.get("funcs")),
                        cases=t.get("cases", []), funcs=t.get("funcs", [])))
    os.makedirs(os.path.join(ROOT, "docs", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "docs", "data", "tasks.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("window.TASKS=" + json.dumps(pub, ensure_ascii=False, indent=1) + ";\n")
    opts = "\n".join("        - \"%s — %s\"" % (t["id"], t["title"].replace('"', "'")) for t in tasks)
    form = f'''name: "Сдать задание"
description: Отправь решение — робот проверит его за минуту и ответит в комментарии
title: "[Сдача] "
labels: ["сдача"]
body:
  - type: markdown
    attributes:
      value: |
        Робот запустит твой код на тестах и напишет результат в комментарии. Если есть ошибки — исправь код, нажми «Edit» у этого Issue, и проверка запустится снова.
        **Не пиши фамилию и имя: Issue виден всем.** Придумай ник и скажи его учителю. Твой GitHub-аккаунт и группа попадут в приватную ведомость учителя.
  - type: input
    id: nick
    attributes:
      label: Ник
      description: Твой псевдоним (например, snake_42)
    validations:
      required: true
  - type: input
    id: group
    attributes:
      label: Группа
      description: Номер группы, например 9А. Нет группы? Напиши «нет»
    validations:
      required: true
  - type: dropdown
    id: task
    attributes:
      label: Задание
      options:
{opts}
    validations:
      required: true
  - type: textarea
    id: code
    attributes:
      label: Код решения
      description: Вставь весь файл целиком
      render: python
    validations:
      required: true
'''
    with open(os.path.join(ROOT, ".github", "ISSUE_TEMPLATE", "submit.yml"), "w", encoding="utf-8", newline="\n") as f:
        f.write(form)
    rows = ["| № | Задание | Папка |", "|---|---|---|"]
    last = None
    for t in pub:
        if t["lesson"] != last:
            rows.append("| | **Урок %d. %s** | |" % (t["lesson"], t["lessonTitle"])); last = t["lesson"]
        rows.append("| %s | %s | [открыть](%s) |" % (t["id"], t["title"], t["dir"]))
    rp = os.path.join(ROOT, "README.md")
    s = open(rp, encoding="utf-8").read()
    s = re.sub(r"<!-- TASKS -->.*?<!-- /TASKS -->", "<!-- TASKS -->\n" + "\n".join(rows) + "\n<!-- /TASKS -->", s, flags=re.S)
    open(rp, "w", encoding="utf-8", newline="\n").write(s)
    print("заданий: %d" % len(pub))

if __name__ == "__main__":
    main()
