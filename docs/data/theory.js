/* Плашки теории. Чтобы добавить: новый объект в THEORY и (по желанию) id задания в THEORY_MAP. */
window.THEORY=[
 {
  "id": "l1-print",
  "l": 1,
  "t": "print() — показать на экране",
  "x": "Выводит значение. Текст пишут в кавычках, числа — без.",
  "c": "print(\"Привет!\")\nprint(2 + 3)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l1-vars",
  "l": 1,
  "t": "Переменная",
  "x": "Имя, под которым Python хранит значение. Знак = кладёт значение в переменную.",
  "c": "age = 15\nprint(age)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l1-types",
  "l": 1,
  "t": "Типы данных",
  "x": "int — целое, float — дробное (с точкой), str — текст в кавычках. Кавычки решают: \"5\" — текст, 5 — число.",
  "c": "print(type(5), type(2.5), type(\"5\"))",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l1-input",
  "l": 1,
  "t": "input() — ввод",
  "x": "Всегда возвращает строку. Нужно число — оберни в int() или float().",
  "c": "n = int(input(\"Число: \"))\nprint(n * 2)",
  "stdin": [
   "21"
  ],
  "k": ""
 },
 {
  "id": "l1-fstring",
  "l": 1,
  "t": "f-строка",
  "x": "Буква f перед кавычками — внутри {} подставляется значение переменной.",
  "c": "name = \"Аня\"\nprint(f\"Привет, {name}!\")",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l1-math",
  "l": 1,
  "t": "Арифметика",
  "x": "+  -  *  /  — как обычно. ** — степень, // — целое деление, % — остаток.",
  "c": "print(7 // 2, 7 % 2, 2 ** 3)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l1-str",
  "l": 1,
  "t": "Строки склеиваются",
  "x": "Строки можно складывать (+) и умножать на число. Строку и число сложить нельзя — будет TypeError.",
  "c": "print(\"ха\" * 3)\nprint(\"а\" + \"б\")",
  "stdin": null,
  "k": "warn"
 },
 {
  "id": "l2-if",
  "l": 2,
  "t": "if / elif / else",
  "x": "Компьютер выбирает одну ветку. else — «иначе», elif — «а если».",
  "c": "x = 5\nif x > 10:\n    print(\"много\")\nelif x > 3:\n    print(\"средне\")\nelse:\n    print(\"мало\")",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l2-cmp",
  "l": 2,
  "t": "Сравнения",
  "x": "==  !=  <  >  <=  >=  дают True или False. Один = кладёт значение, два == сравнивают.",
  "c": "print(5 == 5, 5 != 5, 3 <= 2)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l2-logic",
  "l": 2,
  "t": "and / or / not",
  "x": "and — оба условия истинны, or — хотя бы одно, not — наоборот.",
  "c": "h, age = 130, 6\nprint(h >= 120 and age >= 7)\nprint(h >= 120 or age >= 7)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l2-indent",
  "l": 2,
  "t": "Двоеточие и отступ",
  "x": "После if, elif, else, for, while, def — двоеточие. Тело блока сдвигают на 4 пробела.",
  "c": "if 2 > 1:\n    print(\"отступ обязателен\")",
  "stdin": null,
  "k": "warn"
 },
 {
  "id": "l2-order",
  "l": 2,
  "t": "Порядок проверок",
  "x": "Ветки проверяются сверху вниз, срабатывает первая подходящая. Начинай с самого строгого условия.",
  "c": "score = 90\nif score >= 85:\n    print(5)\nelif score >= 65:\n    print(4)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l3-for",
  "l": 3,
  "t": "Цикл for",
  "x": "Повторяет блок для каждого элемента набора. Переменная цикла по очереди принимает значения.",
  "c": "for ch in \"Hi\":\n    print(ch)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l3-range",
  "l": 3,
  "t": "range()",
  "x": "range(5) — 0..4, range(1, 6) — 1..5. Конец не включается.",
  "c": "print(list(range(1, 6)))\nprint(list(range(0, 10, 3)))",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l3-while",
  "l": 3,
  "t": "Цикл while",
  "x": "Повторяет, пока условие истинно. Не забудь менять переменную, иначе цикл бесконечный (остановка: Ctrl + C).",
  "c": "i = 1\nwhile i <= 3:\n    print(i)\n    i += 1",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l3-break",
  "l": 3,
  "t": "break — выйти из цикла",
  "x": "Часто в связке while True: цикл крутится, пока не сработает break.",
  "c": "while True:\n    t = input()\n    if t == \"стоп\":\n        break\n    print(\"ввели\", t)",
  "stdin": [
   "а",
   "стоп"
  ],
  "k": ""
 },
 {
  "id": "l3-acc",
  "l": 3,
  "t": "Накопитель",
  "x": "Переменная, в которую складывают результат по шагам. Начальное значение — до цикла.",
  "c": "total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l3-list",
  "l": 3,
  "t": "Список",
  "x": "Элементы в [], нумерация с нуля. [-1] — последний. len() — длина, append() — добавить.",
  "c": "a = [10, 20, 30]\na.append(40)\nprint(a[0], a[-1], len(a))",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l3-def",
  "l": 3,
  "t": "Функция",
  "x": "def создаёт функцию, вызов — по имени со скобками. Тело выполняется только при вызове.",
  "c": "def hi(name):\n    print(\"Привет,\", name)\nhi(\"Аня\")",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l3-return",
  "l": 3,
  "t": "return и print — разные вещи",
  "x": "print только показывает. return отдаёт значение программе, и с ним можно считать дальше. Без return функция вернёт None.",
  "c": "def area(a, b):\n    return a * b\nprint(area(2, 3) + 1)",
  "stdin": null,
  "k": "warn"
 },
 {
  "id": "l4-str",
  "l": 4,
  "t": "Индексы и срезы строк",
  "x": "Строка — как список букв. s[0] первая, s[-1] последняя, s[1:3] — со 2-й по 3-ю.",
  "c": "s = \"Python\"\nprint(s[0], s[-1], s[1:3])",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l4-methods",
  "l": 4,
  "t": "Методы строк",
  "x": "upper() и lower() меняют регистр, split() режет по пробелам, replace() заменяет, count() считает.",
  "c": "s = \"Раз два три\"\nprint(s.lower(), len(s.split()))\nprint(s.count(\"а\"))",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l4-rev",
  "l": 4,
  "t": "Строка наоборот",
  "x": "Срез с шагом -1 переворачивает строку. Так проверяют палиндром.",
  "c": "s = \"шалаш\"\nprint(s[::-1] == s)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l4-dict",
  "l": 4,
  "t": "Словарь",
  "x": "Пары «ключ: значение» в {}. Достают по ключу. Проверка наличия — in.",
  "c": "d = {\"кот\": \"cat\"}\nprint(d[\"кот\"], \"пёс\" in d)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l4-file",
  "l": 4,
  "t": "Файлы",
  "x": "with open(...) сам закроет файл. \"w\" — запись (стирает старое), \"r\" — чтение. Всегда пиши encoding=\"utf-8\".",
  "c": "with open(\"t.txt\", \"w\", encoding=\"utf-8\") as f:\n    f.write(\"Привет\\n\")\nwith open(\"t.txt\", encoding=\"utf-8\") as f:\n    print(f.read())",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l5-try",
  "l": 5,
  "t": "try / except",
  "x": "Python пробует выполнить try. Если случилась указанная ошибка, выполняется except — программа не падает.",
  "c": "try:\n    n = int(\"abc\")\nexcept ValueError:\n    n = 0\nprint(n)",
  "stdin": null,
  "k": ""
 },
 {
  "id": "l5-errors",
  "l": 5,
  "t": "Какая это ошибка",
  "x": "ValueError — не то значение (int(\"abc\")). ZeroDivisionError — деление на 0. NameError — нет такой переменной. TypeError — не тот тип. IndexError — нет такого индекса. KeyError — нет такого ключа.",
  "c": null,
  "stdin": null,
  "k": "warn"
 },
 {
  "id": "l5-retry",
  "l": 5,
  "t": "Повторять ввод до успеха",
  "x": "try внутри while True: break срабатывает, только когда всё получилось.",
  "c": "while True:\n    try:\n        n = int(input(\"Число: \"))\n        break\n    except ValueError:\n        print(\"Ещё раз\")\nprint(n)",
  "stdin": [
   "x",
   "7"
  ],
  "k": ""
 },
 {
  "id": "l5-none",
  "l": 5,
  "t": "None — «ничего»",
  "x": "Особое значение «пусто». Его возвращают, когда результата нет: ошибка, ничего не нашли.",
  "c": "def f(t):\n    try:\n        return int(t)\n    except ValueError:\n        return None\nprint(f(\"7\"), f(\"x\"))",
  "stdin": null,
  "k": ""
 }
];
window.THEORY_MAP={
 "1.1": [
  "l1-input",
  "l1-fstring",
  "l1-vars"
 ],
 "1.2": [
  "l1-input",
  "l1-types",
  "l1-math"
 ],
 "1.3": [
  "l1-types",
  "l1-input",
  "l1-math"
 ],
 "1.4": [
  "l1-math",
  "l1-fstring"
 ],
 "2.1": [
  "l2-if",
  "l2-cmp",
  "l2-indent"
 ],
 "2.2": [
  "l2-if",
  "l2-order",
  "l2-cmp"
 ],
 "2.3": [
  "l2-logic",
  "l2-cmp"
 ],
 "2.4": [
  "l2-if",
  "l2-order",
  "l2-indent"
 ],
 "3.1": [
  "l3-for",
  "l3-range",
  "l1-fstring"
 ],
 "3.2": [
  "l3-def",
  "l3-return",
  "l3-acc"
 ],
 "3.3": [
  "l3-while",
  "l3-break",
  "l3-acc"
 ],
 "3.4": [
  "l3-def",
  "l3-return",
  "l2-if"
 ],
 "3.5": [
  "l3-list",
  "l3-for"
 ],
 "4.1": [
  "l4-methods",
  "l4-str"
 ],
 "4.2": [
  "l4-rev",
  "l4-methods"
 ],
 "4.3": [
  "l4-methods",
  "l4-str"
 ],
 "4.4": [
  "l4-dict",
  "l3-while",
  "l3-break"
 ],
 "4.5": [
  "l4-file"
 ],
 "5.1": [
  "l5-try",
  "l5-errors",
  "l5-none"
 ],
 "5.2": [
  "l5-try",
  "l5-errors"
 ],
 "5.3": [
  "l5-retry",
  "l5-try"
 ],
 "5.4": [
  "l5-retry",
  "l3-def",
  "l2-if"
 ]
};
