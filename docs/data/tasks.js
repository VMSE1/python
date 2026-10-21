window.TASKS=[
 {
  "id": "1.1",
  "title": "Визитка",
  "lesson": 1,
  "lessonTitle": "Первая программа",
  "text": "Спроси у пользователя имя и город. Выведи одну строку: `Меня зовут <имя>, я из <город>`.",
  "example": {
   "in": "Анна\nМосква",
   "out": "Меня зовут Анна, я из Москва"
  },
  "hint": "Две переменные через `input()` и `print()` с f-строкой.",
  "starter": "name = input(\"Как тебя зовут? \")\n# TODO: спроси город и выведи визитку\n",
  "file": "vizitka.py",
  "dir": "lessons/lesson1/task_1_vizitka",
  "func": false,
  "steps": [
   "Спроси имя: `name = input(\"Имя: \")`.",
   "Так же спроси город и положи в `city`.",
   "Выведи одну строку через f-строку: `print(f\"... {name} ... {city}\")`.",
   "Текст строки должен совпасть с образцом: «Меня зовут Анна, я из Казани»."
  ],
  "sample": {
   "task": "Спроси имя и любимое животное. Выведи `<имя> любит <животное>`.",
   "code": "name = input()\npet = input()\nprint(f\"{name} любит {pet}\")",
   "out": "Вход: Лёша, кот\nВыход: Лёша любит кот"
  },
  "cases": [
   {
    "stdin": [
     "Анна",
     "Москва"
    ],
    "must": [
     "Меня зовут Анна, я из Москва"
    ]
   },
   {
    "stdin": [
     "Илья",
     "Казань"
    ],
    "must": [
     "Меня зовут Илья, я из Казань"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "1.2",
  "title": "Площадь прямоугольника",
  "lesson": 1,
  "lessonTitle": "Первая программа",
  "text": "Спроси длину и ширину (целые числа). Выведи `Площадь: <число>`.",
  "example": {
   "in": "4\n5",
   "out": "Площадь: 20"
  },
  "hint": "`int(input(...))`, потом умножение.",
  "starter": "# TODO: спроси a и b как целые числа и выведи площадь\n",
  "file": "ploshchad.py",
  "dir": "lessons/lesson1/task_2_ploshchad",
  "func": false,
  "steps": [
   "Спроси длину и сразу сделай число: `a = int(input())`.",
   "То же с шириной: `b = int(input())`.",
   "Перемножь: `a * b`.",
   "Выведи `Площадь: ` и результат."
  ],
  "sample": {
   "task": "Спроси две стороны и выведи периметр.",
   "code": "a = int(input())\nb = int(input())\nprint(\"Периметр:\", 2 * (a + b))",
   "out": "Вход: 3 и 4\nВыход: Периметр: 14"
  },
  "cases": [
   {
    "stdin": [
     "4",
     "5"
    ],
    "must": [
     "Площадь: 20"
    ]
   },
   {
    "stdin": [
     "3",
     "7"
    ],
    "must": [
     "Площадь: 21"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "1.3",
  "title": "Километры в метры",
  "lesson": 1,
  "lessonTitle": "Первая программа",
  "text": "Спроси расстояние в километрах (может быть дробным). Выведи `<число> м`.",
  "example": {
   "in": "1.5",
   "out": "1500.0 м"
  },
  "hint": "Дробное число — `float(...)`. В километре 1000 метров.",
  "starter": "# TODO: спроси километры как float, переведи в метры и выведи\n",
  "file": "konverter.py",
  "dir": "lessons/lesson1/task_3_konverter",
  "func": false,
  "steps": [
   "Расстояние может быть дробным, поэтому `float(input())`.",
   "Умножь на 1000.",
   "Выведи число, пробел и `м`.",
   "Вывод `2500.0 м` тоже засчитается: ориентир тут число, а не точка."
  ],
  "sample": {
   "task": "Спроси вес в килограммах (может быть дробным). Выведи вес в граммах.",
   "code": "kg = float(input())\nprint(kg * 1000, \"г\")",
   "out": "Вход: 1.5\nВыход: 1500.0 г"
  },
  "cases": [
   {
    "stdin": [
     "1.5"
    ],
    "must": [
     "1500"
    ]
   },
   {
    "stdin": [
     "2"
    ],
    "must": [
     "2000"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "1.4",
  "title": "Минуты в часы",
  "lesson": 1,
  "lessonTitle": "Первая программа",
  "text": "Спроси количество минут (целое). Выведи, сколько это часов и минут: `<ч> ч <м> мин`.",
  "example": {
   "in": "135",
   "out": "2 ч 15 мин"
  },
  "hint": "Целочисленное деление `//` и остаток `%`.",
  "starter": "# TODO: спроси минуты, посчитай часы (//) и остаток (%)\n",
  "file": "vremya.py",
  "dir": "lessons/lesson1/task_4_vremya",
  "func": false,
  "steps": [
   "Спроси минуты: `m = int(input())`.",
   "Часы: `m // 60` (деление без остатка).",
   "Минуты: `m % 60` (остаток).",
   "Выведи в виде `<ч> ч <м> мин`."
  ],
  "sample": {
   "task": "Спроси секунды. Выведи минуты и секунды.",
   "code": "s = int(input())\nprint(f\"{s // 60} мин {s % 60} с\")",
   "out": "Вход: 135\nВыход: 2 мин 15 с"
  },
  "cases": [
   {
    "stdin": [
     "135"
    ],
    "must": [
     "2 ч 15 мин"
    ]
   },
   {
    "stdin": [
     "59"
    ],
    "must": [
     "0 ч 59 мин"
    ]
   },
   {
    "stdin": [
     "60"
    ],
    "must": [
     "1 ч 0 мин"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "1.5",
  "title": "Длина имени",
  "lesson": 1,
  "lessonTitle": "Первая программа",
  "text": "Спроси имя. Выведи `<имя>: букв <число>`.",
  "example": {
   "in": "Анна",
   "out": "Анна: букв 4"
  },
  "hint": "`len(...)` считает символы в строке. Собери ответ через f-строку.",
  "starter": "# TODO: спроси имя и выведи его длину через len()\n",
  "file": "dlina.py",
  "dir": "lessons/lesson1/task_5_dlina",
  "func": false,
  "steps": [
   "Спроси имя в переменную.",
   "Длина: `len(name)`.",
   "Выведи `имя: букв число` одной f-строкой."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "Анна"
    ],
    "must": [
     "Анна: букв 4"
    ]
   },
   {
    "stdin": [
     "Александр"
    ],
    "must": [
     "Александр: букв 9"
    ]
   },
   {
    "stdin": [
     "Ян"
    ],
    "must": [
     "Ян: букв 2"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "1.6",
  "title": "Среднее трёх оценок",
  "lesson": 1,
  "lessonTitle": "Первая программа",
  "text": "Спроси три оценки (целые, каждая отдельно). Выведи `Среднее: <число>`. Деление `/` всегда даёт дробное число: `4.0`, а не `4`.",
  "example": {
   "in": "5\n4\n3",
   "out": "Среднее: 4.0"
  },
  "hint": "Сложи три числа в скобках и раздели на 3: `(a + b + c) / 3`.",
  "starter": "# TODO: спроси три оценки как целые числа и выведи среднее\n",
  "file": "srednee.py",
  "dir": "lessons/lesson1/task_6_srednee",
  "func": false,
  "steps": [
   "Спроси три оценки, каждую через `int(input())`.",
   "Сложи и раздели: `(a + b + c) / 3`.",
   "Выведи `Среднее: ` и число. Хвост вроде `4.0` или `4.00` не страшен."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "5",
     "4",
     "3"
    ],
    "must": [
     "Среднее: 4.0"
    ]
   },
   {
    "stdin": [
     "5",
     "5",
     "5"
    ],
    "must": [
     "Среднее: 5.0"
    ]
   },
   {
    "stdin": [
     "2",
     "3",
     "4"
    ],
    "must": [
     "Среднее: 3.0"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "1.7",
  "title": "Чек из магазина",
  "lesson": 1,
  "lessonTitle": "Первая программа",
  "text": "Спроси название товара, цену (целое) и количество (целое). Выведи `<товар>: <цена> * <количество> = <итого>`.",
  "example": {
   "in": "Тетрадь\n30\n4",
   "out": "Тетрадь: 30 * 4 = 120"
  },
  "hint": "Три `input()`. Цену и количество превращай в `int()`. Итог можно посчитать прямо в f-строке: `{price * count}`.",
  "starter": "# TODO: спроси товар, цену и количество, выведи строку чека\n",
  "file": "chek.py",
  "dir": "lessons/lesson1/task_7_chek",
  "func": false,
  "steps": [
   "Спроси название, цену и количество. Цена и количество: `int(...)`.",
   "Итог: `price * count`.",
   "Выведи `товар: цена * количество = итого`."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "Тетрадь",
     "30",
     "4"
    ],
    "must": [
     "Тетрадь: 30 * 4 = 120"
    ]
   },
   {
    "stdin": [
     "Ручка",
     "15",
     "2"
    ],
    "must": [
     "Ручка: 15 * 2 = 30"
    ]
   },
   {
    "stdin": [
     "Линейка",
     "55",
     "1"
    ],
    "must": [
     "Линейка: 55 * 1 = 55"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "2.1",
  "title": "Светофор",
  "lesson": 2,
  "lessonTitle": "Условия",
  "text": "Спроси цвет светофора. `красный` → `Стой`, `жёлтый` → `Жди`, `зелёный` → `Иди`, любой другой → `Нет такого цвета`.",
  "example": {
   "in": "красный",
   "out": "Стой"
  },
  "hint": "`if / elif / else`.",
  "starter": "color = input(\"Цвет светофора: \")\n# TODO: if / elif / else\n",
  "file": "svetofor.py",
  "dir": "lessons/lesson2/task_1_svetofor",
  "func": false,
  "steps": [
   "Спроси цвет, лучше сразу `.lower()`.",
   "`if color == \"красный\":` выведи `Стой`.",
   "`elif` для жёлтого и зелёного.",
   "`else` для всего остального."
  ],
  "sample": {
   "task": "Спроси число. Выведи `чётное` или `нечётное`.",
   "code": "n = int(input())\nif n % 2 == 0:\n    print(\"чётное\")\nelse:\n    print(\"нечётное\")",
   "out": "Вход: 7\nВыход: нечётное"
  },
  "cases": [
   {
    "stdin": [
     "красный"
    ],
    "must": [
     "Стой"
    ],
    "must_not": [
     "иди",
     "жди"
    ]
   },
   {
    "stdin": [
     "жёлтый"
    ],
    "must": [
     "Жди"
    ],
    "must_not": [
     "стой",
     "иди"
    ]
   },
   {
    "stdin": [
     "зелёный"
    ],
    "must": [
     "Иди"
    ],
    "must_not": [
     "стой",
     "жди"
    ]
   },
   {
    "stdin": [
     "синий"
    ],
    "must": [
     "Нет такого цвета"
    ],
    "must_not": [
     "стой",
     "жди",
     "иди"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "2.2",
  "title": "Оценка по баллам",
  "lesson": 2,
  "lessonTitle": "Условия",
  "text": "Спроси баллы (0–100). От 85 — `Оценка: 5`, от 65 — `Оценка: 4`, от 45 — `Оценка: 3`, иначе `Оценка: 2`.",
  "example": {
   "in": "70",
   "out": "Оценка: 4"
  },
  "hint": "Проверяй от большего порога к меньшему.",
  "starter": "score = int(input(\"Баллы: \"))\n# TODO: условия\n",
  "file": "otsenka.py",
  "dir": "lessons/lesson2/task_2_otsenka",
  "func": false,
  "steps": [
   "Баллы: `int(input())`.",
   "Сначала самый высокий порог: `if points >= 85`.",
   "Дальше `elif >= 65`, `elif >= 45`.",
   "В конце `else` для двойки."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "90"
    ],
    "must": [
     "Оценка: 5"
    ]
   },
   {
    "stdin": [
     "85"
    ],
    "must": [
     "Оценка: 5"
    ]
   },
   {
    "stdin": [
     "70"
    ],
    "must": [
     "Оценка: 4"
    ]
   },
   {
    "stdin": [
     "50"
    ],
    "must": [
     "Оценка: 3"
    ]
   },
   {
    "stdin": [
     "20"
    ],
    "must": [
     "Оценка: 2"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "2.3",
  "title": "Аттракцион",
  "lesson": 2,
  "lessonTitle": "Условия",
  "text": "Спроси рост (см) и возраст. Можно, если рост не меньше 120 **и** возраст не меньше 7: выведи `Можно`, иначе `Нельзя`.",
  "example": {
   "in": "130\n10",
   "out": "Можно"
  },
  "hint": "Условие с `and`.",
  "starter": "height = int(input(\"Рост, см: \"))\nage = int(input(\"Возраст: \"))\n# TODO: условие с and\n",
  "file": "attraktsion.py",
  "dir": "lessons/lesson2/task_3_attraktsion",
  "func": false,
  "steps": [
   "Спроси рост и возраст как числа.",
   "Условие: `if height >= 120 and age >= 7:`.",
   "Внутри `Можно`, в `else` `Нельзя`."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "130",
     "10"
    ],
    "must": [
     "Можно"
    ],
    "must_not": [
     "нельзя"
    ]
   },
   {
    "stdin": [
     "110",
     "10"
    ],
    "must": [
     "Нельзя"
    ]
   },
   {
    "stdin": [
     "130",
     "5"
    ],
    "must": [
     "Нельзя"
    ]
   },
   {
    "stdin": [
     "120",
     "7"
    ],
    "must": [
     "Можно"
    ],
    "must_not": [
     "нельзя"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "2.4",
  "title": "Городской помощник 1.0",
  "lesson": 2,
  "lessonTitle": "Условия",
  "text": "Спроси расстояние в км. До 2 км включительно — `пешком`, до 8 км включительно — `на наземном транспорте`, иначе — `на метро`. Выведи `Рекомендую: <способ>`.",
  "example": {
   "in": "5",
   "out": "Рекомендую: на наземном транспорте"
  },
  "hint": "Три ветки: `if`, `elif`, `else`. Расстояние — `float`.",
  "starter": "distance = float(input(\"Расстояние, км: \"))\n# TODO: выбери способ и выведи рекомендацию\n",
  "file": "gorodskoy_pomoshchnik.py",
  "dir": "lessons/lesson2/task_4_gorodskoy_pomoshchnik",
  "func": false,
  "steps": [
   "Расстояние: `float(input())`.",
   "`if d <= 2` пешком, `elif d <= 8` наземным транспортом, `else` метро.",
   "Выведи `Рекомендую: ` и способ."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "1.5"
    ],
    "must": [
     "Рекомендую: пешком"
    ]
   },
   {
    "stdin": [
     "2"
    ],
    "must": [
     "пешком"
    ]
   },
   {
    "stdin": [
     "5"
    ],
    "must": [
     "Рекомендую: на наземном транспорте"
    ],
    "must_not": [
     "метро",
     "пешком"
    ]
   },
   {
    "stdin": [
     "8"
    ],
    "must": [
     "наземном"
    ]
   },
   {
    "stdin": [
     "12"
    ],
    "must": [
     "Рекомендую: на метро"
    ],
    "must_not": [
     "пешком",
     "наземном"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "3.1",
  "title": "Таблица умножения",
  "lesson": 3,
  "lessonTitle": "Циклы, списки, функции",
  "text": "Спроси число `n`. Выведи 10 строк вида `n x i = результат`, где `i` от 1 до 10.",
  "example": {
   "in": "7",
   "out": "7 x 1 = 7\n7 x 2 = 14\n...\n7 x 10 = 70"
  },
  "hint": "`for i in range(1, 11):`",
  "starter": "n = int(input(\"Число: \"))\n# TODO: цикл for\n",
  "file": "tablitsa.py",
  "dir": "lessons/lesson3/task_1_tablitsa",
  "func": false,
  "steps": [
   "Спроси число `n`.",
   "Цикл `for i in range(1, 11):`.",
   "В теле цикла: `print(f\"{n} x {i} = {n * i}\")`.",
   "Должно получиться ровно 10 строк."
  ],
  "sample": {
   "task": "Выведи квадраты чисел от 1 до 5.",
   "code": "for i in range(1, 6):\n    print(i * i)",
   "out": "1\n4\n9\n16\n25"
  },
  "cases": [
   {
    "stdin": [
     "7"
    ],
    "must": [
     "7 x 1 = 7",
     "7 x 3 = 21",
     "7 x 10 = 70"
    ]
   },
   {
    "stdin": [
     "12"
    ],
    "must": [
     "12 x 1 = 12",
     "12 x 10 = 120"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "3.2",
  "title": "Сумма до n",
  "lesson": 3,
  "lessonTitle": "Циклы, списки, функции",
  "text": "Напиши функцию `sum_to(n)`: она **возвращает** сумму чисел от 1 до `n`.",
  "example": {
   "in": "sum_to(5)",
   "out": "15"
  },
  "hint": "Накопитель `total = 0` и цикл. Не `print`, а `return`.",
  "starter": "def sum_to(n):\n    # TODO: верни сумму чисел от 1 до n\n    pass\n",
  "file": "summa.py",
  "dir": "lessons/lesson3/task_2_summa",
  "func": true,
  "steps": [
   "Заведи `total = 0` до цикла.",
   "Цикл `for i in range(1, n + 1):`.",
   "В цикле `total += i`.",
   "После цикла `return total`. Не `print`!"
  ],
  "sample": {
   "task": "Функция `product(n)` возвращает произведение чисел от 1 до n.",
   "code": "def product(n):\n    p = 1\n    for i in range(1, n + 1):\n        p *= i\n    return p",
   "out": "product(4) вернёт 24"
  },
  "cases": [],
  "funcs": [
   {
    "name": "sum_to",
    "calls": [
     {
      "args": [
       5
      ],
      "expect": 15
     },
     {
      "args": [
       1
      ],
      "expect": 1
     },
     {
      "args": [
       100
      ],
      "expect": 5050
     },
     {
      "args": [
       0
      ],
      "expect": 0
     }
    ]
   }
  ]
 },
 {
  "id": "3.3",
  "title": "Чек в магазине",
  "lesson": 3,
  "lessonTitle": "Циклы, списки, функции",
  "text": "Пользователь вводит цены по одной, пока не введёт `стоп`. В конце выведи `Итого: <сумма>`.",
  "example": {
   "in": "100\n50.5\nстоп",
   "out": "Итого: 150.5"
  },
  "hint": "`while True`, `break` по слову `стоп`, накопитель.",
  "starter": "# TODO: цикл while True, накопитель, break по слову \"стоп\"\n",
  "file": "pokupki.py",
  "dir": "lessons/lesson3/task_3_pokupki",
  "func": false,
  "steps": [
   "Заведи `total = 0` до цикла.",
   "`while True:` и внутри `x = input()`.",
   "Если `x == \"стоп\"`, то `break`.",
   "Иначе `total += float(x)`.",
   "После цикла выведи `Итого: ` и сумму."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "100",
     "50.5",
     "стоп"
    ],
    "must": [
     "Итого: 150.5"
    ]
   },
   {
    "stdin": [
     "10",
     "20",
     "стоп"
    ],
    "must": [
     "Итого: 30"
    ]
   },
   {
    "stdin": [
     "стоп"
    ],
    "must": [
     "Итого: 0"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "3.4",
  "title": "Функция recommend",
  "lesson": 3,
  "lessonTitle": "Циклы, списки, функции",
  "text": "Напиши функцию `recommend(distance)`. До 2 км включительно возвращает `пешком`, до 8 включительно — `на наземном транспорте`, иначе `на метро`. Функция **возвращает** строку, а не печатает.",
  "example": {
   "in": "recommend(12)",
   "out": "на метро"
  },
  "hint": "Те же условия, что в задании 2.4, но с `return`.",
  "starter": "def recommend(distance):\n    # TODO\n    pass\n",
  "file": "recommend.py",
  "dir": "lessons/lesson3/task_4_recommend",
  "func": true,
  "steps": [
   "Это 2.4, но без `input` и `print`.",
   "Внутри функции те же `if / elif / else`.",
   "Вместо `print` используй `return`."
  ],
  "sample": null,
  "cases": [],
  "funcs": [
   {
    "name": "recommend",
    "calls": [
     {
      "args": [
       1.5
      ],
      "expect": "пешком"
     },
     {
      "args": [
       2
      ],
      "expect": "пешком"
     },
     {
      "args": [
       5
      ],
      "expect": "на наземном транспорте"
     },
     {
      "args": [
       8
      ],
      "expect": "на наземном транспорте"
     },
     {
      "args": [
       12
      ],
      "expect": "на метро"
     }
    ]
   }
  ]
 },
 {
  "id": "3.5",
  "title": "Наибольшее в списке",
  "lesson": 3,
  "lessonTitle": "Циклы, списки, функции",
  "text": "Напиши функцию `biggest(numbers)`: вернуть наибольшее число списка. **Без** встроенной `max()` — циклом.",
  "example": {
   "in": "biggest([3, 9, 2])",
   "out": "9"
  },
  "hint": "Возьми первый элемент как «рекордсмена» и сравнивай с остальными.",
  "starter": "def biggest(numbers):\n    # TODO: без max()\n    pass\n",
  "file": "naibolshee.py",
  "dir": "lessons/lesson3/task_5_naibolshee",
  "func": true,
  "steps": [
   "Возьми `best = numbers[0]`.",
   "Пройди циклом по списку.",
   "Если `x > best`, то `best = x`.",
   "После цикла `return best`."
  ],
  "sample": null,
  "cases": [],
  "funcs": [
   {
    "name": "biggest",
    "calls": [
     {
      "args": [
       [
        3,
        9,
        2
       ]
      ],
      "expect": 9
     },
     {
      "args": [
       [
        -5,
        -2,
        -9
       ]
      ],
      "expect": -2
     },
     {
      "args": [
       [
        7
       ]
      ],
      "expect": 7
     }
    ]
   }
  ]
 },
 {
  "id": "4.1",
  "title": "Сколько слов",
  "lesson": 4,
  "lessonTitle": "Строки, словари, файлы",
  "text": "Спроси фразу. Выведи `Слов: <число>`.",
  "example": {
   "in": "я учу python",
   "out": "Слов: 3"
  },
  "hint": "Метод строки `.split()` и `len()`.",
  "starter": "text = input(\"Фраза: \")\n# TODO: split() и len()\n",
  "file": "slova.py",
  "dir": "lessons/lesson4/task_1_slova",
  "func": false,
  "steps": [
   "Спроси фразу.",
   "`.split()` режет её на слова.",
   "`len(...)` считает слова.",
   "Выведи `Слов: ` и число."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "я учу python"
    ],
    "must": [
     "Слов: 3"
    ]
   },
   {
    "stdin": [
     "привет"
    ],
    "must": [
     "Слов: 1"
    ]
   },
   {
    "stdin": [
     "раз два три четыре"
    ],
    "must": [
     "Слов: 4"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "4.2",
  "title": "Палиндром",
  "lesson": 4,
  "lessonTitle": "Строки, словари, файлы",
  "text": "Напиши функцию `is_palindrome(s)`: `True`, если строка читается одинаково в обе стороны. Регистр и пробелы игнорируются.",
  "example": {
   "in": "is_palindrome(\"Шалаш\")",
   "out": "True"
  },
  "hint": "Срез `s[::-1]`, `.lower()`, `.replace(\" \", \"\")`.",
  "starter": "def is_palindrome(s):\n    # TODO\n    pass\n",
  "file": "palindrom.py",
  "dir": "lessons/lesson4/task_2_palindrom",
  "func": true,
  "steps": [
   "Приведи строку к удобному виду: `.lower().replace(\" \", \"\")`.",
   "Сравни с её же разворотом `s[::-1]`.",
   "`return` результат сравнения."
  ],
  "sample": null,
  "cases": [],
  "funcs": [
   {
    "name": "is_palindrome",
    "calls": [
     {
      "args": [
       "шалаш"
      ],
      "expect": true
     },
     {
      "args": [
       "Шалаш"
      ],
      "expect": true
     },
     {
      "args": [
       "python"
      ],
      "expect": false
     },
     {
      "args": [
       "А роза упала на лапу Азора"
      ],
      "expect": true
     },
     {
      "args": [
       "ab"
      ],
      "expect": false
     }
    ]
   }
  ]
 },
 {
  "id": "4.3",
  "title": "Счётчик букв",
  "lesson": 4,
  "lessonTitle": "Строки, словари, файлы",
  "text": "Напиши функцию `letter_count(text, letter)`: сколько раз буква встречается в тексте. Регистр не важен.",
  "example": {
   "in": "letter_count(\"Банан\", \"а\")",
   "out": "2"
  },
  "hint": "`.lower()` для обеих строк и `.count()` либо цикл.",
  "starter": "def letter_count(text, letter):\n    # TODO\n    pass\n",
  "file": "chastota.py",
  "dir": "lessons/lesson4/task_3_chastota",
  "func": true,
  "steps": [
   "Приведи обе строки к нижнему регистру.",
   "`return text.lower().count(letter.lower())`."
  ],
  "sample": null,
  "cases": [],
  "funcs": [
   {
    "name": "letter_count",
    "calls": [
     {
      "args": [
       "Банан",
       "а"
      ],
      "expect": 2
     },
     {
      "args": [
       "Банан",
       "Н"
      ],
      "expect": 2
     },
     {
      "args": [
       "abc",
       "z"
      ],
      "expect": 0
     },
     {
      "args": [
       "Ааа",
       "а"
      ],
      "expect": 3
     }
    ]
   }
  ]
 },
 {
  "id": "4.4",
  "title": "Переводчик",
  "lesson": 4,
  "lessonTitle": "Строки, словари, файлы",
  "text": "Заведи словарь: `кошка` → `cat`, `собака` → `dog`, `дом` → `house`. Пользователь вводит слова, пока не введёт `стоп`. Для каждого слова выведи перевод, а если слова нет в словаре — `не знаю`.",
  "example": {
   "in": "кошка\nрыба\nстоп",
   "out": "cat\nне знаю"
  },
  "hint": "Словарь `{...}`, проверка `word in d`, `d[word]`.",
  "starter": "words = {\n    \"кошка\": \"cat\",\n    # TODO: добавь остальные слова\n}\n# TODO: цикл до слова \"стоп\"\n",
  "file": "perevodchik.py",
  "dir": "lessons/lesson4/task_4_perevodchik",
  "func": false,
  "steps": [
   "Создай словарь `d = {\"кошка\": \"cat\", ...}`.",
   "Цикл `while True` с `input()` и выходом по `стоп`.",
   "Если слово в словаре, выведи `d[word]`, иначе `не знаю`."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "кошка",
     "дом",
     "рыба",
     "стоп"
    ],
    "must": [
     "cat",
     "house",
     "не знаю"
    ]
   },
   {
    "stdin": [
     "собака",
     "стоп"
    ],
    "must": [
     "dog"
    ],
    "must_not": [
     "не знаю"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "4.5",
  "title": "Приветствие в файле",
  "lesson": 4,
  "lessonTitle": "Строки, словари, файлы",
  "text": "Спроси имя. Запиши в файл `hello.txt` строку `Привет, <имя>!`. Потом прочитай файл и выведи его содержимое на экран.",
  "example": {
   "in": "Анна",
   "out": "Привет, Анна!"
  },
  "hint": "`open(\"hello.txt\", \"w\", encoding=\"utf-8\")` и `with`.",
  "starter": "name = input(\"Имя: \")\n# TODO: запиши в hello.txt, потом прочитай и выведи\n",
  "file": "fayl.py",
  "dir": "lessons/lesson4/task_5_fayl",
  "func": false,
  "steps": [
   "Спроси имя.",
   "Запиши файл: `with open(\"hello.txt\", \"w\", encoding=\"utf-8\") as f:`.",
   "Прочитай его через `\"r\"` и выведи содержимое."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "Анна"
    ],
    "must": [
     "Привет, Анна!"
    ],
    "files": {
     "hello.txt": [
      "Привет, Анна!"
     ]
    }
   },
   {
    "stdin": [
     "Илья"
    ],
    "must": [
     "Привет, Илья!"
    ],
    "files": {
     "hello.txt": [
      "Привет, Илья!"
     ]
    }
   }
  ],
  "funcs": []
 },
 {
  "id": "5.1",
  "title": "Безопасный int",
  "lesson": 5,
  "lessonTitle": "Ошибки и проект",
  "text": "Напиши функцию `safe_int(text)`: если строку можно превратить в целое — вернуть число, иначе вернуть `None`. Программа не должна падать.",
  "example": {
   "in": "safe_int(\"abc\")",
   "out": "None"
  },
  "hint": "`try: return int(text)` и `except ValueError: return None`.",
  "starter": "def safe_int(text):\n    # TODO: try / except\n    pass\n",
  "file": "safe_int.py",
  "dir": "lessons/lesson5/task_1_safe_int",
  "func": true,
  "steps": [
   "В `try` пробуй `return int(text)`.",
   "В `except ValueError:` верни `None`."
  ],
  "sample": null,
  "cases": [],
  "funcs": [
   {
    "name": "safe_int",
    "calls": [
     {
      "args": [
       "5"
      ],
      "expect": 5
     },
     {
      "args": [
       "abc"
      ],
      "expect": null
     },
     {
      "args": [
       "-3"
      ],
      "expect": -3
     },
     {
      "args": [
       "1.5"
      ],
      "expect": null
     },
     {
      "args": [
       ""
      ],
      "expect": null
     }
    ]
   }
  ]
 },
 {
  "id": "5.2",
  "title": "Безопасное деление",
  "lesson": 5,
  "lessonTitle": "Ошибки и проект",
  "text": "Напиши функцию `safe_divide(a, b)`: вернуть `a / b`, а при делении на ноль — `None`. Используй `try / except ZeroDivisionError`.",
  "example": {
   "in": "safe_divide(1, 0)",
   "out": "None"
  },
  "hint": "Не проверяй `b == 0` — пусть Python выбросит ошибку, а ты её поймаешь.",
  "starter": "def safe_divide(a, b):\n    # TODO: try / except ZeroDivisionError\n    pass\n",
  "file": "delenie.py",
  "dir": "lessons/lesson5/task_2_delenie",
  "func": true,
  "steps": [
   "В `try` верни `a / b`.",
   "В `except ZeroDivisionError:` верни `None`."
  ],
  "sample": null,
  "cases": [],
  "funcs": [
   {
    "name": "safe_divide",
    "calls": [
     {
      "args": [
       10,
       2
      ],
      "expect": 5.0
     },
     {
      "args": [
       1,
       0
      ],
      "expect": null
     },
     {
      "args": [
       7,
       2
      ],
      "expect": 3.5
     },
     {
      "args": [
       0,
       5
      ],
      "expect": 0.0
     }
    ]
   }
  ]
 },
 {
  "id": "5.3",
  "title": "Ввод числа с повтором",
  "lesson": 5,
  "lessonTitle": "Ошибки и проект",
  "text": "Спрашивай число, пока пользователь не введёт целое. На неправильный ввод пиши `Ошибка, попробуй ещё раз`. В конце выведи `Принято: <число>`.",
  "example": {
   "in": "abc\n-3",
   "out": "Ошибка, попробуй ещё раз\nПринято: -3"
  },
  "hint": "`while True`, внутри `try / except ValueError`, `break` при успехе.",
  "starter": "# TODO: while True + try / except ValueError\n",
  "file": "vvod_chisla.py",
  "dir": "lessons/lesson5/task_3_vvod_chisla",
  "func": false,
  "steps": [
   "`while True:` и внутри `try`.",
   "В `try`: `n = int(input())` и `break`.",
   "В `except ValueError`: выведи `Ошибка, попробуй ещё раз`.",
   "После цикла выведи `Принято: ` и число."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "5"
    ],
    "must": [
     "Принято: 5"
    ],
    "must_not": [
     "ошибка"
    ]
   },
   {
    "stdin": [
     "abc",
     "-3"
    ],
    "must": [
     "Ошибка",
     "Принято: -3"
    ]
   },
   {
    "stdin": [
     "x",
     "1.5",
     "",
     "7"
    ],
    "must": [
     "Принято: 7"
    ]
   }
  ],
  "funcs": []
 },
 {
  "id": "5.4",
  "title": "Городской помощник 3.0",
  "lesson": 5,
  "lessonTitle": "Ошибки и проект",
  "text": "Собери проект. Спроси имя. Потом в цикле спрашивай расстояние (`стоп` — выход). Если ввели не число — `Это не число`, программа не падает. Иначе выведи `<имя>, рекомендую: <способ>` (до 2 км — `пешком`, до 8 — `на наземном транспорте`, иначе `на метро`). В конце — `Хорошей дороги!`.",
  "example": {
   "in": "Анна\nabc\n1.5\n12\nстоп",
   "out": "Это не число\nАнна, рекомендую: пешком\nАнна, рекомендую: на метро\nХорошей дороги!"
  },
  "hint": "Функция `recommend` из 3.4 + `try / except` из 5.3.",
  "starter": "# TODO: имя, цикл, try / except, recommend\n",
  "file": "gorodskoy_pomoshchnik_3.py",
  "dir": "lessons/lesson5/task_4_gorodskoy_pomoshchnik_3",
  "func": false,
  "steps": [
   "Сначала функция `recommend` из 3.4.",
   "Спроси имя.",
   "Цикл `while True`: ввод, выход по `стоп`.",
   "`try: d = float(x)` / `except ValueError:` выведи `Это не число`.",
   "После цикла выведи `Хорошей дороги!`."
  ],
  "sample": null,
  "cases": [
   {
    "stdin": [
     "Анна",
     "abc",
     "1.5",
     "12",
     "стоп"
    ],
    "must": [
     "Это не число",
     "Анна, рекомендую: пешком",
     "Анна, рекомендую: на метро",
     "Хорошей дороги!"
    ]
   },
   {
    "stdin": [
     "Илья",
     "5",
     "стоп"
    ],
    "must": [
     "Илья, рекомендую: на наземном транспорте",
     "Хорошей дороги!"
    ],
    "must_not": [
     "не число"
    ]
   },
   {
    "stdin": [
     "Мария",
     "стоп"
    ],
    "must": [
     "Хорошей дороги!"
    ]
   }
  ],
  "funcs": []
 }
];
