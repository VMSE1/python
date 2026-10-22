/* Рулетка «три черепа» и игра «Скелет и бочки». Сервер выбирает случайного ученика раз в 1–2 часа, и у него появляется это окно.
   Крутишь барабан: три черепа открывают игру. Победа с первого раза даёт красную пятёрку, проигрыш сжигает оценку (скелет смеётся).
   Все персонажи нарисованы здесь пикселями (человечек и скелет из egg.js), чужих героев в игре нет. */
(function () {
  var E = window.Egg, W = 640, H = 360, ov = null, cleanup = [];
  var SYM = {
    skull: null,
    bone: ["..XX....XX..", ".XXXXXXXXXX.", "..XX....XX.."],
    coin: ["..XXXX..", ".XYYYYX.", "XYYXXYYX", "XYXYYXYX", "XYXYYXYX", "XYYXXYYX", ".XYYYYX.", "..XXXX.."],
    heart: [".XX.XX.", "XRRXRRX", "XRRRRRX", ".XRRRX.", "..XRX..", "...X..."],
    star: ["...X...", "..XYX..", "XXXYXXX", ".XYYYX.", "..XYX..", ".XY.YX.", ".X...X."]
  };
  var COLS = { X: "#2a1204", Y: "#ffd23a", R: "#e0364a" };
  function drawSym(c, name, w, h, shake) {
    c.fillStyle = "#fff7d6"; c.fillRect(0, 0, w, h);
    if (name === "skull") { var u = Math.floor(Math.min(w / 16, h / 23)); E.sprite(c, E.SKULL, Math.round((w - 16 * u) / 2), Math.round((h - 23 * u) / 2) + (shake || 0), u, { X: "#f3ecd8", E: "#16060a" }); return; }
    var g = SYM[name], u2 = Math.floor(Math.min(w / (g[0].length + 1), h / (g.length + 1)));
    for (var j = 0; j < g.length; j++) for (var i = 0; i < g[j].length; i++) {
      var k = g[j][i]; if (k === ".") continue;
      c.fillStyle = name === "bone" ? (k === "X" ? "#e9e2d0" : COLS[k]) : (name === "star" && k === "X" ? "#b8860b" : COLS[k]);
      c.fillRect(Math.round((w - g[0].length * u2) / 2 + i * u2), Math.round((h - g.length * u2) / 2 + j * u2 + (shake || 0)), u2, u2);
    }
    if (name === "bone") { c.strokeStyle = "#2a1204"; c.lineWidth = 2; }
  }
  function who() { try { var a = JSON.parse(localStorage.getItem("acct") || "null"); return (a && a.nick) || ""; } catch (e) { return ""; } }
  function css() {
    return '<style>#lk{position:fixed;inset:0;z-index:2147482400;background:radial-gradient(circle at 50% 30%,#5a0f1b,#1a0206 75%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:14px;overflow:auto;text-align:center}' +
      '#lk .tt{font:400 clamp(16px,4.6vw,34px)/1.4 "Press Start 2P",monospace;color:#ffd23a;text-shadow:3px 3px 0 #000}' +
      '#lk .tx{font:500 clamp(14px,2.6vw,20px)/1.55 "IBM Plex Mono",monospace;max-width:640px}' +
      '#lk .rl{display:flex;gap:12px;justify-content:center}#lk .rl canvas{width:min(26vw,120px);height:auto;aspect-ratio:1;border:5px solid #ffd23a;background:#fff7d6;image-rendering:pixelated}' +
      '#lk button{font:600 clamp(14px,2.6vw,19px) "IBM Plex Mono",monospace;padding:14px 26px;min-height:52px;border:3px solid #fff;background:#ffd23a;color:#1a0206;cursor:pointer;box-shadow:4px 4px 0 #000}#lk button:disabled{opacity:.6}' +
      '#lk button:focus-visible{outline:4px dashed #fff;outline-offset:3px}#lk .pad{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}#lk .pad button{min-width:64px;padding:10px 14px;touch-action:none;user-select:none}' +
      '#lk canvas.g{width:min(100%,calc((100vh - 300px)*1.78),880px);height:auto;border:4px solid #fff;background:#12062a;image-rendering:pixelated;touch-action:none}' +
      '#lk .five{font:400 clamp(54px,14vw,110px)/1 "Press Start 2P",monospace;color:#ff2a2a;background:#fff;border:6px solid #000;padding:12px 26px;box-shadow:8px 8px 0 #000}' +
      '@media (prefers-reduced-motion:reduce){#lk *{animation:none!important}}</style>';
  }
  function mount(html) { if (!ov) { ov = document.createElement("div"); ov.id = "lk"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Рулетка"); document.body.appendChild(ov); } ov.innerHTML = css() + html; return ov; }
  function stopAll() { cleanup.forEach(function (f) { try { f(); } catch (e) {} }); cleanup = []; }
  function close() { stopAll(); if (ov) { ov.remove(); ov = null; } }

  /* ---------- Ха-ха-ха ---------- */
  function laughScreen(why) {
    stopAll();
    mount('<div class="tt">Ха-ха-ха!</div><canvas id="lc" width="420" height="300" style="width:min(86vw,420px);height:auto;image-rendering:pixelated" aria-hidden="true"></canvas>' +
      '<div class="tx">' + (/секрет/.test(why || "") ? '<b style="color:#ffd23a">Ха-ха!</b><br>' + why : '<b style="color:#ff5a6a">Это печально: оценки нет.</b><br>' + (why || "") + 'Выполни задание дальше. Фортуна может… а нет. Может, повезёт в следующий раз.') + '</div><button type="button" id="lkx">Продолжить</button>');
    var c = ov.querySelector("#lc").getContext("2d"), T = 0, last = 0, raf = 0;
    function fr(ts) {
      var dt = Math.min(.05, (ts - (last || ts)) / 1000); last = ts; T += dt;
      c.fillStyle = "#12062a"; c.fillRect(0, 0, 420, 300);
      c.fillStyle = "#2a0f4a"; for (var i = 0; i < 6; i++) c.fillRect((i * 83 + T * 20) % 460 - 20, 30 + (i % 3) * 40, 50, 8);
      E.laugh(c, 110, 10, 12, T);
      c.fillStyle = "#fff"; c.font = "bold 26px monospace"; var tx = ["ХА!", "ХА!", "ХА!"]; for (var k = 0; k < 3; k++) { if (Math.sin(T * 8 - k * 1.2) > -.2) c.fillText(tx[k], 20 + k * 16 + (k % 2) * 270, 70 + k * 70 + Math.sin(T * 9 + k) * 6); }
      raf = requestAnimationFrame(fr);
    }
    raf = requestAnimationFrame(fr); cleanup.push(function () { cancelAnimationFrame(raf); });
    ov.querySelector("#lkx").onclick = close; ov.querySelector("#lkx").focus();
  }

  /* ---------- красная пятёрка ---------- */
  function fiveScreen(secs) {
    stopAll(); var d = new Date(), p = function (x) { return ("0" + x).slice(-2); }, stamp = p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    try { localStorage.setItem("skull", JSON.stringify({ at: d.toISOString(), nick: who() })); } catch (e) {}
    mount('<div class="tt">Ты прошёл!</div><div class="five" role="img" aria-label="Оценка пять">5</div><div class="tx"><b>Позови преподавателя</b><br>' + String(who()).replace(/</g, "&lt;") + ' · ' + stamp + (secs ? ' · ' + secs + ' с' : "") + '</div><button type="button" id="lkx">Закрыть</button>');
    ov.querySelector("#lkx").onclick = close; ov.querySelector("#lkx").focus();
  }

  /* ---------- игра «Скелет и бочки» ---------- */
  function game(onEnd) {
    stopAll();
    mount('<div class="tt">Скелет и бочки</div><canvas class="g" id="gc" width="' + W + '" height="' + H + '" aria-label="Игра: поднимись по лестницам до скелета и не попади под бочки"></canvas>' +
      '<div class="tx" id="gm" role="status">Поднимайся по лестницам к скелету на верхнем этаже. Бочки катятся вниз: перепрыгивай. Попытка одна, на всё 75 секунд.</div>' +
      '<div class="pad"><button type="button" data-k="l" aria-label="Влево">◀</button><button type="button" data-k="r" aria-label="Вправо">▶</button><button type="button" data-k="u" aria-label="Вверх по лестнице">▲</button><button type="button" data-k="d" aria-label="Вниз по лестнице">▼</button><button type="button" data-k="j">Прыжок</button></div>');
    var c = ov.querySelector("#gc").getContext("2d");
    var F = [{ y: 312, x0: 0, x1: 640 }, { y: 232, x0: 0, x1: 560 }, { y: 152, x0: 80, x1: 640 }, { y: 72, x0: 0, x1: 560 }];
    var LAD = [{ x: 500, a: 1, b: 0 }, { x: 130, a: 2, b: 1 }, { x: 500, a: 3, b: 2 }];
    var DIR = [-1, 1, -1, 1];
    var HW = 27, HH = 42, G = 900, K = { l: 0, r: 0, u: 0, d: 0, j: 0 };
    var hero = { x: 40, y: F[0].y, vy: 0, on: true, lad: null, face: 1, ft: 0, f: 0 }, barrels = [], T = 0, spawnIn = 1.4, last = 0, raf = 0, over = false, noB = false, LIM = 75;
    function endGame(win, text) {
      if (over) return; over = true; cancelAnimationFrame(raf); var m = ov.querySelector("#gm"); if (m) m.textContent = text;
      setTimeout(function () { onEnd(win, Math.round(T)); }, 900);
    }
    function step(dt) {
      var prev = hero.y;
      if (hero.lad) {
        var L = hero.lad; hero.x = L.x; hero.y += (K.d - K.u) * 90 * dt;
        if (hero.y <= F[L.a].y) { hero.y = F[L.a].y; hero.lad = null; hero.on = true; hero.vy = 0; }
        else if (hero.y >= F[L.b].y) { hero.y = F[L.b].y; hero.lad = null; hero.on = true; hero.vy = 0; }
        else if (K.j) { hero.lad = null; hero.vy = -200; hero.on = false; }
      } else {
        var vx = (K.r - K.l) * 130; if (vx) hero.face = vx > 0 ? 1 : -1; hero.x = Math.max(14, Math.min(626, hero.x + vx * dt));
        if (vx && hero.on) { hero.ft += dt; if (hero.ft > .1) { hero.ft = 0; hero.f = (hero.f + 1) % 2; } }
        if ((K.u || K.d) && hero.on) {
          for (var i = 0; i < LAD.length; i++) { var L2 = LAD[i];
            if (Math.abs(hero.x - L2.x) <= 12 && ((K.u && Math.abs(hero.y - F[L2.b].y) < 3) || (K.d && Math.abs(hero.y - F[L2.a].y) < 3))) { hero.lad = L2; hero.x = L2.x; hero.on = false; hero.vy = 0; break; } }
        }
        if (!hero.lad) {
          if (K.j && hero.on) { hero.vy = -330; hero.on = false; }
          hero.vy += G * dt; hero.y += hero.vy * dt; hero.on = false;
          if (hero.vy >= 0) for (var n = 0; n < F.length; n++) { var f = F[n]; if (hero.x >= f.x0 && hero.x <= f.x1 && prev <= f.y + 1 && hero.y >= f.y) { hero.y = f.y; hero.vy = 0; hero.on = true; break; } }
          if (hero.y > F[0].y) { hero.y = F[0].y; hero.vy = 0; hero.on = true; }
        }
      }
      /* бочки */
      spawnIn -= dt; if (spawnIn <= 0 && !noB) { barrels.push({ x: 112, y: F[3].y, vy: 0, fl: 3, on: true, a: 0 }); spawnIn = Math.max(1.5, 2.5 - T * .012); }
      barrels.forEach(function (b) {
        b.a += dt * 6;
        if (b.on) { b.x += DIR[b.fl] * 95 * dt; var f = F[b.fl]; if (b.x < f.x0 - 4 || b.x > f.x1 + 4) { b.on = false; b.vy = 0; } }
        else { var py = b.y; b.vy += G * dt; b.y += b.vy * dt; for (var q = b.fl - 1; q >= 0; q--) { var g = F[q]; if (b.x >= g.x0 && b.x <= g.x1 && py <= g.y + 1 && b.y >= g.y) { b.y = g.y; b.vy = 0; b.on = true; b.fl = q; break; } } }
        if (!over && b.x > hero.x - 18 && b.x < hero.x + 18 && b.y > hero.y - HH + 6 && b.y - 16 < hero.y - 4) endGame(false, "Бочка! Попытка была одна.");
      });
      barrels = barrels.filter(function (b) { return b.x > -30 && b.x < 670 && b.y < 400; });
      if (hero.on && Math.abs(hero.y - F[3].y) < 2 && hero.x < 84) endGame(true, "Ты поймал скелета!");
      else if (T >= LIM) endGame(false, "Время вышло.");
    }
    function draw() {
      c.fillStyle = "#12062a"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#1c0b3a"; for (var i = 0; i < 16; i++) c.fillRect((i * 43) % W, (i * 71) % 300, 30, 4);
      LAD.forEach(function (L) { var y0 = F[L.a].y, y1 = F[L.b].y; c.fillStyle = "#8ab4ff"; c.fillRect(L.x - 12, y0, 3, y1 - y0); c.fillRect(L.x + 9, y0, 3, y1 - y0); for (var y = y0 + 6; y < y1; y += 10) c.fillRect(L.x - 12, y, 24, 3); });
      F.forEach(function (f) { c.fillStyle = "#b5541c"; c.fillRect(f.x0, f.y, f.x1 - f.x0, 8); c.fillStyle = "#7a3510"; for (var x = f.x0; x < f.x1; x += 20) c.fillRect(x, f.y + 3, 10, 3); });
      E.laugh(c, 12, F[3].y - 69, 3, T, Math.round((Math.sin(T * 5) * .5 + .5) * 2));
      c.fillStyle = "#ffd23a"; c.font = "bold 12px monospace"; c.fillText("ЦЕЛЬ", 20, F[3].y - 74);
      barrels.forEach(function (b) { c.save(); c.translate(b.x, b.y - 9); c.rotate(b.a); c.fillStyle = "#a0522d"; c.fillRect(-9, -9, 18, 18); c.fillStyle = "#4a2208"; c.fillRect(-9, -3, 18, 3); c.fillRect(-9, 4, 18, 3); c.fillStyle = "#e9c46a"; c.fillRect(-2, -9, 4, 18); c.restore(); });
      var hx = Math.round(hero.x - 13), hy = Math.round(hero.y - HH), fr = hero.lad ? (Math.floor(T * 6) % 2) : (hero.on ? hero.f : 2);
      E.sprite(c, E.MAN, hx, hy, 3); E.sprite(c, E.LEGS[fr], hx, hy + E.MAN.length * 3, 3);
      c.fillStyle = "#fff"; c.font = "bold 16px monospace"; c.textAlign = "right"; c.fillText(Math.max(0, Math.ceil(LIM - T)) + " с", W - 10, 22); c.textAlign = "left";
    }
    function loop(ts) { var dt = Math.min(.05, (ts - (last || ts)) / 1000); last = ts; if (!over) { T += dt; step(dt); } draw(); if (!over) raf = requestAnimationFrame(loop); }
    var KM = { ArrowLeft: "l", a: "l", A: "l", ф: "l", ArrowRight: "r", d: "r", D: "r", в: "r", ArrowUp: "u", w: "u", W: "u", ц: "u", ArrowDown: "d", s: "d", S: "d", ы: "d", " ": "j" };
    function kd(e) { var k = KM[e.key]; if (!k) return; e.preventDefault(); K[k] = 1; if (k === "u" && !hero.lad) K.j = K.j; }
    function ku(e) { var k = KM[e.key]; if (!k) return; K[k] = 0; }
    document.addEventListener("keydown", kd, true); document.addEventListener("keyup", ku, true);
    Array.prototype.forEach.call(ov.querySelectorAll(".pad button"), function (b) {
      var k = b.dataset.k; b.addEventListener("pointerdown", function (e) { e.preventDefault(); K[k] = 1; }); ["pointerup", "pointerleave", "pointercancel"].forEach(function (n) { b.addEventListener(n, function () { K[k] = 0; }); });
    });
    cleanup.push(function () { document.removeEventListener("keydown", kd, true); document.removeEventListener("keyup", ku, true); cancelAnimationFrame(raf); });
    raf = requestAnimationFrame(loop);
    window.Lucky._t = { state: function () { return { x: hero.x, y: hero.y, lad: !!hero.lad, floor: F.map(function (f) { return f.y; }).indexOf(Math.round(hero.y)), t: T, over: over, barrels: barrels.length }; }, nob: function (v) { noB = v; if (v) barrels = []; }, win: function () { hero.x = 40; hero.y = F[3].y; hero.on = true; }, hit: function () { barrels.push({ x: hero.x, y: hero.y, vy: 0, fl: 0, on: true, a: 0 }); }, K: K };
  }

  /* ---------- рулетка ---------- */
  function roulette(opts) {
    if (ov) return;
    mount('<div class="tt">Тебе выпал шанс!</div><div class="tx">Крути барабан. Если выпадут <b>три черепа</b>, откроется игра. Пройдёшь её с первого раза и получишь <b style="color:#ff5a6a">красную пятёрку</b>. Не выпадет или проиграешь: оценка сгорает.</div>' +
      '<div class="rl" aria-live="polite"><canvas width="100" height="100" id="r0"></canvas><canvas width="100" height="100" id="r1"></canvas><canvas width="100" height="100" id="r2"></canvas></div><div class="tx" id="lkm" role="status"></div><button type="button" id="lks">Крутить</button>');
    var cs = [0, 1, 2].map(function (i) { return ov.querySelector("#r" + i).getContext("2d"); }), names = ["skull", "bone", "coin", "heart", "star"], cur = ["bone", "coin", "star"];
    cs.forEach(function (c, i) { drawSym(c, cur[i], 100, 100); });
    var btn = ov.querySelector("#lks"), msg = ov.querySelector("#lkm"), busy = false;
    btn.focus();
    btn.onclick = function () {
      if (busy) return; busy = true; btn.disabled = true; msg.textContent = "Крутим…";
      Net.req("POST", "/api/lucky/spin", {}).then(function (j) {
        if (!j.ok) { msg.textContent = j.error || "Не получилось."; setTimeout(close, 2500); return; }
        var t0 = performance.now(), stop = [900, 1400, 1900], done = [false, false, false], raf = 0;
        function fr(now) {
          var el = Math.max(0, (now || performance.now()) - t0), all = true;
          cs.forEach(function (c, i) {
            if (done[i]) return;
            if (el >= stop[i]) { done[i] = true; drawSym(c, j.reels[i], 100, 100); } else { all = false; drawSym(c, names[(Math.floor(el / 70 + i * 2) % names.length + names.length) % names.length], 100, 100, Math.round(Math.sin(el / 30) * 6)); }
          });
          if (!all) raf = requestAnimationFrame(fr); else if (!fin) { fin = true; clearTimeout(fb); setTimeout(function () { after(j); }, 700); }
        }
        /* страховка: если анимация не может идти (вкладка в фоне, ошибка рисования), через 3 секунды показываем результат сами */
        var fin = false, fb = setTimeout(function () { if (fin) return; fin = true; cancelAnimationFrame(raf); cs.forEach(function (c, i) { try { drawSym(c, j.reels[i], 100, 100); } catch (e) {} }); after(j); }, 3500);
        var fr0 = fr; fr = function (now) { if (fin) return; try { fr0(now); } catch (e) { if (!fin) { fin = true; clearTimeout(fb); after(j); } } };
        raf = requestAnimationFrame(fr); cleanup.push(function () { fin = true; clearTimeout(fb); cancelAnimationFrame(raf); });
      }).catch(function (e) { msg.textContent = e.message; setTimeout(close, 2500); });
    };
    function after(j) {
      if (!j.win) { laughScreen("Три черепа не выпали. "); return; }
      mount('<div class="tt">Три черепа!</div><div class="tx">Поднимись по лестницам к скелету. Стрелки или кнопки на экране, пробел для прыжка. Бочки катятся вниз. <b>Попытка одна.</b></div><button type="button" id="lkg">Начать игру</button>');
      ov.querySelector("#lkg").onclick = function () {
        game(function (win, secs) {
          Net.req("POST", "/api/lucky/finish", { win: win, token: j.token }).then(function (r) {
            if (win && r.ok && r.five) fiveScreen(secs); else laughScreen(win ? "Игру не засчитали. " : "Скелет оказался хитрее. ");
          }).catch(function () { laughScreen(win ? "Нет связи с сервером, пятёрку не записали. Скажи учителю. " : ""); });
        });
      };
      ov.querySelector("#lkg").focus();
    }
  }
  function practice() {
    if (ov) return;
    game(function (win, secs) {
      mount('<div class="tt">' + (win ? "Ты дошёл!" : "Не вышло") + '</div><div class="tx">' + (win ? "Тренировка пройдена за " + secs + " с. Оценок за неё нет, это просто секрет." : "Бочка оказалась быстрее. Тренировка не считается, можно ещё раз.") + '</div><div class="pad"><button type="button" id="lka">Ещё раз</button><button type="button" id="lkx">Закрыть</button></div>');
      ov.querySelector("#lkx").onclick = close; ov.querySelector("#lka").onclick = function () { close(); practice(); }; ov.querySelector("#lka").focus();
    });
    var x = document.createElement("button"); x.type = "button"; x.textContent = "Выйти"; x.style.cssText = "position:absolute;top:10px;right:10px;min-height:44px;padding:8px 16px"; x.onclick = close; ov.appendChild(x);
  }
  function fun() { if (ov) return; laughScreen("Ты нашёл смеющегося скелета! Это секрет, оценок за него нет. Подсказка дальше: ↑ ↑ ↓ ↓ ← → ← → B A. "); }
  window.Lucky = { practice: practice, fun: fun, open: roulette, laugh: laughScreen, close: close, _t: null };
})();
