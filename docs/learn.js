/* Страница других предметов: learn.html (список предметов), learn.html?s=sql (карта уроков), learn.html?s=sql&l=1 (урок с заданиями).
   Типы заданий: sql (запрос в браузере), quiz (выбор ответа), steps (практика по шагам), keys (тренажёр горячих клавиш), neuron (нейрон на графике). */
(function () {
  var Q = new URLSearchParams(location.search), sid = Q.get("s") || "", ln = +Q.get("l") || 0;
  var S = window.SUBJECTS && SUBJECTS[sid], meta = Subject.byId(sid);
  var main = document.querySelector("main.wrap");
  if (S && meta) window.WIN_ROOT = meta.root;
  var L = S && ln ? S.lessons.filter(function (x) { return x.n === ln; })[0] : null;
  layout("learn.html", L ? "Урок " + L.n : S ? "Уроки" : "Предметы");
  var box = document.getElementById("app");
  function key(t) { return sid + ":" + t.id; }
  function total(s) { return s.lessons.reduce(function (a, l) { return a + l.tasks.length; }, 0); }
  function doneIn(s) { var p = Subject.prog(), n = 0; s.lessons.forEach(function (l) { l.tasks.forEach(function (t) { if (p[s.id + ":" + t.id]) n++; }); }); return n; }

  /* ---------- список предметов ---------- */
  if (!S) {
    var cur = Subject.get();
    var pyN = 0, pyT = (window.TASKS || []).length; try { var pa = JSON.parse(localStorage.getItem("passed") || "{}"), dn = JSON.parse(localStorage.getItem("done") || "{}"); (window.TASKS || []).forEach(function (t) { if (pa[t.id] || dn[t.id]) pyN++; }); } catch (e) {}
    box.innerHTML = '<div class="howto"><span><b>Выбери предмет.</b> Python — основной курс с проверкой и сдачей учителю. Остальные предметы проходятся прямо здесь, прогресс сохраняется в профиле.</span></div><div class="subj-grid">' +
      Subject.LIST.map(function (m) {
        var s = SUBJECTS[m.id], n = m.id === "python" ? pyN : s ? doneIn(s) : 0, all = m.id === "python" ? pyT : s ? total(s) : 0;
        return '<a class="subj' + (m.id === cur ? " on" : "") + '" href="' + m.href + '" data-s="' + m.id + '">' + pix(m.icon) + '<div><b>' + esc(m.title) + '</b><span class="m">' + esc(m.sub) + '</span>' +
          '<div class="pbar"><i style="width:' + (all ? Math.round(n / all * 100) : 0) + '%"></i></div><small>' + n + ' из ' + all + (m.id === cur ? " · сейчас учишь" : "") + '</small></div></a>';
      }).join("") + '</div>';
    box.querySelectorAll(".subj").forEach(function (a) { a.addEventListener("click", function () { Subject.set(a.dataset.s); }); });
    return;
  }
  if (Subject.get() !== sid) Subject.set(sid);

  /* ---------- карта уроков ---------- */
  if (!L) {
    document.title = S.title + " · Курс";
    var p = Subject.prog(), next = null;
    S.lessons.forEach(function (l) { l.tasks.forEach(function (t) { if (!next && !p[key(t)]) next = { l: l, t: t }; }); });
    box.innerHTML = '<h1>' + esc(S.title) + '</h1><p class="lead">' + md(S.about) + '</p>' +
      '<div class="btns" style="margin:12px 0 18px">' + (next ? '<a class="btn big go" href="learn.html?s=' + sid + '&l=' + next.l.n + '#t' + next.t.id + '">' + (doneIn(S) ? "Продолжить" : "Начать") + ': урок ' + next.l.n + '</a>' : '<span class="okb">Все уроки пройдены!</span>') +
      '<button class="btn ghost" type="button" id="chs">Сменить предмет</button></div>' +
      S.lessons.map(function (l) {
        var c = l.tasks.filter(function (t) { return p[key(t)]; }).length;
        var nodes = l.tasks.map(function (t, i) { var cls = p[key(t)] ? "sent" : next && next.t === t ? "next" : ""; return (i ? '<span class="ln' + (p[key(l.tasks[i - 1])] ? " done" : "") + '"></span>' : "") + '<a class="node ' + cls + '" href="learn.html?s=' + sid + '&l=' + l.n + '#t' + t.id + '" data-t="' + esc(taskTitle(t)) + '" aria-label="' + t.id + ' ' + esc(taskTitle(t)) + '">' + (p[key(t)] ? pix("check") : t.id) + '</a>'; }).join("");
        return '<section class="track"><div class="head">' + lessonIcon(l.n) + '<div><h3><a href="learn.html?s=' + sid + '&l=' + l.n + '">Урок ' + l.n + '</a></h3><div class="sub">' + esc(l.title) + '</div></div><span class="cnt">' + c + ' / ' + l.tasks.length + '</span></div><div class="path">' + nodes + '</div></section>';
      }).join("") +
      (S.plan && S.plan.length ? '<section class="track soon"><div class="head">' + pix("key") + '<div><h3>Скоро</h3><div class="sub">Следующие уроки</div></div></div><ol start="' + (S.lessons.length + 1) + '">' + S.plan.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ol></section>' : "");
    document.getElementById("chs").onclick = function () { Subject.pick(); };
    return;
  }

  /* ---------- урок ---------- */
  document.title = "Урок " + L.n + ". " + L.title + " · " + S.short;
  var i = S.lessons.indexOf(L), prev = S.lessons[i - 1], nextL = S.lessons[i + 1];
  var DB = L.db ? S.dbs[L.db] : null;
  box.innerHTML = '<div class="crumbs"><a href="learn.html?s=' + sid + '">← ' + esc(S.title) + '</a></div>' +
    '<div class="tk-head">' + lessonIcon(L.n) + '<div><div class="m" style="font-size:14px">' + esc(S.title) + ' · урок ' + L.n + '</div><h1 style="margin:0;font-size:clamp(15px,2.4vw,20px);line-height:1.5">' + esc(L.title) + '</h1></div></div>' +
    (L.goal ? '<p class="lead"><b>Цель урока.</b> ' + md(L.goal) + '</p>' : "") +
    '<h2 class="lh">Теория</h2><div class="plates">' + L.theory.map(plate).join("") + '</div>' +
    (DB ? '<h2 class="lh">Таблицы базы «Школа»</h2>' + schemaHtml(DB.schema) : "") +
    '<h2 class="lh">Задания</h2><div id="tasks"></div>' +
    '<div class="pager"><span>' + (prev ? '<a class="btn ghost" href="learn.html?s=' + sid + '&l=' + prev.n + '">← Урок ' + prev.n + '</a>' : "") + '</span><span>' + (nextL ? '<a class="btn ghost" href="learn.html?s=' + sid + '&l=' + nextL.n + '">Урок ' + nextL.n + ' →</a>' : "") + '</span></div>';

  function taskTitle(t) { return t.title || (t.type === "quiz" ? "Вопрос" : "Задание"); }
  function schemaHtml(sc) {
    return '<div class="schema">' + sc.map(function (tb) {
      return '<details class="box tbl"><summary><b>' + esc(tb.name) + '</b> <span class="m">(' + tb.count + ' строк)</span>: ' + tb.cols.map(function (c) { return '<code>' + esc(c[0]) + '</code>'; }).join(", ") + '</summary>' + table(tb.cols.map(function (c) { return c[0]; }), tb.preview) + (tb.count > tb.preview.length ? '<p class="m">…и ещё ' + (tb.count - tb.preview.length) + '. Посмотреть все: <code>SELECT * FROM ' + esc(tb.name) + ';</code></p>' : "") + '</details>';
    }).join("") + '</div>';
  }
  function table(cols, rows, more) {
    return '<div class="rtw"><table class="rt"><thead><tr>' + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + '</tr></thead><tbody>' +
      rows.map(function (r) { return "<tr>" + r.map(function (v) { return v === null ? '<td class="nul">NULL</td>' : "<td>" + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") + '</tbody></table></div>' +
      (more ? '<p class="m">Показаны первые 200 строк.</p>' : "");
  }
  var KIND = { sql: "SQL", quiz: "Вопрос", steps: "Практика", keys: "Тренажёр", neuron: "Нейрон" };

  /* ---------- задания ---------- */
  var R = {};
  R.quiz = function (t, b, pass) {
    var tries = 0, done = Subject.has(key(t));
    b.innerHTML = '<p class="cond">' + md(t.q) + '</p>' + (t.code ? '<pre>' + esc(t.code) + '</pre>' : "") + '<div class="qopts">' + t.o.map(function (o, i) { return '<button type="button" class="btn" data-i="' + i + '">' + md(o) + '</button>'; }).join("") + '</div><div class="res" role="status"></div>';
    var res = b.querySelector(".res");
    function show(ok) { res.className = "res on " + (ok ? "pass" : "fail"); res.innerHTML = '<div class="rh">' + (ok ? "Верно!" : "Пока нет") + '</div><p>' + (ok || tries >= 2 ? md(t.why || "") : "Подумай ещё и попробуй другой вариант.") + '</p>'; }
    b.querySelectorAll("[data-i]").forEach(function (x) {
      x.onclick = function () {
        var ok = +x.dataset.i === t.a; tries++;
        if (ok) { b.querySelectorAll("[data-i]").forEach(function (y) { y.disabled = true; }); x.classList.add("go"); pass(); } else { x.classList.add("bad"); x.disabled = true; }
        show(ok);
      };
    });
    if (done) { var r = b.querySelector('[data-i="' + t.a + '"]'); r.classList.add("go"); b.querySelectorAll("[data-i]").forEach(function (y) { y.disabled = true; }); show(true); }
  };
  R.sql = function (t, b, pass) {
    var sk = "sql_" + key(t), saved = ""; try { saved = localStorage.getItem(sk) || ""; } catch (e) {}
    b.innerHTML = '<p class="cond">' + md(t.text) + '</p>' +
      (t.verify ? '<p class="m">После твоих команд выполнится <code>' + esc(t.verify) + '</code>, и мы сравним таблицу с ожидаемой.</p>' : "") +
      '<div class="editor"><div class="bar2"><i></i><i></i><i></i><span>запрос.sql</span></div><textarea class="sqlin" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="SQL-запрос" placeholder="SELECT ..."></textarea></div>' +
      '<div class="toolbar"><button class="btn big go" type="button" data-a="chk">Проверить</button><button class="btn" type="button" data-a="run">Выполнить</button><span class="sp"></span><button class="btn sm ghost" type="button" data-a="hint">Подсказка</button></div>' +
      '<div class="box hintb" hidden><p>' + md(t.hint || "") + '</p></div><div class="res" role="status"></div><div class="out"></div>' +
      '<details class="box exp"><summary>Как должно получиться</summary>' + table(t.expect.cols, t.expect.rows) + '</details>';
    var ta = b.querySelector("textarea"), res = b.querySelector(".res"), out = b.querySelector(".out");
    ta.value = saved;
    ta.addEventListener("input", function () { try { localStorage.setItem(sk, ta.value); } catch (e) {} });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(true); }
      if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); var s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); }
    });
    b.querySelector('[data-a="hint"]').onclick = function () { var h = b.querySelector(".hintb"); h.hidden = !h.hidden; };
    b.querySelector('[data-a="run"]').onclick = function () { go(false); };
    b.querySelector('[data-a="chk"]').onclick = function () { go(true); };
    function msg(cls, head, text) { res.className = "res on " + cls; res.innerHTML = '<div class="rh">' + esc(head) + '</div>' + (text ? '<p>' + esc(text) + '</p>' : ""); }
    function go(check) {
      var sql = ta.value.trim(); if (!sql) { msg("fail", "Пусто", "Напиши запрос."); ta.focus(); return; }
      msg("wait", SqlRun.isReady() ? "Выполняю…" : "Загружаю тренажёр… (в первый раз до 10 секунд)", "");
      var o = { seed: DB.seed, sql: sql, verify: check ? t.verify : null };
      if (check) { o.expect = t.expect; o.ordered = t.ordered; o.names = t.names; o.verify = t.verify; }
      SqlRun.run(o).then(function (r) {
        if (!r.ok) { msg("fail", "Ошибка в запросе", r.error); out.innerHTML = ""; return; }
        var x = r.res;
        out.innerHTML = x.cols ? '<div class="m">Результат' + (check && t.verify ? " проверки" : "") + ': ' + x.rows.length + ' стр.</div>' + table(x.cols, x.rows, x.more) : '<p class="m">Команда выполнена' + (x.changed ? ", изменено строк: " + x.changed : "") + '. SELECT покажет таблицу.</p>';
        if (!check) { res.className = "res"; res.innerHTML = ""; return; }
        if (r.pass) { msg("pass", "Верно!", "Запрос даёт нужный результат."); pass(); } else msg("fail", "Пока не так", r.msg);
      });
    }
  };
  R.steps = function (t, b, pass) {
    var sk = "steps_" + key(t), st = {}; try { st = JSON.parse(localStorage.getItem(sk) || "{}") || {}; } catch (e) {}
    b.innerHTML = '<p class="cond">' + md(t.text || "") + '</p><ol class="steps">' + t.steps.map(function (s, i) { return '<li><label><input type="checkbox" data-i="' + i + '"' + (st[i] ? " checked" : "") + '> <span>' + md(s) + '</span></label></li>'; }).join("") + '</ol>' +
      '<button class="btn go" type="button" data-a="ok">Готово</button><div class="res" role="status"></div>';
    var btn = b.querySelector('[data-a="ok"]'), res = b.querySelector(".res");
    function upd() { var all = Array.prototype.every.call(b.querySelectorAll("input"), function (x) { return x.checked; }); btn.disabled = !all; }
    b.querySelectorAll("input").forEach(function (x) { x.onchange = function () { st[x.dataset.i] = x.checked ? 1 : 0; try { localStorage.setItem(sk, JSON.stringify(st)); } catch (e) {} upd(); }; });
    btn.onclick = function () { pass(); res.className = "res on pass"; res.innerHTML = '<div class="rh">Отмечено!</div><p>Покажи результат учителю: файл или скриншот.</p>'; };
    upd();
    if (Subject.has(key(t))) { res.className = "res on pass"; res.innerHTML = '<div class="rh">Выполнено</div>'; }
  };
  R.keys = function (t, b, pass) {
    var items = t.items, order = [], pos = 0, miss = 0, done = Subject.has(key(t));
    function shuffle() { order = items.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; }); pos = 0; miss = 0; }
    shuffle();
    b.innerHTML = '<p class="cond">' + md(t.text || "") + '</p><div class="kt" tabindex="0" role="application" aria-label="Тренажёр клавиш"><div class="ktq"></div><div class="ktd"></div><div class="ktr" role="status"></div></div>' +
      '<details class="box"><summary>Шпаргалка</summary><ul>' + items.map(function (x) { return "<li><kbd>" + esc(x.label) + "</kbd> " + esc(x.what) + "</li>"; }).join("") + '</ul></details>';
    var kt = b.querySelector(".kt"), q = b.querySelector(".ktq"), dots = b.querySelector(".ktd"), r = b.querySelector(".ktr");
    function draw() {
      dots.innerHTML = order.map(function (_, i) { return '<i class="' + (i < pos ? "y" : i === pos ? "c" : "") + '"></i>'; }).join("");
      if (pos >= order.length) { q.innerHTML = '<b>Готово!</b> Ошибок: ' + miss; r.innerHTML = '<button type="button" class="btn sm" data-a="again">Ещё раз</button>'; r.querySelector("button").onclick = function () { shuffle(); draw(); kt.focus(); }; return; }
      q.innerHTML = '<span class="m">Нажми:</span> <b>' + esc(items[order[pos]].what) + '</b>';
      if (document.activeElement !== kt) r.textContent = "Кликни сюда, чтобы начать";
    }
    kt.addEventListener("focus", function () { if (pos < order.length) r.textContent = ""; });
    kt.addEventListener("blur", function () { if (pos < order.length) r.textContent = "Кликни сюда, чтобы продолжить"; });
    kt.addEventListener("keydown", function (e) {
      if (pos >= order.length) return;
      if (/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(e.code)) return;
      e.preventDefault();
      var it = items[order[pos]], codes = [it.code].concat(it.alt || []);
      var ok = codes.indexOf(e.code) >= 0 && !!it.ctrl === (e.ctrlKey || e.metaKey) && !!it.shift === e.shiftKey && !!it.altk === e.altKey;
      if (ok) { pos++; r.textContent = "Верно: " + it.label; if (pos >= order.length) { pass(); } }
      else { miss++; r.textContent = "Не та клавиша. Нужно: " + it.label; }
      draw();
    });
    draw();
    if (done) r.textContent = "Уже пройдено. Можно повторить.";
  };
  R.neuron = function (t, b, pass) {
    /* дни Пети: [погода 0–10, домашка 0–10, гулял ли] */
    var D = [[9, 2, 1], [8, 4, 1], [7, 1, 1], [10, 6, 1], [6, 2, 1], [9, 5, 1], [5, 1, 1], [2, 1, 0], [3, 6, 0], [5, 7, 0], [1, 4, 0], [7, 9, 0], [4, 5, 0], [8, 10, 0]];
    var w = t.train ? [0, 0, 0] : [0.5, 0.5, -3], timer = 0, epoch = 0;
    b.innerHTML = '<p class="cond">' + md(t.text || "") + '</p><div class="nr"><canvas width="300" height="300" aria-label="График: погода по горизонтали, домашка по вертикали"></canvas><div class="nrc">' +
      sl("w1", "Вес погоды w1", -3, 3, 0.1) + sl("w2", "Вес домашки w2", -3, 3, 0.1) + sl("b", "Смещение b", -15, 15, 0.5) +
      '<pre class="nrf"></pre><div class="nra"></div>' +
      (t.train ? '<div class="btns"><label class="m">Шаг: <select data-a="lr"><option value="0.01">0.01</option><option value="0.1" selected>0.1</option><option value="1">1</option></select></label><button class="btn go" type="button" data-a="train">Учить</button><button class="btn ghost" type="button" data-a="reset">Сбросить</button></div><p class="m nre"></p>' : "") +
      '</div></div><div class="res" role="status"></div>';
    function sl(id, lab, a, z, s) { return '<label class="nrs">' + lab + ': <b data-v="' + id + '"></b><input type="range" data-k="' + id + '" min="' + a + '" max="' + z + '" step="' + s + '"></label>'; }
    var cv = b.querySelector("canvas"), g = cv.getContext("2d"), res = b.querySelector(".res"), ins = b.querySelectorAll("input[type=range]");
    function fmt(v) { return (Math.round(v * 100) / 100).toString(); }
    function out(p) { return w[0] * p[0] + w[1] * p[1] + w[2] > 0 ? 1 : 0; }
    function draw() {
      var S = 26, O = 20; g.fillStyle = "#ffffff"; g.fillRect(0, 0, 300, 300);
      /* фон: где нейрон говорит «да» */
      for (var x = 0; x < 260; x += 4) for (var y = 0; y < 260; y += 4) { var wx = x / S, hy = (260 - y) / S; g.fillStyle = w[0] * wx + w[1] * hy + w[2] > 0 ? "#d3f0d9" : "#f9d3d9"; g.fillRect(O + x, y, 4, 4); }
      g.strokeStyle = "#9d9cb8"; g.lineWidth = 1; for (var i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(O + i * S, 0); g.lineTo(O + i * S, 260); g.moveTo(O, 260 - i * S); g.lineTo(O + 260, 260 - i * S); g.stroke(); }
      g.fillStyle = "#1d1370"; g.font = "12px 'IBM Plex Mono',monospace"; g.fillText("погода →", O + 180, 280); g.save(); g.translate(12, 120); g.rotate(-Math.PI / 2); g.fillText("домашка →", 0, 0); g.restore();
      D.forEach(function (p) {
        var x = O + p[0] * S, y = 260 - p[1] * S, ok = out(p) === p[2];
        g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = p[2] ? "#1b7a2e" : "#c01a2f"; g.fill();
        g.lineWidth = 3; g.strokeStyle = ok ? "#1d1370" : "#ffe44d"; g.stroke();
        if (!ok) { g.fillStyle = "#ffe44d"; g.font = "bold 12px 'IBM Plex Mono',monospace"; g.fillText("?", x - 3, y + 4); }
      });
      ins.forEach(function (x) { var k = { w1: 0, w2: 1, b: 2 }[x.dataset.k]; x.value = w[k]; b.querySelector('[data-v="' + x.dataset.k + '"]').textContent = fmt(w[k]); });
      var n = D.filter(function (p) { return out(p) === p[2]; }).length;
      b.querySelector(".nrf").textContent = "s = " + fmt(w[0]) + "·погода + " + fmt(w[1]) + "·домашка + " + fmt(w[2]) + "\nгулять, если s > 0";
      b.querySelector(".nra").innerHTML = 'Угадано дней: <b>' + n + ' из ' + D.length + '</b>';
      if (n === D.length) { res.className = "res on pass"; res.innerHTML = '<div class="rh">Нейрон угадывает все дни!</div><p>Посмотри на числа: какой вес положительный, какой отрицательный, и почему.</p>'; pass(); }
      else if (!Subject.has(key(t))) { res.className = "res"; res.innerHTML = ""; }
    }
    ins.forEach(function (x) { x.oninput = function () { w[{ w1: 0, w2: 1, b: 2 }[x.dataset.k]] = +x.value; draw(); }; });
    if (t.train) {
      b.querySelector('[data-a="reset"]').onclick = function () { clearInterval(timer); w = [0, 0, 0]; epoch = 0; b.querySelector(".nre").textContent = ""; draw(); };
      b.querySelector('[data-a="train"]').onclick = function () {
        clearInterval(timer); var lr = +b.querySelector('[data-a="lr"]').value;
        timer = setInterval(function () {
          var errs = 0; epoch++;
          D.forEach(function (p) { var e = p[2] - out(p); if (e) { errs++; w[0] += lr * e * p[0]; w[1] += lr * e * p[1]; w[2] += lr * e; } });
          w = w.map(function (v) { return Math.max(-15, Math.min(15, v)); });
          b.querySelector(".nre").textContent = "Эпоха " + epoch + ": ошибок за проход " + errs;
          draw();
          if (!errs || epoch >= 200 || !document.body.contains(cv)) clearInterval(timer);
        }, 250);
      };
    }
    draw();
  };
  /* задания рисуются в конце: к этому месту все типы (R) уже описаны */
  function renderTasks() {
  var host = document.getElementById("tasks");
  L.tasks.forEach(function (t) {
    var el = document.createElement("section"); el.className = "ltask" + (Subject.has(key(t)) ? " dn" : ""); el.id = "t" + t.id;
    el.innerHTML = '<div class="lth"><span class="ltn">' + t.id + '</span><h3>' + esc(taskTitle(t)) + '</h3><span class="ltk">' + KIND[t.type] + '</span><span class="lts" aria-label="Выполнено">' + pix("check") + '</span></div><div class="ltb"></div>';
    host.appendChild(el);
    var body = el.querySelector(".ltb");
    function pass() { Subject.mark(key(t)); el.classList.add("dn"); }
    (R[t.type] || function () {})(t, body, pass);
  });
  if (location.hash) setTimeout(function () { var a = document.getElementById(location.hash.slice(1)); if (a) a.scrollIntoView({ block: "start" }); }, 50);
  if (DB) setTimeout(function () { SqlRun.warm(); }, 400);
  }
  renderTasks();
})();
