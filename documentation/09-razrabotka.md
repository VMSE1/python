# 9. Разработка: как менять и добавлять

Требуется Python 3.12 и Git. Сайт не собирается сборщиком: правишь файлы и делаешь push, GitHub Pages публикует `docs/`.

## Локальный запуск сайта

```bash
python3 tools/build_site.py      # обновить docs/data/tasks.js и форму сдачи
python3 -m http.server 8000 -d docs
# открыть http://localhost:8000
```

Проверка в браузере (Pyodide) требует адрес `http://localhost`, а не открытие файла двойным щелчком.

## Добавить задание

1. Скопировать `tools/template_task/` в `lessons/lessonN/task_M_название/`.
2. Заполнить `task.json` (`id`, `title`, `text`, `hint`, `example`, `starter`, `file`, `cases` и/или `funcs`). Формат: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
3. Положить заготовку (`file`) с тем же текстом, что `starter`.
4. Проверить эталонное решение: `python3 check.py 6.1 --file эталон.py`.
5. `python3 tools/build_site.py` (или просто push: сайт соберётся сам). Задание появится на карте, в форме сдачи и в таблице `README.md`.

Новый урок: папка `lessonN/` и `lesson.json` вида `{"title": "Название урока"}`.

## Добавить плашку теории

В `docs/data/theory.js` добавить объект в `THEORY`:

```js
{ id: "l2-if", l: 2, t: "if — условие", x: "Короткое объяснение.", c: "if x > 1:\n    print(x)", stdin: null, k: "" }
```

Чтобы плашка показывалась в задании, добавь id задания в `THEORY_MAP`.

## Добавить вопрос квиза

В `docs/questions.js` добавить объект: `l` (урок), `q` (вопрос), `code` (или `null`), `o` (4 варианта), `a` (номер верного, с нуля), `why` (объяснение).

## Добавить слайд или презентацию

См. [07. Презентации](07-prezentacii.md). Для запуска кода по шагам добавь пример в `tools/make_traces.py` и выполни `python3 tools/make_traces.py`.

## Изменить оформление

- Цвета, шрифты, тени: `:root` в `docs/site.css`.
- Слайды: `docs/slides.css` (размеры в `em`, масштабируются вместе со сценой).
- Иконки: `PIX` в `docs/site.js` (16×16, буквы палитры `PAL`).
- Шрифты лежат в `docs/fonts/` (лицензии в `LICENSES.txt`). Не подключай шрифты с чужих сайтов: CSP запретит, а в школе их может не быть.

## Правила кода

- Динамический текст выводить через `esc()` или `textContent`, никогда через сырой `innerHTML`.
- Новые запросы только на `api.github.com` (иначе обновить CSP на странице).
- Внешние скрипты и CDN не добавлять.
- Новая страница: добавить в `PAGES` и в меню в `docs/site.js`, в список `PAGES` в `tests/browser_tests.py`.
- Метки Issues ставит робот в `grade.yml`, а не форма.

## Выпуск

1. `python3 -m unittest tests.test_sandbox` и `python3 tests/browser_tests.py` (см. [08](08-testy.md)).
2. `git push origin HEAD:main`.
3. Вкладка Actions: «Сайт» (публикация) и «Тесты» должны стать зелёными.

## Коммиты

Короткое описание на русском в повелительном или прошедшем времени: что изменилось и зачем. Pull Request оформляется по шаблону `.github/pull_request_template.md`.
