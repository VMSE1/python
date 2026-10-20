/* Видеоразборы: анимация на настоящих стилях сайта, без видеофайлов.
   Explainer.mount(хозяин, ролик)  — встроить плеер
   Explainer.modal(id)             — открыть окном поверх страницы
   Данные: data/clips.js (строится tools/make_clips.py). Работает без интернета и без eval. */
(function () {
  var W = 1120, H = 630;
  var OKI = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  var CUR = '<svg viewBox="0 0 22 26"><path d="M1 1v21l5-5 4 8 3-1.5-4-8h7z" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="round"/></svg>';
  function E(s) { return typeof esc === "function" ? esc(s) : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function fmt(v) { v = Math.max(0, v); return Math.floor(v / 60) + ":" + ("0" + Math.floor(v % 60)).slice(-2); }
  function typeOf(r) {
    if (/^['"]/.test(r)) return "str"; if (/^-?\d+$/.test(r)) return "int"; if (/^-?\d+\.\d+$/.test(r)) return "float";
    if (/^\[/.test(r)) return "list"; if (/^\{/.test(r)) return "dict"; if (/^(True|False)$/.test(r)) return "bool"; if (r === "None") return "None"; return "";
  }
  function setH(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; } }
  function setC(el, c) { if (el.className !== c) el.className = c; }
  function setT(el, s) { if (el._t !== s) { el._t = s; el.textContent = s; } }
  function setO(el, o) { if (el._o !== o) { el._o = o; el.style.opacity = o; } }
  function rel(el, root) { var x = 0, y = 0; while (el && el !== root) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x: x, y: y }; }
  function codeHtml(s, caret) { return E(s) + (caret ? '<span class="cr"></span>' : ""); }

  /* ---------- ролик по заданию: копия страницы задания ---------- */
  function buildTask(stage, clip) {
    var tk = TASKS.filter(function (x) { return x.id === clip.task; })[0];
    var ids = THEORY_MAP[tk.id], pl = (ids || []).map(function (k) { return THEORY.filter(function (p) { return p.id === k; })[0]; }).filter(Boolean);
    var ex = tk.func
      ? '<div class="io" style="grid-template-columns:1fr"><div class="term"><header>пример вызова</header><pre>&gt;&gt;&gt; ' + E(tk.example.in) + "\n" + E(tk.example.out) + "</pre></div></div>"
      : '<div class="io" id="x-io"><div class="term"><header>ввод</header><pre>' + E(tk.example.in) + '</pre></div><div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div><div class="term"><header>вывод</header><pre>' + E(tk.example.out) + "</pre></div></div>";
    if (tk.func) ex = ex.replace('class="io"', 'class="io" id="x-io"');
    var hint = String(tk.hint || "").replace(/`/g, "");
    var tokInfo = "PYC1:" + (function () { try { return btoa(unescape(encodeURIComponent(JSON.stringify({ n: "Иванов Иван", g: "9А", t: tk.id, c: clip.keep + clip.typed })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch (e) { return "eyJ0IjoiMi4yIn0"; } })();
    stage.innerHTML =
      '<div class="xbar">C:\\Python\\Задание</div><div class="xcam" id="x-cam"><div class="xk" id="x-k">' +
      '<div class="crumbs">← Все задания</div><div class="task-grid"><div>' +
      '<div class="tk-head">' + lessonIcon(tk.lesson) + '<div><div class="m" style="font-size:14px">Урок ' + tk.lesson + " · " + E(tk.lessonTitle) + '</div><h1 style="margin:0;font-size:20px;line-height:1.5">' + tk.id + " " + E(tk.title) + "</h1></div></div>" +
      '<div class="stepper"><div class="st on" id="x-s1"><i>1</i>Код</div><span class="ln"></span><div class="st" id="x-s2"><i>2</i>Проверка</div><span class="ln"></span><div class="st" id="x-s3"><i>3</i>Отправка</div></div>' +
      '<p class="cond" id="x-cond">' + md(tk.text) + "</p>" + ex +
      '<div class="toolbar"><button class="btn sm ghost" id="x-hintB" tabindex="-1">Подсказка</button></div><div class="box" id="x-hint" style="display:none;margin-top:8px"><p>' + E(hint) + "</p></div>" +
      '<div class="editor" id="x-ed" style="margin-top:16px"><div class="bar2"><i></i><i></i><i></i><span>' + E(tk.file) + '</span></div><pre class="xcode" id="x-code"></pre></div>' +
      '<div class="m xmsg" id="x-hn" style="margin-top:6px">Код набирай сам: вставка отключена. Так он лучше запоминается.</div>' +
      '<div class="toolbar"><button class="btn big go" id="x-chk" tabindex="-1">Проверить здесь</button></div><div class="res" id="x-res"></div>' +
      '<div class="sendbox" id="x-send"><input type="text" id="x-nick" readonly tabindex="-1" placeholder="твой ник"><input type="text" id="x-grp" readonly tabindex="-1" placeholder="группа (9А)"><button class="btn alt go" id="x-go" tabindex="-1">Отправить на проверку</button></div>' +
      '<div class="xbot" id="x-bot"><div><b>bot</b> <span class="m">прокомментировал(а) только что</span></div><b class="ok">Решено!</b><span>[ OK ] ' + tk.id + " " + E(tk.title) + "</span></div>" +
      '<details class="box" id="x-off" style="margin-top:14px"><summary>Нет GitHub? Отправь без него</summary><p class="m" style="font-size:14px">Получи код сдачи и отправь его учителю как удобно: в мессенджер, на почту или файлом.</p><div class="sendbox" style="margin-top:8px;padding:10px 14px"><input type="text" id="x-fio" readonly tabindex="-1" placeholder="Фамилия и имя"><button class="btn sm" id="x-mk" tabindex="-1">Получить код сдачи</button></div><div class="tkn" id="x-tok" style="margin-top:8px;opacity:0">' + tokInfo + "</div></details>" +
      "</div><aside class=\"aside\"><h2>Шпаргалка</h2>" + pl.map(plate).join("") + "</aside></div>" +
      '<div class="xgh" id="x-gh"><div class="u">github.com/VMSE1/python/issues/new</div><div class="b"><h4>[Сдача] ' + tk.id + ' snake_42</h4><div class="f">Ник: snake_42\nГруппа: 9А\nЗадание: ' + tk.id + " — " + E(tk.title) + '</div><div class="f" id="x-ghc"></div><div class="green" id="x-ghb">Submit new issue</div></div></div>' +
      '<div class="xkey" id="x-key">Ctrl + V</div><div class="xring" id="x-ring"></div><div class="xcur" id="x-cur">' + CUR + "</div></div></div>";
    var $ = function (i) { return stage.querySelector("#x-" + i); };
    var K = $("k"), cam = $("cam"), cur = $("cur"), ring = $("ring");
    var full = clip.full, code = clip.keep + clip.typed;
    var D = clamp(clip.typed.length / 12, 4, 14), tm = {};
    tm.read = 0.6; tm.io = 2.6; tm.hintMove = 4.6; tm.hint = 5.6; tm.edMove = 8; tm.edClick = 9; tm.ts = 9.5;
    tm.pasteAt = tm.ts + D * 0.5; tm.pasteEnd = tm.pasteAt + 2.8; tm.te = tm.ts + D + 2.8;
    tm.chkMove = tm.te + 0.6; tm.chk = tm.te + 1.7; tm.pass = tm.chk + 1.4;
    tm.nickMove = tm.pass + 1.8; tm.nickT = tm.nickMove + 0.9; tm.grpT = tm.nickT + 1.6; tm.goMove = tm.grpT + 0.9; tm.go = tm.goMove + 1;
    tm.gh = tm.go + 0.8; tm.ghMove = tm.gh + 1; tm.ghClick = tm.gh + 2.2; tm.bot = tm.ghClick + 0.9; tm.end1 = tm.bot + 4;
    tm.offMove = tm.end1; tm.offOpen = tm.offMove + 1.4; tm.fioT = tm.offOpen + 0.8; tm.mkMove = tm.fioT + 1.2; tm.mk = tm.mkMove + 0.9; tm.end = tm.mk + 5;
    var DUR = full ? tm.end : tm.end1;
    var C = clip.caps || {};
    var caps = [[0, C.read || "Открываем задание. Сверху условие: что должна делать программа."], [tm.io, "Справа пример: что вводит пользователь и что должно получиться на экране."], [tm.hintMove, "Не знаешь, с чего начать? Открой «Подсказку»."], [tm.hint + 0.5, "Подсказка: " + hint], [tm.edMove, "Теперь пиши код в окошке. Печатай сам."], [tm.ts, C.type || "Пиши по строчке."], [tm.pasteAt, "Вставка отключена. Код надо набрать руками, так он запоминается."], [tm.pasteEnd, C.type || "Пиши по строчке."], [tm.te, "Готово. Нажимаем «Проверить здесь»."], [tm.chk + 0.5, "Проверка идёт прямо в браузере. Зелёная плашка: все тесты пройдены."], [tm.nickMove, "Впиши ник (не фамилию!) и группу. Нет группы? Напиши «нет»."], [tm.go, "Нажимаем «Отправить на проверку». Откроется GitHub."], [tm.ghMove, "Остаётся нажать зелёную кнопку Submit new issue."], [tm.bot, "Через минуту робот ответит под заявкой: «Решено!». Ошибка? Нажми Edit, поправь код, и он проверит снова."]];
    if (full) caps.push([tm.offMove, "Нет GitHub или он не открывается? Раскрой «Нет GitHub? Отправь без него»."], [tm.fioT, "Впиши фамилию и имя и нажми кнопку."], [tm.mk + 0.4, "Получился код сдачи. Отправь его учителю в мессенджер или на почту. Учитель проверит код сам."]);
    var chapters = [[0, "Условие"], [tm.edMove, "Пишем код"], [tm.chkMove, "Проверка"], [tm.nickMove, "Отправка"], [tm.bot, "Ответ робота"]];
    if (full) chapters.push([tm.offMove, "Без GitHub"]);
    var kf = [[0, null, 0, { x: 640, y: 40 }], [tm.read, "x-cond", 0, { fx: .3 }], [tm.io, "x-io", 0, { fx: .15 }], [tm.hintMove, "x-hintB"], [tm.hint, "x-hintB", 1], [tm.edMove, "x-ed", 0, { fx: .4, fy: .45 }], [tm.edClick, "x-ed", 1, { fx: .4, fy: .45 }],
      [tm.chkMove, "x-chk"], [tm.chk, "x-chk", 1], [tm.nickMove, "x-nick"], [tm.nickT, "x-nick", 1], [tm.grpT, "x-grp", 1], [tm.goMove, "x-go"], [tm.go, "x-go", 1], [tm.ghMove, "x-ghb"], [tm.ghClick, "x-ghb", 1]];
    if (full) kf.push([tm.offMove, "x-off", 0, { fx: .1, fy: .08 }], [tm.offOpen, "x-off", 1, { fx: .1, fy: .08 }], [tm.fioT, "x-fio"], [tm.mkMove, "x-mk"], [tm.mk, "x-mk", 1]);
    kf.push([DUR, null, 0, { x: 700, y: 40 }]);
    var anchors = [[0, "x-k", 0], [tm.edMove - 0.6, "x-ed", -70], [tm.chkMove - 0.5, "x-chk", -340], [tm.nickMove - 0.6, "x-send", -150]];
    if (full) anchors.push([tm.offMove - 0.3, "x-off", -190]);
    function target(k) {
      if (!k[1]) return k[3];
      var el = stage.querySelector("#" + k[1]), p = rel(el, K), o = k[3] || {};
      return { x: p.x + el.offsetWidth * (o.fx == null ? .5 : o.fx), y: p.y + el.offsetHeight * (o.fy == null ? .5 : o.fy) };
    }
    var maxY = function () { return Math.max(0, K.offsetHeight - (H - 40)); };
    function camY(a, t) { var el = stage.querySelector("#" + a[1]); return clamp(a[1] === "x-k" ? 0 : rel(el, K).y + a[2], 0, maxY()); }
    function typedN(t) {
      var e = t - tm.ts; if (e < 0) return 0;
      var pz = 2.8, ps = D * 0.5;
      if (e > ps) e = e < ps + pz ? ps : e - pz;
      return Math.floor(clamp(e / D, 0, 1) * clip.typed.length);
    }
    function typedStr(s, t0, per, t) { return s.slice(0, clamp(Math.floor((t - t0) / per), 0, s.length)); }
    function render(t) {
      var n = typedN(t), typing = t >= tm.ts && t < tm.te;
      setH($("code"), codeHtml(t < tm.ts ? tk.starter : clip.keep + clip.typed.slice(0, n), typing && Math.floor(t * 2.2) % 2 === 0));
      setH($("hn"), t >= tm.pasteAt && t < tm.pasteEnd ? "Вставка отключена. Набери код сам: так ты его запомнишь." : "Код набирай сам: вставка отключена. Так он лучше запоминается.");
      setC($("hn"), "m xmsg" + (t >= tm.pasteAt && t < tm.pasteEnd ? " bad" : ""));
      setO($("key"), t >= tm.pasteAt && t < tm.pasteEnd - 0.4 ? 1 : 0);
      var hintOn = t >= tm.hint + 0.2;
      var hb = $("hint"); if (hb._d !== hintOn) { hb._d = hintOn; hb.style.display = hintOn ? "block" : "none"; }
      setC($("hintB"), "btn sm ghost" + (t >= tm.hint && t < tm.hint + 0.3 ? " press" : ""));
      var res = $("res");
      if (t >= tm.pass) { setC(res, "res on pass"); setH(res, '<div class="rh">' + OKI + "Все тесты пройдены. Отправь решение учителю</div>"); }
      else if (t >= tm.chk + 0.3) { setC(res, "res on wait"); setH(res, '<div class="rh">Проверяю…</div>'); }
      else { setC(res, "res"); setH(res, ""); }
      setC($("chk"), "btn big go" + (t >= tm.chk && t < tm.chk + 0.3 ? " press" : ""));
      var done = t >= tm.go, passed = t >= tm.pass;
      var st = done ? 3 : passed ? 2 : 0;
      ["s1", "s2", "s3"].forEach(function (s, k) { var e = $(s); setC(e, "st" + (k < st ? " ok" : (k === st ? " on" : ""))); setH(e, '<i>' + (k < st ? OKI : (k + 1)) + "</i>" + ["Код", "Проверка", "Отправка"][k]); });
      setC($("send"), "sendbox" + (passed && !done ? " ready" : ""));
      $("nick").value = typedStr("snake_42", tm.nickT, 0.12, t); $("grp").value = typedStr("9А", tm.grpT, 0.2, t);
      setC($("go"), "btn alt go" + (t >= tm.go && t < tm.go + 0.3 ? " press" : ""));
      var gho = t >= tm.gh && t < tm.bot - 0.2;
      setO($("gh"), gho ? 1 : 0); setH($("ghc"), "Код:\n" + E(code.length > 130 ? code.slice(0, 130) + "…" : code));
      setC($("ghb"), "green" + (t >= tm.ghClick && t < tm.ghClick + 0.3 ? " press" : ""));
      setO($("bot"), t >= tm.bot ? 1 : 0);
      if (full) {
        var op = t >= tm.offOpen + 0.2; if ($("off").open !== op) $("off").open = op;
        $("fio").value = typedStr("Иванов Иван", tm.fioT, 0.1, t);
        setO($("tok"), t >= tm.mk + 0.3 ? 1 : 0);
        setC($("mk"), "btn sm" + (t >= tm.mk && t < tm.mk + 0.3 ? " press" : ""));
      }
      // камера
      var ai = 0; anchors.forEach(function (a, i) { if (t >= a[0]) ai = i; });
      var a = anchors[ai], pa = anchors[Math.max(0, ai - 1)], y = camY(a, t);
      if (ai > 0) y = camY(pa, t) + (y - camY(pa, t)) * ease((t - a[0]) / 0.9);
      cam.style.transform = "translateY(" + (-y) + "px)";
      var gh = $("gh"); gh.style.top = (y + 70) + "px";
      // курсор
      var i = 0; for (var q = 0; q < kf.length - 1; q++) if (t >= kf[q][0]) i = q;
      var A = kf[i], B = kf[Math.min(i + 1, kf.length - 1)];
      var pA = target(A), pB = target(B);
      var k = B[0] === A[0] ? 1 : ease((t - A[0]) / Math.max(0.3, Math.min(B[0] - A[0], 1.1)));
      var cx = pA.x + (pB.x - pA.x) * k, cy = pA.y + (pB.y - pA.y) * k;
      cur.style.transform = "translate(" + cx + "px," + cy + "px)";
      var rk = null; kf.forEach(function (z) { if (z[2] && t - z[0] >= 0 && t - z[0] < 0.5) rk = z; });
      if (rk) { var pr = target(rk); ring.style.opacity = 1 - (t - rk[0]) / 0.5; ring.style.transform = "translate(" + pr.x + "px," + pr.y + "px) scale(" + (0.6 + (t - rk[0])) + ")"; } else ring.style.opacity = 0;
      var kx = $("key"), ep = rel($("ed"), K); kx.style.left = (ep.x + 260) + "px"; kx.style.top = (ep.y + 90) + "px";
      var cp = "", ci = 0; caps.forEach(function (c, j) { if (t >= c[0]) { cp = c[1]; ci = j; } });
      var ch = 0; chapters.forEach(function (c, j) { if (t >= c[0]) ch = j; });
      return { cap: cp, label: chapters[ch][1], ch: ch };
    }
    return { dur: DUR, render: render, chapters: chapters.map(function (c) { return { t: c[0], n: c[1] }; }, ), start: 0 };
  }

  /* ---------- ролик по теории: код, память, вывод ---------- */
  function buildTrace(stage, clip) {
    var lines = clip.code.split("\n");
    stage.innerHTML =
      '<div class="xbar">C:\\Python\\Теория\\' + E(clip.title) + '</div><div class="xt"><div><div class="editor"><div class="bar2"><i></i><i></i><i></i><span>' + E(clip.file) + '</span></div><div class="xcode" id="x-lines">' +
      lines.map(function (l, i) { return '<span class="xl" data-i="' + i + '"><i>' + (i + 1) + "</i>" + E(l || " ") + "</span>"; }).join("") +
      '</div></div></div><div class="xr"><div class="xmem"><h4 id="x-mh">Память</h4><div class="xvars" id="x-vars"></div></div><div class="io"><div class="term"><header>вывод</header><pre id="x-out"></pre></div></div></div></div>';
    var $ = function (i) { return stage.querySelector("#x-" + i); };
    var els = stage.querySelectorAll(".xl"), INTRO = 3.2, st = [], t0 = INTRO;
    clip.steps.forEach(function (s) { st.push({ s: s, t: t0 }); t0 += s.d; });
    var DUR = t0, lastS = -2, prevV = {};
    var ch = [{ t: 0, n: "Начало" }, { t: INTRO, n: "По шагам" }, { t: st[st.length - 1].t, n: "Итог" }];
    function render(t) {
      var showN = t >= INTRO ? lines.length : Math.ceil(t / INTRO * lines.length);
      var si = -1; for (var i = 0; i < st.length; i++) if (t >= st[i].t) si = i;
      var cur = si >= 0 ? st[si].s : null;
      Array.prototype.forEach.call(els, function (e, i) { setC(e, "xl" + (i < showN ? " show" : "") + (cur && cur.l === i ? " on" : "")); });
      if (si !== lastS) {
        lastS = si;
        var v = cur ? cur.v : {}, h = "", n = 0;
        Object.keys(v).forEach(function (k) { n++; var ty = typeOf(v[k]), changed = prevV[k] !== v[k]; h += '<div class="xv' + (changed && si > 0 ? " pop" : "") + '"><b>' + E(k) + "</b><span>" + E(v[k]) + "</span>" + (ty ? "<small>" + ty + "</small>" : "") + "</div>"; });
        $("vars").innerHTML = h || '<div class="empty">Пока пусто: ни одной переменной.</div>';
        $("mh").textContent = cur && cur.f ? "Память внутри функции " + cur.f + "()" : "Память: переменные";
        $("out").textContent = cur ? cur.o : "";
        prevV = v;
      }
      var cap = si < 0 ? clip.intro : cur.c;
      return { cap: cap, label: si < 0 ? "Начало" : (cur.l < 0 ? "Итог" : "Шаг " + (si + 1) + " из " + st.length), ch: si < 0 ? 0 : (si === st.length - 1 ? 2 : 1) };
    }
    return { dur: DUR, render: render, chapters: ch };
  }

  /* ---------- оболочка плеера ---------- */
  function mount(host, clip, opts) {
    opts = opts || {};
    host.innerHTML = '<div class="xp"><div class="xp-screen"><div class="xp-stage"></div></div><div class="xp-cap" aria-live="polite"><span class="n"></span><span class="tx"></span></div>' +
      '<div class="xp-ctl"><button class="btn sm" type="button" data-a="pp">Пауза</button><button class="btn sm ghost" type="button" data-a="rp">Сначала</button><button class="btn sm ghost" type="button" data-a="sp" title="Скорость">1×</button><input type="range" min="0" max="100" step="0.05" value="0" aria-label="Позиция ролика"><span class="xp-time">0:00 / 0:00</span></div>' +
      '<ul class="xp-ch"></ul></div>';
    var q = function (s) { return host.querySelector(s); };
    var screen = q(".xp-screen"), stage = q(".xp-stage"), capN = q(".xp-cap .n"), capT = q(".xp-cap .tx");
    var core = clip.type === "task" ? buildTask(stage, clip) : buildTrace(stage, clip);
    var rng = q("input[type=range]"), tmE = q(".xp-time"), pp = q('[data-a="pp"]'), spB = q('[data-a="sp"]'), chUl = q(".xp-ch");
    rng.max = core.dur;
    core.chapters.forEach(function (c) { var li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.textContent = c.n; b.onclick = function () { T = c.t + 0.05; play = true; setPP(); frame(); }; li.appendChild(b); chUl.appendChild(li); });
    function fit() { var s = screen.clientWidth / W; stage.style.transform = "scale(" + s + ")"; }
    fit(); var ro = null; try { ro = new ResizeObserver(fit); ro.observe(screen); } catch (e) { window.addEventListener("resize", fit); }
    var T = 0, play = !opts.paused, last = 0, speed = 1, raf = 0, dead = false;
    try { if (matchMedia("(prefers-reduced-motion: reduce)").matches) play = false; } catch (e) {}
    function setPP() { pp.textContent = play ? "Пауза" : (T >= core.dur - 0.05 ? "Ещё раз" : "Играть"); }
    function frame() {
      var r = core.render(T);
      capN.textContent = r.label; setT(capT, r.cap);
      rng.value = T; tmE.textContent = fmt(T) + " / " + fmt(core.dur);
      Array.prototype.forEach.call(chUl.children, function (li, i) { li.firstChild.className = i === r.ch ? "on" : ""; });
    }
    function loop(now) {
      if (dead) return;
      if (play) { var d = last ? Math.min(0.1, (now - last) / 1000) : 0; T += d * speed; if (T >= core.dur) { T = core.dur; play = false; setPP(); } }
      last = now; frame(); raf = requestAnimationFrame(loop);
    }
    pp.onclick = function () { if (!play && T >= core.dur - 0.05) T = 0; play = !play; setPP(); };
    q('[data-a="rp"]').onclick = function () { T = 0; play = true; setPP(); };
    spB.onclick = function () { speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; spB.textContent = (speed === 1.5 ? "1.5" : speed) + "×"; };
    rng.oninput = function () { T = parseFloat(rng.value); play = false; setPP(); };
    setPP(); raf = requestAnimationFrame(loop);
    return { seek: function (t) { T = t; frame(); }, dur: core.dur, pause: function () { play = false; setPP(); },
      destroy: function () { dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); host.innerHTML = ""; } };
  }

  function byId(id) { return (window.CLIPS || []).filter(function (c) { return c.id === id; })[0]; }
  function modal(id) {
    var clip = byId(id); if (!clip || document.querySelector(".xm-back")) return;
    var back = document.createElement("div"); back.className = "xm-back"; back.setAttribute("role", "dialog"); back.setAttribute("aria-modal", "true"); back.setAttribute("aria-label", clip.title);
    back.innerHTML = '<div class="xm"><div class="xh"><span>' + E(clip.title) + '</span><button class="btn sm ghost" type="button" id="xm-x">Закрыть</button></div><div class="xb"></div></div>';
    document.body.appendChild(back);
    var pl = mount(back.querySelector(".xb"), clip, {});
    function close() { pl.destroy(); back.remove(); document.removeEventListener("keydown", key); }
    function key(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", key);
    back.querySelector("#xm-x").onclick = close;
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    back.querySelector("#xm-x").focus();
  }
  function card(c) {
    var th = c.type === "trace" ? c.code.split("\n").slice(0, 4).join("\n") : "Задание " + c.task + "\n" + (c.keep + c.typed).split("\n").slice(0, 3).join("\n");
    var len = c.type === "trace" ? 3.2 + c.steps.reduce(function (a, s) { return a + s.d; }, 0) : 0;
    return '<button class="vcard" type="button" data-clip="' + c.id + '"><div class="th">' + E(th) + '</div><div class="tx"><h3>' + E(c.title) + '</h3><span class="m">' + E(c.sub || (c.type === "trace" ? "Пошаговый разбор: память и вывод" : "")) + '</span></div><div class="ft">' + (c.type === "trace" ? "ТЕОРИЯ · ~" + Math.round(len / 5) * 5 + " С" : "ЗАДАНИЕ · ~1 МИН") + "</div></button>";
  }
  function bind(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-clip]"), function (b) { b.onclick = function () { modal(b.getAttribute("data-clip")); }; });
  }
  window.Explainer = { mount: mount, modal: modal, byId: byId, card: card, bind: bind,
    forLesson: function (l) { return (window.CLIPS || []).filter(function (c) { return c.type === "trace" && c.l === l; }); },
    forTask: function (id) { return (window.CLIPS || []).filter(function (c) { return c.type === "task" && c.task === id; })[0] || null; } };
})();
