# Как добавить задание

1. Скопируй папку `tools/template_task/` в `lessons/lessonN/task_M_название/` (если урока `lessonN` ещё нет — создай папку и файл `lesson.json` вида `{"title": "Название урока"}`).
2. Открой `task.json` и заполни поля:
   - `id` — номер вида `6.1` (урок.задание);
   - `title`, `text`, `hint`, `example`, `starter`, `file` — то, что видит ученик;
   - проверка: `cases` (запуск программы с вводом) и/или `funcs` (вызов функции).
3. Положи файл-заготовку (`file`) с тем же текстом, что и `starter`. Ученик получает его.
4. Проверь у себя: `python check.py --list`, затем положи свой эталонный файл и `python check.py 6.1 --file эталон.py`.
5. Запусти `python tools/build_site.py` (или просто сделай push: сайт соберётся сам).

## Формат проверки в `task.json`

Программа с вводом:

```json
"cases": [
  {"stdin": ["4", "5"], "must": ["Площадь: 20"], "must_not": ["ошибка"]}
]
```

Функция:

```json
"funcs": [
  {"name": "sum_to", "calls": [{"args": [5], "expect": 15}, {"args": [100], "expect": 5050}]}
]
```

Файл, который должна создать программа: `"files": {"hello.txt": ["Привет, Анна!"]}` внутри `cases`.
Регистр и лишние пробелы в выводе не учитываются.

## Проекты учеников

Через Issue «Показать свой проект» или Pull Request в папку `projects/ник/` (см. `projects/README.md`).

## Как добавить урок другого предмета (SQL, Blender, нейросети)

Уроки лежат в `subjects/<предмет>/lessonN.json`, описание предмета в `subjects/<предмет>/subject.json`. Учебная база для SQL: `subjects/sql/db/*.sql`.

1. Скопируй соседний `lessonN.json` и поправь: `title`, `goal`, `theory` (плашки), `tasks`.
2. Типы заданий: `sql` (поле `solution` — эталон, на сайт не попадает; `ordered: true` — важен порядок строк; `names: true` — важны названия столбцов; `verify` — запрос для проверки после INSERT/UPDATE/DELETE), `quiz`, `steps`, `keys` (тренажёр горячих клавиш), `neuron`.
3. Проверь: `python tools/subjects.py --check` (эталонные запросы выполняются, номера ответов квизов проверяются).
4. Собери: `python tools/subjects.py` (или `python tools/build_site.py`; на GitHub Pages это делается само).
5. Новый предмет: добавь папку, строку в `ORDER` (`tools/subjects.py`), в `LIST` (`docs/subjects.js`) и ключ в `SUBJECTS`/`SUBJ_KEY` (`server/app.py`).
