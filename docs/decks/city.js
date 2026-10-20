/* Презентация «Городской помощник». Тексты и примеры взяты из исходной презентации (pptx).
   Примеры кода запускаются по настоящим трассировкам (decks/traces.js, tools/make_traces.py). */
(function () {
  var K = DeckKit, card = K.card, E = K.esc, Q = function (s, q) { return s.querySelector(q); }, QA = function (s, q) { return Array.prototype.slice.call(s.querySelectorAll(q)); };
  function bul(items, frag) { return '<ul class="bul">' + items.map(function (t) { return "<li" + (frag ? ' class="frag"' : "") + ">" + t + "</li>"; }).join("") + "</ul>"; }
  function pks(list, cls) { return list.map(function (t, i) { return '<button class="pk ' + (cls || "") + '" data-i="' + i + '">' + t + "</button>"; }).join(""); }
  function timers(sec) { sec._t = sec._t || []; return { add: function (f, ms) { sec._t.push(setTimeout(f, ms)); }, clear: function () { (sec._t || []).forEach(clearTimeout); sec._t = []; } }; }

  var S = [];

  S.push({ t: "Профессиональная проба", ic: "pc", cls: "title",
    html: '<h1>Программист: пишем первое приложение</h1><div class="sub">«Городской помощник» на Python</div>' +
      '<div class="cons" style="min-width:50%"><span class="ps">&gt;&gt;&gt; </span><span class="typ"></span>\n<span class="typo"></span></div>' +
      '<p class="m">09.02.11 · ГБПОУ Колледж «Царицыно». Листай стрелками → ← или кнопками ниже. Пробел и стрелки работают с клавиатуры.</p>',
    init: function (sec) {
      var t = Q(sec, ".typ"), o = Q(sec, ".typo"), T = timers(sec);
      sec._show = function () { T.clear(); o.textContent = ""; K.typeInto(t, 'print("Привет, мир!")', 55); if (K.reduced) o.textContent = "Привет, мир!"; else T.add(function () { o.textContent = "Привет, мир!"; }, 1700); };
      sec._stop = T.clear;
    } });

  S.push({ t: "Кто такой программист", ic: "team",
    html: '<p class="lead">Нажми на карточку, чтобы узнать подробнее.</p><div class="cards">' +
      card("win", "Приложения", "Мобильные и настольные программы", "", "button") + card("globe", "Сайты", "Веб-приложения и сервисы", "", "button") +
      card("disk", "Системы", "Базы данных и информационные системы", "", "button") + card("team", "Команда", "Аналитик, программист, тестировщик", "", "button") +
      '</div><div class="sunk info" role="status" style="min-height:3.2em"></div><div class="note">Программист отвечает за качество и результат: программа должна работать правильно.</div>',
    init: function (sec) {
      var info = ["Мессенджер, игра, редактор: то, чем ты пользуешься каждый день.", "Магазин, школьный портал, соцсеть: всё, что открывается в браузере.", "Банк, школа, больница: данные и правила, на которых всё держится.", "Аналитик придумывает задачу, программист пишет код, тестировщик ищет ошибки."];
      var cs = QA(sec, "button.cd"); cs.forEach(function (c, i) { c.onclick = function () { cs.forEach(function (x) { x.classList.remove("on"); }); c.classList.add("on"); Q(sec, ".info").textContent = info[i]; }; });
    } });

  S.push({ t: "Что такое Python?", ic: "book",
    html: '<div class="row"><div>' + bul(["Язык программирования: на нём пишут программы простым и понятным кодом", "Создан Гвидо ван Россумом, первая версия вышла в 1991 году", "Название пришло из комедийного шоу Monty Python, а не от змеи", "Читается почти как обычный английский текст", "Бесплатный: работает на Windows, macOS и Linux"], true) +
      '</div><div><div class="big" style="margin-bottom:.6em">Python 3</div><div class="cons"><span class="ps">&gt;&gt;&gt; </span><span class="typ"></span></div></div></div>',
    init: function (sec) { var T = timers(sec); sec._show = function () { T.clear(); K.typeInto(Q(sec, ".typ"), 'if age >= 18: print("можно")', 60); }; sec._stop = T.clear; } });

  S.push({ t: "Почему выбирают Python?", ic: "check",
    html: '<div class="cards">' + card("doc", "Понятный код", "Меньше кода для той же задачи, легче читать", "frag") + card("folder", "Готовые библиотеки", "Тысячи модулей: не нужно писать всё с нуля", "frag") +
      card("team", "Большое сообщество", "Много уроков, примеров и ответов на вопросы", "frag") + card("pc", "Работает везде", "Windows, macOS, Linux и даже телефоны", "frag") +
      '</div><div class="note frag">Для начинающих Python часто выбирают первым языком: он помогает понять саму логику программирования.</div>' });

  S.push({ t: "Где используют Python?", ic: "globe",
    html: '<div class="cards">' + card("bulb", "Нейросети", "ИИ и машинное обучение", "frag") + card("globe", "Сайты", "веб-сервисы и сервера", "frag") + card("chart", "Данные", "анализ таблиц и статистика", "frag") +
      card("game", "Игры", "простые игры и прототипы", "frag") + card("gear", "Автоматизация", "рутинные задачи на компьютере", "frag") +
      '</div><div class="note">Тот же язык, который вы учите сегодня, используется и в больших проектах.</div>' });

  S.push({ t: "Жизненный цикл программы", ic: "gear",
    html: '<div class="flow lc">' + ["Анализ|doc", "Проектирование|book", "Код|pc", "Тестирование|bug", "Выпуск|check", "Сопровождение|gear"].map(function (x, i) {
      var p = x.split("|"); return '<button class="nd" data-i="' + i + '" style="cursor:pointer;font:inherit;color:inherit">' + pix(p[1]) + (i + 1) + ". " + p[0] + "</button>" + (i < 5 ? '<span class="ar">→</span>' : "");
    }).join("") + '</div><div class="row"><div><button class="pk play">▶ Показать цикл</button></div></div><div class="sunk lcd" role="status" style="min-height:3.4em">Нажми на этап или на «Показать цикл».</div>' +
      '<div class="note"><b>Почему тестирование важно.</b> Ошибку, найденную до выпуска, исправить проще и дешевле, чем после того, как программой начали пользоваться.</div>',
    init: function (sec) {
      var nd = QA(sec, ".nd"), d = Q(sec, ".lcd"), T = timers(sec);
      var tx = ["Что должна делать программа и для кого?", "Рисуем схему и план: как программа будет устроена.", "Пишем программу на языке программирования.", "Проверяем: работает ли так, как задумано, и ищем ошибки.", "Программа попадает к пользователям.", "Исправляем ошибки и добавляем новое. Цикл начинается снова."];
      function mark(k, all) { nd.forEach(function (n, j) { n.classList.toggle("on", j === k); n.classList.toggle("done", all && j < k); }); if (k >= 0) d.textContent = (k + 1) + ". " + tx[k]; }
      nd.forEach(function (n, i) { n.onclick = function () { T.clear(); mark(i, false); }; });
      Q(sec, ".play").onclick = function () { T.clear(); nd.forEach(function (n, i) { T.add(function () { mark(i, true); }, i * 800); }); };
      sec._stop = T.clear;
    } });

  S.push({ t: "Алгоритм: план действий", ic: "doc",
    html: '<div class="row"><div><p class="lead">Пример: «Приготовить чай»</p><ol class="alg"></ol></div><div><p>Алгоритм: чёткие шаги, которые выполняются по порядку.</p><div class="btns"><button class="pk run">▶ Выполнить</button> <button class="pk mix">Перепутать шаги 2 и 4</button></div><div class="sunk rsl" role="status" style="margin-top:.6em;font-size:.7em"></div></div></div><div class="note">Порядок важен: поменяешь шаги местами, и результат будет другим.</div>',
    init: function (sec) {
      var base = ["Налить воду в чайник", "Вскипятить воду", "Положить пакетик в чашку", "Залить кипятком", "Подождать 3 минуты"], order = [0, 1, 2, 3, 4], T = timers(sec), ol = Q(sec, ".alg"), res = Q(sec, ".rsl"), mixed = false;
      function draw(on, done) { ol.innerHTML = order.map(function (o, i) { return '<li class="' + (i === on ? "on" : i < done ? "done" : "") + '"><b>' + (i + 1) + "</b>" + E(base[o]) + "</li>"; }).join(""); }
      draw(-1, 0);
      Q(sec, ".run").onclick = function () {
        T.clear(); res.textContent = ""; res.className = "sunk rsl";
        order.forEach(function (o, i) { T.add(function () { draw(i, i); }, i * 650); });
        T.add(function () {
          draw(-1, 5);
          var bad = order.indexOf(3) < order.indexOf(1);
          res.textContent = bad ? "Ошибка: заливаем кипятком, а воду ещё не вскипятили ✗" : "Чай готов ✓"; res.className = "sunk rsl " + (bad ? "bad-t" : "ok-t");
        }, order.length * 650);
      };
      Q(sec, ".mix").onclick = function () { T.clear(); mixed = !mixed; order = mixed ? [0, 3, 2, 1, 4] : [0, 1, 2, 3, 4]; this.textContent = mixed ? "Вернуть порядок" : "Перепутать шаги 2 и 4"; res.textContent = ""; draw(-1, 0); };
      sec._stop = T.clear;
    } });

  S.push({ t: "Первая программа: print()", ic: "pc", html: K.runner("print", "hello.py") + '<p class="m">print() выводит значение на экран. Всё после # компьютер пропускает: это комментарий.</p>' });

  S.push({ t: "Арифметика в Python", ic: "chart",
    html: '<div class="row"><div class="sunk"><pre style="margin:0;font:inherit">+   сложение     2 + 3   → 5\n-   вычитание    5 - 2   → 3\n*   умножение    2 * 3   → 6\n/   деление      7 / 2   → 3.5\n//  целая часть  7 // 2  → 3\n%   остаток      7 % 2   → 1\n**  степень      2 ** 3  → 8</pre></div>' +
      '<div><p class="lead">Попробуй сам:</p><label class="ine"><span class="ps" style="background:#000;padding:.2em .4em">print(</span><input type="text" class="ex" value="2 + 3 * 2" maxlength="30" aria-label="Выражение"><span class="ps" style="background:#000;padding:.2em .4em">)</span></label>' +
      '<div class="pre">' + ["2 + 3 * 2", "(2 + 3) * 2", "7 / 2", "7 // 2", "7 % 2", "2 ** 3"].map(function (x) { return '<button class="pk" data-v="' + E(x) + '">' + E(x) + "</button>"; }).join("") + '</div><div class="cons out" role="status" style="margin-top:.6em;min-height:2.4em"></div></div></div>' +
      '<div class="note"><b>Порядок действий.</b> Умножение выполняется раньше сложения: print(2 + 3 * 2) → 8. Если не уверен, используй скобки.</div>',
    init: function (sec) {
      var ex = Q(sec, ".ex"), out = Q(sec, ".out");
      function upd() { try { out.textContent = K.calc(ex.value); out.className = "cons out"; } catch (e) { out.textContent = e.message === "пусто" ? "" : e.message.indexOf("Error") > 0 ? e.message : "SyntaxError: " + e.message; out.className = "cons out"; out.style.color = "#ff8a8a"; return; } out.style.color = ""; }
      ex.oninput = upd; QA(sec, ".pk").forEach(function (c) { c.onclick = function () { ex.value = c.getAttribute("data-v"); upd(); }; }); upd();
    } });

  S.push({ t: "Python: переменные, ввод и вывод", ic: "disk",
    html: K.runner("vars", "vars.py") + '<div class="cards mini">' + card("", "input()", "получает данные от пользователя; результат всегда текст") + card("", "float()", 'превращает текст в число: "1.5" → 1.5') +
      card("", "переменная", "«коробка» с именем, в которой хранится значение") + card("", "print()", "выводит результат на экран") + "</div>" });

  S.push({ t: "Типы данных и частые ошибки", ic: "bug",
    html: '<div class="row"><div class="sunk"><b class="big" style="font-size:.9em">Типы данных</b><p style="margin:.5em 0 0">Нажми на значение:</p><div>' +
      [["5", "int", "целое число"], ["1.5", "float", "дробное число"], ['"Анна"', "str", "текст"], ["True", "bool", "True или False"], ['"5"', "str", "в кавычках, значит текст, даже если это цифра"]].map(function (x, i) { return '<button class="pk ty" data-i="' + i + '">' + E(x[0]) + "</button>"; }).join("") +
      '</div><div class="cons tyo" role="status" style="min-height:4.2em;margin-top:.5em"></div></div>' +
      '<div class="sunk"><b class="big" style="font-size:.9em">Частые ошибки</b><p style="margin:.5em 0 0">Нажми на ошибку:</p><div>' + ["SyntaxError", "NameError", "ValueError", "TypeError"].map(function (x, i) { return '<button class="pk er" data-i="' + i + '">' + x + "</button>"; }).join("") +
      '</div><div class="cons ero" role="status" style="min-height:4.2em;margin-top:.5em"></div></div></div>',
    init: function (sec) {
      var T = [["5", "int", "целое число"], ["1.5", "float", "дробное число"], ['"Анна"', "str", "текст"], ["True", "bool", "True или False"], ['"5"', "str", "в кавычках, значит текст, даже если это цифра"]];
      var R = [["if x > 1", "SyntaxError: expected ':'", "нет двоеточия или неверный отступ"], ["print(naem)", "NameError: name 'naem' is not defined", "переменная не создана"], ['float("abc")', "ValueError: could not convert string to float: 'abc'", "в число превращают только то, что похоже на число"], ['"Анна" + 5', 'TypeError: can only concatenate str (not "int") to str', "текст сложили с числом"]];
      function set(sel, cls, k, f) { QA(sec, cls).forEach(function (b) { b.onclick = function () { QA(sec, cls).forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); Q(sec, sel).textContent = f(+b.getAttribute("data-i")); }; }); }
      set(".tyo", ".ty", 0, function (i) { return ">>> type(" + T[i][0] + ")\n<class '" + T[i][1] + "'>   # " + T[i][2]; });
      set(".ero", ".er", 0, function (i) { return ">>> " + R[i][0] + "\n" + R[i][1] + "\n# " + R[i][2]; });
    } });

  S.push({ t: "Циклы: повторяем действия", ic: "gear",
    html: '<p class="lead">Цикл повторяет блок кода несколько раз. Так не нужно писать одно и то же вручную.</p><div><button class="pk on tab" data-t="for">for по списку</button><button class="pk tab" data-t="range">for и range(3)</button></div>' +
      '<div class="tb tb-for">' + K.runner("for", "for_list.py") + '</div><div class="tb tb-range" hidden>' + K.runner("range", "for_range.py") + '</div><p class="m">Циклы for и while подробно изучат на следующих занятиях.</p>',
    init: function (sec) {
      QA(sec, ".tab").forEach(function (b) { b.onclick = function () { QA(sec, ".tab").forEach(function (x) { x.classList.toggle("on", x === b); }); QA(sec, ".tb").forEach(function (t) { var on = t.classList.contains("tb-" + b.getAttribute("data-t")); if (!on) { var r = Q(t, ".rn"); if (r._stop) r._stop(); } t.hidden = !on; if (on) { var r2 = Q(t, ".rn"); if (r2._show) r2._show(); } }); }; });
    } });

  S.push({ t: "Python: условия if / elif / else", ic: "check",
    html: '<div class="row"><div><div class="rn-code codebox" id="ifc"></div></div><div><label>distance = <b class="dv">5</b> км</label><input type="range" min="0" max="12" step="0.5" value="5" class="sl-r" aria-label="Расстояние в километрах">' + K.numline("nl14") + '<div class="sunk rsl" role="status" style="font-size:.7em;margin-top:.8em"></div></div></div>' +
      '<div class="note">Отступ в 4 пробела показывает, какой код относится к условию. Сравнения: ==  !=  &lt;  &gt;  &lt;=  &gt;=</div>',
    init: function (sec) {
      var rg = Q(sec, ".sl-r"), box = Q(sec, "#ifc"), dv = Q(sec, ".dv"), res = Q(sec, ".rsl");
      var names = ["пешком", "на наземном транспорте", "на метро"];
      function upd() {
        var d = parseFloat(rg.value), b = K.branchOf(d), code = "distance = " + d + '\nif distance <= 2:\n    transport = "пешком"\nelif distance <= 8:\n    transport = "на наземном транспорте"\nelse:\n    transport = "на метро"\nprint(transport)';
        box.innerHTML = K.codeHtml(code, -1, [0, 1 + b * 2, 2 + b * 2]); dv.textContent = d; K.setMark("nl14", d); res.textContent = "print(transport) → " + names[b];
      }
      rg.oninput = upd; upd();
    } });

  S.push({ t: "Python: что такое функция", ic: "folder",
    html: '<div class="row"><div style="flex:2 1 24em">' + K.runner("func", "func.py") + '</div><div class="fd"><div class="nd in-n">distance<br><small class="m">аргумент (вход)</small></div><span class="ar">▼</span><div class="nd fn-n">recommend()<br><small class="m">def, if, return</small></div><span class="ar">▼</span><div class="nd out-n">"пешком"<br><small class="m">результат (выход)</small></div></div></div>' +
      '<div class="note">Функция — именованный блок кода, который можно вызывать много раз. Как рецепт: записали один раз, готовим сколько угодно.</div>',
    init: function (sec) {
      var rn = Q(sec, ".rn"), fn = Q(sec, ".fn-n"), inn = Q(sec, ".in-n"), outn = Q(sec, ".out-n");
      rn.onstep = function (s) { fn.classList.toggle("on", !!(s && s.f)); inn.classList.toggle("on", !!(s && s.f && s.v.distance)); outn.classList.toggle("on", !!(s && s.l === 5 && s.o)); };
    } });

  S.push({ t: "Строки и списки", ic: "book",
    html: '<div class="row"><div style="flex:2 1 24em">' + K.runner("lists", "lists.py") + '</div><div><p>Нажми на элемент списка:</p><div class="cells">' + ["Москва", "Химки", "Мытищи", "Королёв"].map(function (c, i) { return '<button class="cl" data-i="' + i + '"' + (i === 3 ? " hidden" : "") + "><small>" + i + "</small>" + c + "</button>"; }).join("") + '</div><div class="cons cr" role="status" style="margin-top:.6em;min-height:2.6em"></div></div></div>' +
      '<div class="note">Важно: в Python нумерация элементов начинается с 0, а не с 1. Строка — текст в кавычках, список — несколько значений в одной переменной.</div>',
    init: function (sec) {
      var rn = Q(sec, ".rn"), cl = QA(sec, ".cl"), cr = Q(sec, ".cr");
      cl.forEach(function (c) { c.onclick = function () { cl.forEach(function (x) { x.classList.remove("on"); }); c.classList.add("on"); cr.textContent = "cities[" + c.getAttribute("data-i") + "]  →  \"" + c.textContent.replace(/^\d/, "") + "\""; }; });
      rn.onstep = function (s) { cl[3].hidden = !(s && s.v.cities && s.v.cities.indexOf("Королёв") >= 0); };
    } });

  S.push({ t: "Схема «Городского помощника»", ic: "doc",
    html: '<div class="flow sch"><div class="nd" data-k="0">' + pix("doc") + 'Ввод имени</div><span class="ar">→</span><div class="nd" data-k="1">' + pix("doc") + 'Ввод расстояния</div><span class="ar">→</span><div class="nd" data-k="2">' + pix("help") + 'Проверка условий</div><span class="ar">→</span>' +
      '<div class="col"><div class="nd" data-b="0">≤ 2 км: пешком</div><div class="nd" data-b="1">≤ 8 км: наземный</div><div class="nd" data-b="2">иначе: метро</div></div><span class="ar">→</span><div class="nd" data-k="4">' + pix("check") + 'Вывод ответа</div></div>' +
      '<div><span class="m">Пройди схему для:</span> <button class="pk" data-n="Анна" data-d="1.5">Анна, 1.5 км</button><button class="pk" data-n="Илья" data-d="5">Илья, 5 км</button><button class="pk" data-n="Мария" data-d="12">Мария, 12 км</button></div>' +
      '<div class="sunk rsl" role="status" style="min-height:2.6em"></div><div class="note">Совет: нарисуйте такую же схему на доске, прежде чем писать код.</div>',
    init: function (sec) {
      var T = timers(sec), res = Q(sec, ".rsl");
      function nd(k) { return Q(sec, '[data-k="' + k + '"]'); }
      QA(sec, ".pk").forEach(function (c) { c.onclick = function () {
        T.clear(); var d = parseFloat(c.getAttribute("data-d")), n = c.getAttribute("data-n"), b = K.branchOf(d);
        var seq = [nd(0), nd(1), nd(2), Q(sec, '[data-b="' + b + '"]'), nd(4)];
        QA(sec, ".nd").forEach(function (x) { x.classList.remove("on", "done"); }); res.textContent = "";
        seq.forEach(function (e, i) { T.add(function () { if (i) seq[i - 1].classList.replace("on", "done"); e.classList.add("on"); if (i === 4) res.textContent = K.cityAnswer(n, d); }, i * 650); });
      }; });
      sec._stop = T.clear;
    } });

  S.push({ t: "Границы условий на числовой прямой", ic: "chart",
    html: '<p class="lead">Ошибки чаще всего возникают у границ. Угадай, что выведет программа:</p>' + K.numline("nl18") +
      '<div class="big qd" style="min-height:1.6em"></div><div><button class="pk a" data-i="0">пешком</button><button class="pk a" data-i="1">на наземном транспорте</button><button class="pk a" data-i="2">на метро</button></div>' +
      '<div class="sunk rsl" role="status" style="min-height:3em"></div><div><button class="pk nx" hidden>Дальше →</button> <span class="m sc"></span></div>',
    init: function (sec) {
      var R = [[2, "2 <= 2 верно, значит «пешком»"], [2.1, "2.1 <= 2 неверно, а 2.1 <= 8 верно: наземный транспорт"], [8, "8 <= 2 неверно, а 8 <= 8 верно: наземный транспорт"], [8.1, "8.1 <= 8 неверно, значит else: метро"]], r = 0, score = 0, locked = false;
      var as = QA(sec, ".a"), res = Q(sec, ".rsl"), nx = Q(sec, ".nx"), qd = Q(sec, ".qd"), sc = Q(sec, ".sc");
      function show() { locked = false; var d = R[r][0]; qd.textContent = "distance = " + d; K.setMark("nl18", d); res.textContent = ""; nx.hidden = true; as.forEach(function (a) { a.className = "pk a"; a.disabled = false; }); sc.textContent = "Вопрос " + (r + 1) + " из " + R.length; }
      as.forEach(function (a) { a.onclick = function () {
        if (locked) return; locked = true; var right = K.branchOf(R[r][0]), pick = +a.getAttribute("data-i");
        a.classList.add(pick === right ? "good" : "bad"); as[right].classList.add("good"); if (pick === right) score++;
        res.textContent = (pick === right ? "Верно. " : "Не угадал. ") + R[r][1]; nx.hidden = false; nx.textContent = r === R.length - 1 ? "Итог" : "Дальше →";
      }; });
      function again() { r = 0; score = 0; nx.onclick = onNext; show(); }
      function onNext() {
        if (r < R.length - 1) { r++; show(); return; }
        qd.textContent = "Верно: " + score + " из " + R.length; res.textContent = score === R.length ? "Границы чувствуешь. Проверяй именно 2, 2.1, 8 и 8.1." : "Запомни: у границ проверяй 2, 2.1, 8 и 8.1 км."; nx.textContent = "Заново"; nx.onclick = again;
      }
      nx.onclick = onNext;
      show();
    } });

  S.push({ t: "Наш проект: «Городской помощник»", ic: "pc",
    html: '<p class="lead">Спросить имя и расстояние до цели и посоветовать, как добраться: пешком, на транспорте или на метро.</p><div class="cards">' +
      card("doc", "1. Имя", "input() и переменная", "frag") + card("chart", "2. Расстояние", "float() превращает текст в число", "frag") + card("help", "3. Условия", "if / elif / else", "frag") + card("check", "4. Ответ", "print() с f-строкой", "frag") + "</div>" });

  S.push({ t: "Код программы city_helper.py", ic: "pc", html: K.runner("city", "city_helper.py") });

  S.push({ t: "Проверка: три сценария", ic: "check",
    html: '<div class="row"><div><label>Имя <input type="text" class="nm" value="Анна" maxlength="20" aria-label="Имя"></label><label>Расстояние, км <input type="text" class="ds" value="1.5" maxlength="8" inputmode="decimal" aria-label="Расстояние"></label>' +
      '<div><button class="pk go">▶ Запустить</button></div><p class="m" style="margin-top:.6em">Или возьми готовый сценарий:</p><div>' + ["Анна|1.5", "Илья|5", "Мария|12"].map(function (x) { var p = x.split("|"); return '<button class="pk sc" data-n="' + p[0] + '" data-d="' + p[1] + '">' + p[0] + ", " + p[1] + " км</button>"; }).join("") + '</div></div>' +
      '<div><div class="cons co" role="status" style="min-height:8em"></div><div class="sunk tl" style="margin-top:.6em;font-size:.9em"></div></div></div><div class="note ok-n">Попробуй ввести «abc» вместо расстояния и посмотри на ошибку.</div>',
    init: function (sec) {
      var T = timers(sec), co = Q(sec, ".co"), tl = Q(sec, ".tl"), nm = Q(sec, ".nm"), ds = Q(sec, ".ds"), passed = {};
      var tests = [["Анна", 1.5], ["Илья", 5], ["Мария", 12]];
      function list() { tl.innerHTML = tests.map(function (t) { var k = t[0] + t[1]; return (passed[k] ? "✓ " : "☐ ") + E(t[0]) + ", " + t[1] + " км: " + E(K.cityAnswer(t[0], t[1])); }).join("<br>") + (Object.keys(passed).length === 3 ? '<br><b class="ok-t">Все три сценария проходят ✓</b>' : ""); }
      function run() {
        T.clear(); var name = nm.value.trim() || "Аноним", raw = ds.value.trim(), d = parseFloat(raw.replace(",", "."));
        var lines = ["Городской помощник", "Как вас зовут? " + name, "Расстояние до цели, км: " + raw];
        lines.push(isNaN(d) || !/^[0-9.,\-]+$/.test(raw) ? "ValueError: could not convert string to float: '" + raw + "'" : K.cityAnswer(name, d));
        co.textContent = ""; lines.forEach(function (l, i) { T.add(function () { co.textContent += (i ? "\n" : "") + l; if (i === 3 && !isNaN(d)) { tests.forEach(function (t) { if (t[0] === name && t[1] === d) passed[t[0] + t[1]] = 1; }); list(); } }, i * (K.reduced ? 0 : 320)); });
      }
      Q(sec, ".go").onclick = run;
      QA(sec, ".sc").forEach(function (b) { b.onclick = function () { nm.value = b.getAttribute("data-n"); ds.value = b.getAttribute("data-d"); run(); }; });
      list(); sec._stop = T.clear;
    } });

  S.push({ t: "Практическое задание", ic: "check",
    html: '<div class="chk">' + ["Запустите программу: в Visual Studio, IDLE или Thonny", "Проверьте сценарии: Анна 1.5, Илья 5, Мария 12", "Проверьте границы: 2 км и 8 км", "Добавьте вариант: например «на велосипеде» для 3–5 км", "Найдите ошибку: исправьте одну, например двоеточие"].map(function (x) { return '<label><input type="checkbox"><span>' + E(x) + "</span></label>"; }).join("") +
      '</div><div class="pbar"><i></i></div><div class="sunk rsl" role="status" style="min-height:2.4em"></div>',
    init: function (sec) {
      var cb = QA(sec, 'input[type=checkbox]'), bar = Q(sec, ".pbar i"), res = Q(sec, ".rsl");
      function upd() { var n = cb.filter(function (c) { return c.checked; }).length; cb.forEach(function (c) { c.parentNode.classList.toggle("done", c.checked); }); bar.style.width = n / cb.length * 100 + "%"; res.textContent = n === cb.length ? "Все пять шагов сделаны. Это уже настоящий проект ✓" : "Готово: " + n + " из " + cb.length; }
      cb.forEach(function (c) { c.onchange = upd; }); upd();
    } });

  S.push({ t: "Что дальше", ic: "folder",
    html: '<p class="lead">Всё, что ты видел, можно сделать самому на сайте курса. Проверка кода идёт прямо в браузере.</p><div class="cards">' +
      '<a class="cd" href="task.html?id=2.4" style="text-decoration:none">' + pix("pc") + "<b>Задание 2.4</b><span>Городской помощник 1.0</span></a>" +
      '<a class="cd" href="task.html?id=3.4" style="text-decoration:none">' + pix("folder") + "<b>Задание 3.4</b><span>Функция recommend</span></a>" +
      '<a class="cd" href="task.html?id=5.4" style="text-decoration:none">' + pix("check") + "<b>Задание 5.4</b><span>Городской помощник 3.0</span></a>" +
      '<a class="cd" href="theory.html" style="text-decoration:none">' + pix("book") + "<b>Теория</b><span>шпаргалки по темам</span></a></div>" });

  S.push({ t: "Итоги и рефлексия", ic: "bulb",
    html: bul(["Сегодня мы изучили: переменные, input(), float(), print(), if / elif / else, функции и тестирование", "Какой тест помог найти ошибку?", "Что добавить в следующую версию программы?"], true) +
      '<div class="frag"><a class="pk" style="text-decoration:none" href="cloud.html?t=Что%20мы%20изучили%20сегодня" target="_blank" rel="noopener">Напиши слово в облако →</a></div><div class="big frag" style="margin-top:.6em">Спасибо за работу!</div>' });

  window.DECK = { title: "Городской помощник", slides: S };
})();
