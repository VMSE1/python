"""Пары программ для игры «Шпион».

Большинство игроков получают первую программу, шпион получает похожую вторую. Результаты работы записаны здесь же,
их проверяет тест (код реально запускается). Формат: (тема 1-5, код большинства, его вывод, код шпиона, его вывод).
"""

PAIRS = [
    (1, 'a = 6\nb = 4\nprint(a * b)', '24', 'a = 6\nb = 4\nprint(a + b)', '10'),
    (1, 'name = "Аня"\nprint("Привет, " + name + "!")', 'Привет, Аня!', 'name = "Аня"\nprint("Пока, " + name + "!")', 'Пока, Аня!'),
    (1, 'x = 17\nprint(x // 5)', '3', 'x = 17\nprint(x % 5)', '2'),
    (1, 's = "ха"\nprint(s * 3)', 'хахаха', 's = "ха"\nprint(s + "3")', 'ха3'),
    (2, 'x = 12\nif x % 2 == 0:\n    print("чётное")\nelse:\n    print("нечётное")', 'чётное', 'x = 12\nif x % 5 == 0:\n    print("чётное")\nelse:\n    print("нечётное")', 'нечётное'),
    (2, 't = 25\nif t > 20:\n    print("тепло")\nelse:\n    print("холодно")', 'тепло', 't = 15\nif t > 20:\n    print("тепло")\nelse:\n    print("холодно")', 'холодно'),
    (2, 'age = 16\nif age >= 18:\n    print("взрослый")\nelif age >= 12:\n    print("подросток")\nelse:\n    print("ребёнок")', 'подросток', 'age = 16\nif age >= 18:\n    print("взрослый")\nelif age >= 17:\n    print("подросток")\nelse:\n    print("ребёнок")', 'ребёнок'),
    (3, 'total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)', '10', 'total = 0\nfor i in range(1, 6):\n    total += i\nprint(total)', '15'),
    (3, 'a = [3, 1, 2]\na.sort()\nprint(a[0])', '1', 'a = [3, 1, 2]\na.sort()\nprint(a[-1])', '3'),
    (3, 'def f(n):\n    return n * n\nprint(f(4))', '16', 'def f(n):\n    return n + n\nprint(f(4))', '8'),
    (3, 'n = 1\nwhile n < 20:\n    n *= 2\nprint(n)', '32', 'n = 1\nwhile n < 20:\n    n *= 3\nprint(n)', '27'),
    (4, 's = "python"\nprint(s[:3])', 'pyt', 's = "python"\nprint(s[-3:])', 'hon'),
    (4, 'd = {"a": 1, "b": 2}\nprint(d["a"] + d["b"])', '3', 'd = {"a": 1, "b": 2}\nprint(d["a"] * d["b"])', '2'),
    (4, 'words = "раз два три".split()\nprint(len(words))', '3', 'words = "раз два три".split("д")\nprint(len(words))', '2'),
    (4, 's = "Hello"\nprint(s.upper())', 'HELLO', 's = "Hello"\nprint(s.lower())', 'hello'),
    (5, 'try:\n    print(10 / 2)\nexcept ZeroDivisionError:\n    print("ноль")', '5.0', 'try:\n    print(10 / 0)\nexcept ZeroDivisionError:\n    print("ноль")', 'ноль'),
    (5, 'try:\n    x = int("12")\nexcept ValueError:\n    x = -1\nprint(x)', '12', 'try:\n    x = int("1x")\nexcept ValueError:\n    x = -1\nprint(x)', '-1'),
    (5, 'import math\nprint(math.ceil(2.1))', '3', 'import math\nprint(math.floor(2.1))', '2'),
    (5, 'a = [1, 2]\ntry:\n    print(a[1])\nexcept IndexError:\n    print("мимо")', '2', 'a = [1, 2]\ntry:\n    print(a[2])\nexcept IndexError:\n    print("мимо")', 'мимо'),
    (1, 'print(2 ** 5)', '32', 'print(5 ** 2)', '25'),
    (2, 'a = 5\nb = 8\nprint(a < b and b < 10)', 'True', 'a = 5\nb = 8\nprint(a < b and b < 7)', 'False'),
    (3, 'r = []\nfor i in range(3):\n    r.append(i)\nprint(r)', '[0, 1, 2]', 'r = []\nfor i in range(1, 4):\n    r.append(i)\nprint(r)', '[1, 2, 3]'),
    (4, 's = "abcabc"\nprint(s.count("a"))', '2', 's = "abcabc"\nprint(s.count("c") + 1)', '3'),
]
