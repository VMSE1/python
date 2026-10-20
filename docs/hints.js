/* Разбор типичных ошибок: превращает «не так» в понятную подсказку.
   Hints.explain(code, task, result) -> [{id, t, x, line?}]  (до 3 самых полезных)
   Правила простые и читаются глазами: добавь своё в STATIC (по коду) или RUNTIME (по тексту ошибки). */
var Hints = (function () {
  var BUILTINS = ["print", "input", "int", "float", "str", "len", "range", "list", "dict", "set", "sum", "min", "max", "abs", "round", "sorted", "open", "type", "True", "False", "None"];

  /* строка без строк и комментария, чтобы правила не срабатывали на тексте в кавычках */
  function bare(line) {
    var out = "", q = "", i, c;
    for (i = 0; i < line.length; i++) {
      c = line[i];
      if (q) { if (c === "\\") { i++; out += "  "; continue; } if (c === q) q = ""; out += " "; continue; }
      if (c === "'" || c === '"') { q = c; out += " "; continue; }
      if (c === "#") break;
      out += c;
    }
    return out;
  }
  function indentOf(l) { return l.match(/^[ \t]*/)[0].length; }
  function lev(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function names(code) {
    var set = {};
    code.split("\n").forEach(function (l) {
      var b = bare(l), mm = b.match(/^\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*[-+*/]?=(?!=)/);
      if (mm) mm[1].split(",").forEach(function (n) { set[n.trim()] = 1; });
      var f = b.match(/^\s*for\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s+in\b/); if (f) f[1].split(",").forEach(function (n) { set[n.trim()] = 1; });
      var d = b.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/); if (d) { set[d[1]] = 1; d[2].split(",").forEach(function (n) { n = n.trim().split("=")[0].trim(); if (n) set[n] = 1; }); }
      var e = b.match(/\bas\s+([A-Za-z_]\w*)/); if (e) set[e[1]] = 1;
    });
    return Object.keys(set);
  }
  function ru(n, a, b, c) { var m = n % 100, k = n % 10; return m > 10 && m < 15 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }

  /* ---------- правила по коду ---------- */
  var STATIC = [
    function colon(L) {
      var res = [];
      L.forEach(function (raw, i) {
        var b = bare(raw);
        if (!/^\s*(if|elif|else|for|while|def|try|except|finally|with|class)\b/.test(b)) return;
        var t = b.replace(/\s+$/, ""); if (!t || t.indexOf(":") >= 0 || /:$/.test(t) || /[,(\[{\\]$/.test(t)) return;
        if (/^\s*(if|elif|while)\b/.test(b) && /\b(else|if)\b.*\b(else)\b/.test(t)) return;
        if ((t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length) return;
        res.push({ id: "colon", line: i + 1, t: "Нет двоеточия в конце строки " + (i + 1), x: "После if, elif, else, for, while и def ставят двоеточие. Тогда Python понимает, что дальше идёт блок." });
      });
      return res.slice(0, 1);
    },
    function assignInCond(L) {
      for (var i = 0; i < L.length; i++) {
        var b = bare(L[i]); if (!/^\s*(if|elif|while)\b/.test(b)) continue;
        if (/(^|[^=!<>:])=(?!=)/.test(b.replace(/^\s*(if|elif|while)\b/, "")))
          return [{ id: "assign-cond", line: i + 1, t: "В строке " + (i + 1) + " стоит =, а нужно ==", x: "Один знак = кладёт значение в переменную. Чтобы сравнить, пиши два знака: if x == 5:" }];
      }
      return [];
    },
    function elseIf(L) {
      for (var i = 0; i < L.length; i++) if (/^\s*(else\s+if\b|elseif\b|elsif\b)/.test(bare(L[i])))
        return [{ id: "else-if", line: i + 1, t: "В строке " + (i + 1) + " пиши elif", x: "В Python «иначе если» пишется одним словом: elif условие:" }];
      return [];
    },
    function printParens(L) {
      for (var i = 0; i < L.length; i++) if (/^\s*print\s+[^\s=(]/.test(L[i]))
        return [{ id: "print-parens", line: i + 1, t: "У print нужны скобки (строка " + (i + 1) + ")", x: "В Python 3 print это функция: print(\"привет\")." }];
      return [];
    },
    function caseNames(L) {
      for (var i = 0; i < L.length; i++) { var m = bare(L[i]).match(/\b(Print|PRINT|Input|INPUT|Int|Float|Len|Range|Str)\s*\(/);
        if (m) return [{ id: "case", line: i + 1, t: "Пиши " + m[1].toLowerCase() + " с маленькой буквы (строка " + (i + 1) + ")", x: "Python различает большие и маленькие буквы: Print и print для него разные слова." }]; }
      return [];
    },
    function smartQuotes(L) {
      for (var i = 0; i < L.length; i++) if (/[“”‘’«»„]/.test(L[i].replace(/#.*/, "")))
        return [{ id: "smart-quotes", line: i + 1, t: "Не те кавычки в строке " + (i + 1), x: "Нужны прямые кавычки \" или '. Фигурные “ ” и ёлочки « » Python не понимает. Часто они появляются при копировании из мессенджера." }];
      return [];
    },
    function lowerBool(L) {
      for (var i = 0; i < L.length; i++) { var m = bare(L[i]).match(/(^|[^.\w])(true|false|none)\b/);
        if (m) return [{ id: "lower-bool", line: i + 1, t: "Пиши " + m[2][0].toUpperCase() + m[2].slice(1) + " с большой буквы", x: "True, False и None в Python пишут с заглавной." }]; }
      return [];
    },
    function fstring(L) {
      for (var i = 0; i < L.length; i++) {
        var m = L[i].replace(/#.*$/, "").match(/(^|[^\w])(["'])([^"']*\{[A-Za-z_][^"']*\}[^"']*)\2/);
        if (m && !/(^|[^A-Za-z])[fF][rR]?$/.test(L[i].slice(0, m.index + m[1].length)) && !/\.format\s*\(/.test(L[i]))
          return [{ id: "fstring", line: i + 1, t: "Перед кавычками в строке " + (i + 1) + " не хватает f", x: "Чтобы значения подставлялись в {}, строку начинают с буквы f: print(f\"Привет, {name}\")." }];
      }
      return [];
    },
    function inputNumber(L, code) {
      var vars = {}, res = [];
      L.forEach(function (raw, i) { var m = bare(raw).match(/^\s*([A-Za-z_]\w*)\s*=\s*input\s*\(/); if (m) vars[m[1]] = i + 1; });
      var keys = Object.keys(vars); if (!keys.length) return res;
      for (var k = 0; k < keys.length; k++) {
        var v = keys[k], re1 = new RegExp("(^|[^\\w.])" + v + "\\s*(?:[<>]=?|[-*/%])\\s*-?\\d"), re2 = new RegExp("\\d\\s*(?:[<>]=?|[-*/+%])\\s*" + v + "(?!\\w)"), re3 = new RegExp("(^|[^\\w.])" + v + "\\s*\\+\\s*-?\\d"), re4 = new RegExp("(^|[^\\w.])" + v + "\\s*\\*\\s*" + "[A-Za-z_]");
        for (var i = 0; i < L.length; i++) {
          if (i + 1 === vars[v]) continue; var b = bare(L[i]);
          if (re1.test(b) || re2.test(b) || re3.test(b))
            return [{ id: "input-text", line: i + 1, t: "«" + v + "» это текст, а не число (строка " + (i + 1) + ")", x: "input() всегда возвращает текст, даже если ввели цифры. Оберни: " + v + " = int(input(...)) для целых или float(input(...)) для дробных." }];
        }
      }
      return res;
    },
    function indent(L) {
      var prev = -1;
      for (var i = 0; i < L.length; i++) {
        var b = bare(L[i]); if (!b.trim()) continue;
        if (prev >= 0) { var pb = bare(L[prev]).replace(/\s+$/, ""); if (/:$/.test(pb) && indentOf(L[i]) <= indentOf(L[prev]) && !/^\s*(else|elif|except|finally)\b/.test(b))
          return [{ id: "indent", line: i + 1, t: "Нет отступа в строке " + (i + 1), x: "Всё, что принадлежит блоку после двоеточия, сдвигают на 4 пробела вправо. Сравни со строкой " + (prev + 1) + "." }]; }
        prev = i;
      }
      return [];
    },
    function tabs(L) {
      var t = false, s = false;
      L.forEach(function (l) { if (/^\t/.test(l)) t = true; if (/^ +\S/.test(l)) s = true; });
      return t && s ? [{ id: "tabs", t: "В отступах смешаны Tab и пробелы", x: "Выбери что-то одно: лучше 4 пробела. Выдели отступы и набери заново." }] : [];
    },
    function orChain(L) {
      for (var i = 0; i < L.length; i++) if (/(==|!=)\s*[\w"']+\s+(or|and)\s+(\d|["'])/.test(bare(L[i])) || /(==|!=)\s*[\w]+\s+(or|and)\s+["']/.test(L[i]))
        return [{ id: "or-chain", line: i + 1, t: "Так «или» не работает (строка " + (i + 1) + ")", x: "Условие x == 1 or 2 всегда истинно. Каждую часть пиши полностью: x == 1 or x == 2." }];
      return [];
    },
    function bareCompare(L) {
      for (var i = 0; i < L.length; i++) if (/^\s*[A-Za-z_]\w*\s*==\s*[^=]/.test(bare(L[i])) && !/^\s*(if|elif|while|return|assert)\b/.test(L[i]))
        return [{ id: "bare-compare", line: i + 1, t: "Строка " + (i + 1) + " ничего не меняет", x: "Два знака == сравнивают. Если хотел положить значение в переменную, пиши один знак =." }];
      return [];
    },
    function brackets(L) {
      var open = 0, close = 0;
      L.forEach(function (l) { var b = bare(l); open += (b.match(/[(\[{]/g) || []).length; close += (b.match(/[)\]}]/g) || []).length; });
      return open > close ? [{ id: "brackets", t: "Не хватает закрывающей скобки", x: "Скобок ( [ { открыто больше, чем закрыто. Пройдись по строкам и посчитай пары." }]
        : close > open ? [{ id: "brackets", t: "Лишняя закрывающая скобка", x: "Скобок ) ] } закрыто больше, чем открыто." }] : [];
    },
    function funcReturn(L, code, task) {
      if (!task || !task.func) return [];
      var hasDef = L.some(function (l) { return /^\s*def\s/.test(l); }), hasRet = L.some(function (l) { return /\breturn\b/.test(bare(l)); }), hasPrint = L.some(function (l) { return /\bprint\s*\(/.test(bare(l)); });
      if (hasDef && !hasRet) return [{ id: "no-return", t: hasPrint ? "Функция печатает, а должна возвращать" : "В функции нет return", x: "В этом задании функция не показывает значение на экране, а отдаёт его через return. Замени print(x) на return x." }];
      return [];
    }
  ];

  /* ---------- правила по тексту ошибки ---------- */
  var RUNTIME = [
    [/expected ':'/, function () { return { id: "colon", t: "Нет двоеточия", x: "После if, elif, else, for, while и def ставят двоеточие." }; }],
    [/'([(\[{])' was never closed/, function (m) { return { id: "brackets", t: "Скобка " + m[1] + " не закрыта", x: "Для каждой открывающей скобки нужна закрывающая." }; }],
    [/unterminated string literal/, function () { return { id: "quote", t: "Не закрыта кавычка", x: "Текст в кавычках должен начинаться и заканчиваться одинаковой кавычкой на одной строке." }; }],
    [/expected an indented block/, function () { return { id: "indent", t: "После двоеточия нужна строка с отступом", x: "Тело блока сдвигают на 4 пробела вправо." }; }],
    [/unexpected indent/, function () { return { id: "unexpected-indent", t: "Лишний отступ", x: "Строка сдвинута вправо без причины. Отступ нужен только после двоеточия." }; }],
    [/unindent does not match/, function () { return { id: "unindent", t: "Отступы не совпадают", x: "Строки одного блока должны иметь одинаковый отступ." }; }],
    [/invalid syntax\. Perhaps you forgot a comma/, function () { return { id: "comma", t: "Возможно, забыта запятая", x: "Проверь строку: между значениями в print() или в списке нужна запятая." }; }],
    [/cannot assign to (literal|expression|function call)/, function () { return { id: "assign-target", t: "Слева от = должно стоять имя переменной", x: "Пиши так: имя = значение, а не значение = имя." }; }],
    [/'(?:<|>|<=|>=)' not supported between instances of '(str|int|float)' and '(str|int|float)'/, function () { return { id: "input-text", t: "Сравниваются текст и число", x: "Скорее всего, input() вернул текст. Оберни: int(input(...)) или float(input(...))." }; }],
    [/can only concatenate str \(not "(int|float)"\) to str|unsupported operand type\(s\) for \+: '(int|float)' and 'str'/, function () { return { id: "str-plus-num", t: "Нельзя сложить текст и число", x: "Преврати число в текст: str(x), или используй f-строку: f\"Итого: {x}\"." }; }],
    [/can't multiply sequence by non-int|unsupported operand type\(s\) for [-*\/%]+: '?(str|int|float)'? and '?(str|int|float)'?/, function () { return { id: "str-math", t: "Считаешь с текстом", x: "Один из операндов текст. Если он пришёл из input(), оберни его в int() или float()." }; }],
    [/invalid literal for int\(\) with base 10: '(-?\d+[.,]\d+)'/, function (m) { return { id: "int-float", t: "int() не принимает дробное «" + m[1] + "»", x: "Для чисел с точкой используй float(input(...))." }; }],
    [/invalid literal for int\(\) with base 10/, function () { return { id: "int-bad", t: "В int() попало не целое число", x: "int() понимает только целые числа. Проверь, что именно вводят, и нет ли лишних пробелов или букв." }; }],
    [/could not convert string to float/, function () { return { id: "float-bad", t: "В float() попало не число", x: "Проверь, что вводят. Дробная часть через точку: 1.5, не 1,5." }; }],
    [/ZeroDivisionError/, function () { return { id: "zero", t: "Деление на ноль", x: "Проверь, чему равен делитель. Можно добавить условие if делитель != 0." }; }],
    [/IndexError/, function () { return { id: "index", t: "Такого номера в списке или строке нет", x: "Номера идут с нуля: в списке из 3 элементов последний номер 2. Для последнего можно взять [-1]." }; }],
    [/KeyError/, function () { return { id: "key", t: "Такого ключа нет в словаре", x: "Проверь написание ключа, регистр и кавычки. Безопасно: словарь.get(ключ)." }; }],
    [/AttributeError: '(\w+)' object has no attribute '(\w+)'/, function (m) { return { id: "attr", t: "У типа " + m[1] + " нет метода " + m[2], x: "Проверь написание метода и что это за тип. Например, .append есть у списка, а у строки нет." }; }],
    [/EOFError|input\(\) вызван больше раз/, function () { return { id: "extra-input", t: "Лишний input()", x: "Программа просит ввести данных больше, чем нужно по условию. Посчитай, сколько значений спрашивают в примере." }; }],
    [/не завершилась за 8 секунд/, function () { return { id: "loop", t: "Программа не заканчивается", x: "Скорее всего, цикл while никогда не останавливается. Проверь: меняется ли внутри цикла то, от чего зависит условие?" }; }],
    [/RecursionError/, function () { return { id: "recursion", t: "Функция вызывает сама себя без конца", x: "Нужно условие выхода: когда функция перестаёт вызывать себя." }; }],
    [/функция (\w+) не найдена/, function (m) { return { id: "func-name", t: "Нет функции " + m[1], x: "Имя после def должно совпадать буква в букву, по условию: def " + m[1] + "(...):" }; }],
    [/вернула None/, function () { return { id: "none", t: "Функция вернула None", x: "None значит «ничего». Скорее всего, в функции нет return или он стоит не на всех ветках." }; }],
    [/ValueError/, function () { return { id: "value", t: "Значение не подошло по типу", x: "Проверь, что именно попадает в функцию, и нужно ли преобразование." }; }],
    [/TypeError: .*positional argument/, function () { return { id: "args", t: "Не то число аргументов", x: "Сравни, сколько значений передаёшь и сколько параметров в def." }; }]
  ];

  function nameErrors(msgs, code) {
    var res = [], seen = {};
    msgs.forEach(function (m) {
      var r = m.match(/NameError: name '([^']+)' is not defined/); if (!r || seen[r[1]]) return; seen[r[1]] = 1;
      var w = r[1], known = names(code).concat(BUILTINS), best = null, bd = 99;
      known.forEach(function (k) { var d = lev(w.toLowerCase(), k.toLowerCase()); if (d < bd) { bd = d; best = k; } });
      if (best && bd <= 2 && best !== w) res.push({ id: "name-typo", t: "Имя «" + w + "» не найдено. Может, «" + best + "»?", x: "Python не знает такого имени. Скорее всего, опечатка или другая заглавная буква." });
      else res.push({ id: "name-undef", t: "Имя «" + w + "» не создано", x: "Переменную сначала создают: " + w + " = ... Если это просто слово, возьми его в кавычки: \"" + w + "\"." });
    });
    return res;
  }

  function outputHints(msgs, sample) {
    var res = [];
    msgs.forEach(function (m) {
      var r = m.match(/в выводе должно быть «(.*)»$/); if (!r || res.length) return;
      var want = r[1], got = String(sample || "");
      var n = function (s) { return s.replace(/\s+/g, " ").trim(); }, strip = function (s) { return s.toLowerCase().replace(/[\s.,:;!?«»"'()-]+/g, ""); };
      if (n(got).indexOf(n(want)) >= 0) return;
      if (got.toLowerCase().indexOf(want.toLowerCase()) >= 0) res.push({ id: "out-case", t: "Вывод отличается регистром", x: "Нужно «" + want + "». Проверь заглавные и маленькие буквы." });
      else if (strip(got).indexOf(strip(want)) >= 0) res.push({ id: "out-punct", t: "Вывод отличается знаками или пробелами", x: "Нужно ровно «" + want + "». Проверь двоеточие, пробел после него и точку." });
      else if (/\d/.test(want) && /\d/.test(got)) res.push({ id: "out-number", t: "Число получилось другим", x: "Нужно «" + want + "», у тебя другое число. Проверь формулу и порядок действий." });
      else if (!got.trim()) res.push({ id: "out-empty", t: "Программа ничего не вывела", x: "Результат нужно показать через print(...). Проверь, что print стоит и до него доходит выполнение." });
      else res.push({ id: "out-text", t: "Вывод не совпадает с примером", x: "Сравни свой вывод с примером в условии: нужно ровно «" + want + "»." });
    });
    return res;
  }

  function explain(code, task, result) {
    if (!result || result.ok || result.todo) return [];
    code = String(code || ""); var L = code.split("\n"), msgs = result.messages || [], all = msgs.join("\n"), out = [], seen = {};
    function add(h) { if (h && !seen[h.id]) { seen[h.id] = 1; out.push(h); } }
    // 1. ошибки Python, это самое точное
    msgs.concat(msgs.length ? [] : [all]).forEach(function (one) {
      for (var i = 0; i < RUNTIME.length; i++) { var m = one.match(RUNTIME[i][0]); if (m) { add(RUNTIME[i][1](m)); break; } }
    });
    nameErrors(msgs, code).forEach(add);
    // 2. вывод не совпал
    outputHints(msgs, result.sample).forEach(add);
    // 3. подозрения по коду (если Python уже назвал причину, не дублируем)
    STATIC.forEach(function (f) { f(L, code, task).forEach(function (h) { if (!seen[h.id] && !(h.id === "brackets" && seen.brackets)) add(h); }); });
    var order = { colon: 0, brackets: 0, quote: 0, indent: 1, "unexpected-indent": 1, unindent: 1, "assign-cond": 2, "input-text": 2 };
    if (seen["no-return"]) out = out.filter(function (h) { return h.id !== "none"; });
    out.sort(function (a, b) { return (order[a.id] == null ? 5 : order[a.id]) - (order[b.id] == null ? 5 : order[b.id]); });
    return out.slice(0, 3);
  }

  function html(list) {
    if (!list || !list.length) return "";
    return '<div class="hintbox"><h4>Подсказка робота</h4>' + list.map(function (h) { return "<div class=\"hint\"><b>" + esc(h.t) + "</b><p>" + esc(h.x) + "</p></div>"; }).join("") + "</div>";
  }
  return { explain: explain, html: html, _lev: lev, _bare: bare };
})();
if (typeof module !== "undefined") module.exports = Hints;
