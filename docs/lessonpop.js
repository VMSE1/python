/* Окна урока у ученика: задание опоздавшему и золотая монета с сундуками.
   Учитель отправляет их из lesson.html, сервер передаёт через /api/play, а site.js открывает это окно.
   Правильные ответы и призы знает только сервер: браузер присылает выбор и показывает, что ответил сервер. */
(function () {
  var ov = null;
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function css() {
    return '<style>#lp{position:fixed;inset:0;z-index:2147482300;background:rgba(10,6,30,.82);display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto}' +
      '#lp .win{width:min(560px,100%);background:#ffffe1;color:#111;border:3px solid #000;box-shadow:8px 8px 0 #000;font:500 16px/1.4 "IBM Plex Mono",ui-monospace,monospace}' +
      '#lp .hd{background:#3a1aa0;color:#fff;padding:8px 12px;font-weight:700;display:flex;justify-content:space-between;gap:10px}' +
      '#lp .bd{padding:16px}#lp h2{margin:0 0 6px;font-size:20px}#lp .m{color:#555;font-size:14px}' +
      '#lp pre{background:#1b1b2b;color:#f4f4f4;padding:10px;overflow:auto;font-size:14px;margin:10px 0;white-space:pre-wrap}' +
      '#lp .op{display:grid;gap:8px;margin-top:12px}#lp .op button,#lp .go{font:600 16px/1.3 "IBM Plex Mono",ui-monospace,monospace;text-align:left;padding:12px 14px;border:3px solid #000;background:#fff;box-shadow:3px 3px 0 #000;cursor:pointer;color:#111}' +
      '#lp .op button:active,#lp .go:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000}#lp .go{background:#ffd23a;text-align:center;margin-top:14px;width:100%}' +
      '#lp .ok{color:#0a7a2a;font-weight:700}#lp .bad{color:#c0142c;font-weight:700}#lp .bar{height:10px;background:#ddd;border:2px solid #000;margin:8px 0 2px}#lp .bar i{display:block;height:100%;background:#3a1aa0;transition:width 1s linear}' +
      '#lp .coin{display:inline-block;width:1.4em;height:1.4em;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6b0,#ffd23a 45%,#c98a00);border:2px solid #7a4d00;vertical-align:-.3em;margin-right:6px}' +
      '#lp .chs{display:flex;gap:14px;justify-content:center;margin:18px 0 6px;flex-wrap:wrap}' +
      '#lp .ch{width:min(110px,24vw);height:min(92px,20vw);border:3px solid #000;background:linear-gradient(#a0522d 0 38%,#000 38% 42%,#8b4513 42%);box-shadow:4px 4px 0 #000;cursor:pointer;position:relative;font:700 28px/1 "IBM Plex Mono",ui-monospace,monospace;color:#ffd23a}' +
      '#lp .ch::after{content:"";position:absolute;left:44%;top:30%;width:12%;height:22%;background:#ffd23a;border:2px solid #000}' +
      '#lp .ch:hover{transform:translateY(-4px)}#lp .ch.open{background:#2b1606;cursor:default;transform:none}#lp .ch.open::after{display:none}#lp .ch.mine{outline:4px solid #ffd23a;outline-offset:3px}' +
      '#lp .big{font-size:42px;font-weight:800;text-align:center;margin:10px 0}' +
      '@keyframes lpdrop{0%{transform:translateY(-120px) rotate(0);opacity:0}70%{opacity:1}100%{transform:translateY(0) rotate(360deg);opacity:1}}#lp .drop{animation:lpdrop .9s ease-out both}' +
      '@media (prefers-reduced-motion:reduce){#lp .drop{animation:none}#lp .bar i{transition:none}}</style>';
  }
  function open(title, html) {
    close();
    ov = document.createElement("div"); ov.id = "lp"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", title);
    ov.innerHTML = css() + '<div class="win"><div class="hd"><span>' + esc(title) + '</span><span id="lpt"></span></div><div class="bd" id="lpb">' + html + "</div></div>";
    document.body.appendChild(ov);
    return document.getElementById("lpb");
  }
  function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); ov = null; }
  function closeBtn(b, label) {
    var x = document.createElement("button"); x.className = "go"; x.type = "button"; x.textContent = label || "Закрыть"; x.onclick = close; b.appendChild(x); x.focus();
  }
  function fail(b, msg) { b.insertAdjacentHTML("beforeend", '<p class="bad" role="alert">' + esc(msg) + "</p>"); closeBtn(b); }

  /* Задание опоздавшему: несколько лёгких вопросов по теме урока, по одному на экране, с таймером. */
  function late() {
    if (document.getElementById("lp")) return;
    Net.req("GET", "/api/late").then(function (j) {
      if (!j.ok || !j.task) return;
      var t = j.task, ans = [], i = 0, end = Date.now() + t.left * 1000, total = t.left, tm = null;
      var b = open("Задание опоздавшему", "");
      function timer() {
        var left = Math.max(0, Math.round((end - Date.now()) / 1000)), el = document.getElementById("lpt"), bar = document.getElementById("lpbar");
        if (el) el.textContent = Math.floor(left / 60) + ":" + ("0" + left % 60).slice(-2);
        if (bar) bar.style.width = Math.max(0, left / total * 100) + "%";
        if (!left) { clearInterval(tm); b.innerHTML = '<h2>Время вышло</h2><p class="m">В следующий раз приходи вовремя 😉</p>'; closeBtn(b); }
      }
      function q() {
        var x = t.qs[i];
        b.innerHTML = (i === 0 ? '<h2>Ты опоздал, отыграйся!</h2><p class="m">Урок: ' + esc(t.title) + ". За каждый верный ответ монета в таблицу лидеров.</p>" : "") +
          '<div class="bar"><i id="lpbar"></i></div><p class="m">Вопрос ' + (i + 1) + " из " + t.qs.length + "</p><p><b>" + esc(x.q) + "</b></p>" + (x.code ? "<pre>" + esc(x.code) + "</pre>" : "") +
          '<div class="op">' + x.o.map(function (o, k) { return '<button type="button" data-k="' + k + '">' + String.fromCharCode(65 + k) + ") " + esc(o) + "</button>"; }).join("") + "</div>";
        timer();
        Array.prototype.forEach.call(b.querySelectorAll("button[data-k]"), function (btn) {
          btn.onclick = function () { ans.push(+btn.getAttribute("data-k")); i++; if (i < t.qs.length) q(); else send(); };
        });
        var f = b.querySelector("button[data-k]"); if (f) f.focus();
      }
      function send() {
        clearInterval(tm);
        b.innerHTML = '<p class="m">Проверяю…</p>';
        Net.req("POST", "/api/late", { id: t.id, answers: ans }).then(function (r) {
          if (!r.ok) { b.innerHTML = ""; fail(b, r.error || "Не получилось отправить."); return; }
          b.innerHTML = '<h2>' + (r.score === r.total ? "Всё верно!" : r.score ? "Неплохо!" : "Мимо, но ты старался") + '</h2><div class="big drop">' + r.score + " / " + r.total + "</div>" +
            (r.coins ? '<p style="text-align:center"><span class="coin drop"></span><b>+' + r.coins + " в таблицу лидеров</b></p>" : "") +
            r.res.map(function (x, k) { var qq = t.qs[k]; return '<p><span class="' + (x.ok ? "ok" : "bad") + '">' + (x.ok ? "✓" : "✗") + "</span> " + esc(qq.q) + (x.ok ? "" : '<br><span class="m">Правильно: ' + esc(qq.o[x.a]) + (x.why ? ". " + esc(x.why) : "") + "</span>") + "</p>"; }).join("");
          closeBtn(b, "Готово");
        }).catch(function (e) { b.innerHTML = ""; fail(b, e.message); });
      }
      tm = setInterval(timer, 1000);
      q();
    }).catch(function () {});
  }

  /* Золотая монета: три сундука, в одном больше монет. Что где лежит, решает сервер. */
  function gold(id) {
    if (document.getElementById("lp")) return;
    var b = open("Золотая монета!", '<h2><span class="coin drop"></span>Тебе выпала золотая монета!</h2><p class="m">Выбери сундук. В каждом от 1 до 3 монет.</p><div class="chs">' +
      [0, 1, 2].map(function (k) { return '<button type="button" class="ch" data-k="' + k + '" aria-label="Сундук ' + (k + 1) + '"></button>'; }).join("") + "</div>");
    var busy = false;
    Array.prototype.forEach.call(b.querySelectorAll(".ch"), function (c) {
      c.onclick = function () {
        if (busy) return; busy = true;
        var k = +c.getAttribute("data-k");
        Net.req("POST", "/api/gold", { id: id, pick: k }).then(function (r) {
          if (!r.ok) { fail(b, r.error || "Сундук не открылся."); return; }
          Array.prototype.forEach.call(b.querySelectorAll(".ch"), function (x, n) { x.classList.add("open"); x.disabled = true; x.textContent = "+" + r.chests[n]; if (n === k) x.classList.add("mine"); });
          b.insertAdjacentHTML("beforeend", '<div class="big drop">+' + r.prize + "</div><p style=\"text-align:center\">Монеты уже в таблице лидеров урока.</p>");
          closeBtn(b, "Забрать");
        }).catch(function (e) { fail(b, e.message); });
      };
    });
    var f = b.querySelector(".ch"); if (f) f.focus();
  }
  window.LessonPop = { late: late, gold: gold, close: close };
})();
