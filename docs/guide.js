/* Окно «Как это работает»: анимированная инструкция с макетами экранов */
(function () {
  function chrome(url) { return '<div class="chrome"><i></i><i></i><i></i><span class="url">' + url + "</span></div>"; }
  var SLIDES = [
    { t: "Создай аккаунт GitHub", s: "Один раз. Бесплатно.", note: "Ник — не настоящая фамилия! Всё видно всем.",
      link: ["Открыть github.com/signup", "https://github.com/signup"],
      mock: '<div class="mock">' + chrome("github.com/signup") + '<div class="bd"><h4>Создай аккаунт</h4><div class="mk-f">ты@почта.ru</div><div class="mk-f">••••••••</div><div class="mk-f">snake_42 <b>ник, не фамилия</b></div><div class="mk-b mk-g tg" data-o="1">Create account</div></div></div>' },
    { t: "Выбери задание", s: "Нажми на квадрат с номером.",
      mock: '<div class="mock">' + chrome("vmse1.github.io/python") + '<div class="bd"><h4>Урок 2. Условия</h4><div class="mk-nodes"><span class="mk-n d">2.1</span><span class="mk-l"></span><span class="mk-n d">2.2</span><span class="mk-l"></span><span class="mk-n tg" data-o="1">2.3</span><span class="mk-l"></span><span class="mk-n">2.4</span></div><div class="mk-mute">Синий — отправлено</div></div></div>' },
    { t: "Напиши код и проверь", s: "Кнопка «Проверить» отвечает сразу.",
      mock: '<div class="mock" data-step="0">' + chrome("vmse1.github.io/python/task.html") + '<div class="bd"><div class="mk-code"><span class="v">height</span> = <span class="k">int</span>(<span class="k">input</span>())<br><span class="k">if</span> height &gt;= 120 <span class="k">and</span> age &gt;= 7:<br>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">print</span>(<span class="s">"Можно"</span>)</div><div class="mk-b tg" data-o="1">Проверить здесь</div><div class="mk-ok rv rv1">Все тесты пройдены</div></div></div>' },
    { t: "Отправь учителю", s: "Сначала кнопка на сайте, потом зелёная на GitHub.",
      mock: '<div class="mock" data-step="0">' + chrome("vmse1.github.io/python/task.html") + '<div class="bd"><div class="mk-f">snake_42 <b>твой ник</b></div><div class="mk-b tg" data-o="1">Отправить на проверку</div><div class="rv rv1"><div class="mk-mute" style="margin-bottom:6px">github.com · New issue</div><div class="mk-b mk-g tg" data-o="2">Submit new issue</div></div></div></div>' },
    { t: "Получи ответ робота", s: "Через минуту под заявкой. Ошибка — нажми Edit и поправь код.",
      mock: '<div class="mock">' + chrome("github.com/…/issues/1") + '<div class="bd"><h4>[Сдача] 2.3 snake_42</h4><div class="mk-bot"><span class="mk-av">bot</span><div><b style="color:#2f4bdb">Решено!</b><br><span class="mk-mute">[ OK ] 2.3 Аттракцион</span></div></div><div class="mk-mute">Есть ошибки? <span class="tg" data-o="1" style="border:2px solid #1c2340;border-radius:8px;padding:2px 10px;color:#1c2340;font-weight:600">Edit</span> → исправь → робот проверит снова</div></div></div>' }
  ];
  var CUR = '<svg class="gd-cursor" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var timers = [], idx = 0, auto = true, back, stage, lastPos = null;
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function later(f, ms) { timers.push(setTimeout(f, ms)); }
  function close() {
    clear(); try { localStorage.setItem("seenStart", "1"); } catch (e) {}
    if (back) { back.remove(); back = null; lastPos = null; } document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go(idx + 1); else if (e.key === "ArrowLeft") go(idx - 1); }
  function go(n) {
    if (n < 0) return; if (n >= SLIDES.length) { close(); return; }
    clear(); idx = n; var s = SLIDES[n];
    stage.innerHTML = s.mock + CUR;
    back.querySelector(".gd-count").textContent = (n + 1) + " / " + SLIDES.length;
    back.querySelector(".gd-t").textContent = s.t; back.querySelector(".gd-s").textContent = s.s;
    var note = back.querySelector(".gd-note"); note.textContent = s.note || ""; note.className = "gd-note" + (s.note ? " on" : "");
    var lk = back.querySelector(".gd-link"); if (s.link) { lk.href = s.link[1]; lk.textContent = s.link[0]; lk.style.display = ""; } else lk.style.display = "none";
    Array.prototype.forEach.call(back.querySelectorAll(".gd-dots button"), function (b, i) { b.className = i === n ? "on" : ""; });
    back.querySelector(".gd-next").textContent = n === SLIDES.length - 1 ? "Начать" : "Дальше";
    back.querySelector(".gd-prev").style.visibility = n ? "visible" : "hidden";
    play();
  }
  function play() {
    var mock = stage.querySelector(".mock"), cur = stage.querySelector(".gd-cursor"), sr = stage.getBoundingClientRect();
    var tg = Array.prototype.slice.call(stage.querySelectorAll(".tg")).sort(function (a, b) { return a.dataset.o - b.dataset.o; });
    var t = 700, prog = back.querySelector(".gd-prog i");
    function pos(el) { var r = el.getBoundingClientRect(); return { x: r.left - sr.left + r.width * .6, y: r.top - sr.top + r.height * .55 }; }
    var from = lastPos || { x: sr.width * .5, y: sr.height * .95 };
    cur.style.transition = "none"; cur.style.transform = "translate(" + from.x + "px," + from.y + "px)"; void cur.offsetWidth;
    tg.forEach(function (el, i) {
      later(function () { var p = pos(el); cur.style.transition = "transform .9s cubic-bezier(.3,.8,.3,1)"; cur.style.transform = "translate(" + p.x + "px," + p.y + "px)"; lastPos = p; el.classList.add("on"); }, t);
      later(function () { cur.classList.remove("click"); void cur.offsetWidth; cur.classList.add("click"); mock.dataset.step = String(i + 1); el.classList.remove("on"); }, t + 1100);
      t += 1700;
    });
    var total = t + 2300;
    prog.style.transition = "none"; prog.style.width = "0";
    if (auto) { void prog.offsetWidth; prog.style.transition = "width " + total + "ms linear"; prog.style.width = "100%"; later(function () { go(idx + 1); }, total); }
  }
  window.openGuide = function (start) {
    if (back) return;
    idx = 0; auto = true;
    back = document.createElement("div"); back.className = "gd-back"; back.setAttribute("role", "dialog"); back.setAttribute("aria-modal", "true"); back.setAttribute("aria-label", "Как пользоваться сайтом");
    back.innerHTML = '<div class="gd"><div class="tbar"><span class="ti">Мастер · Как пользоваться сайтом</span><button class="wb gd-x" title="Закрыть мастер">&#10005;<span> Закрыть</span></button></div><div class="gd-main"><div class="gd-stage"></div><div class="gd-side"><div class="gd-top"><span class="gd-count"></span></div>' +
      '<h2 class="gd-t"></h2><p class="gd-s"></p><div class="gd-note"></div><a class="gd-link" target="_blank" rel="noopener"></a>' +
      '<div class="gd-dots">' + SLIDES.map(function (_, i) { return '<button aria-label="Шаг ' + (i + 1) + '" data-i="' + i + '"></button>'; }).join("") + '</div>' +
      '<div class="gd-prog"><i></i></div><div class="gd-nav"><button class="btn ghost sm gd-prev">Назад</button><button class="btn ghost sm gd-auto" title="Автопоказ">Пауза</button><span class="sp"></span><button class="btn go gd-next">Дальше</button></div></div></div></div>';
    document.body.appendChild(back); stage = back.querySelector(".gd-stage");
    back.querySelector(".gd-x").onclick = close;
    back.querySelector(".gd-prev").onclick = function () { go(idx - 1); };
    back.querySelector(".gd-next").onclick = function () { auto = false; back.querySelector(".gd-auto").textContent = "Авто"; go(idx + 1); };
    back.querySelector(".gd-auto").onclick = function () { auto = !auto; this.textContent = auto ? "Пауза" : "Авто"; go(idx); };
    Array.prototype.forEach.call(back.querySelectorAll(".gd-dots button"), function (b) { b.onclick = function () { auto = false; back.querySelector(".gd-auto").textContent = "Авто"; go(+b.dataset.i); }; });
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    document.addEventListener("keydown", onKey);
    go(start || 0); back.querySelector(".gd-next").focus();
  };
})();
