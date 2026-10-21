/* Пасхалка: набери на клавиатуре 22832267. Красный экран, мини-игра «убеги от скелета» (прыгай через препятствия).
   После победы: «Позови преподавателя». Все персонажи нарисованы здесь, это пиксельная графика на canvas. */
(function () {
  var W = 640, H = 360, GROUND = 296, U = 4;
  var SKULL = ["................", "....XXXXXXXX....", "...XXXXXXXXXX...", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXEEEXXEEEXX..", "..XEEEEXXEEEEX..", "..XEEEEXXEEEEX..", "..XXEEXXXXEEXX..", "...XXXXNNXXXX...", "....XXXNNXXX....", "....XXXXXXXX....", ".....XTXTXTX....", ".....XTXTXTX....", "......XXXXXX....",
    "......XXXXXX....", "....XXXXXXXXXX..", "..X..XX..XX..X..", "..X..XXXXXX..X..", "..X...XXXX...X..", ".....XX..XX.....", ".....XX..XX.....", "....XXX..XXX...."];
  var MAN = ["..HHHHH..", ".HHHHHHH.", ".HSSSSSH.", ".SSESSES.", ".SSSSSSS.", "...SSS...", ".RRRRRRR.", "SRRRRRRRS", "SRRRRRRRS", ".RRRRRRR.", ".BBBBBBB."];
  var LEGS = [["..BB.BB..", ".BB...BB.", ".LL...LLL"], ["...BBB...", "...BBB...", "..LLLLL.."], ["..BB.BB..", ".BB...BB.", "LLL...LL."]];
  var MH = 14; /* высота человечка в клетках: 11 тела + 3 ног */
  var COL = { X: "#e9e2d0", E: "#16060a", N: "#16060a", T: "#bdb39a", H: "#3a1a0a", S: "#f2c9a0", R: "#d62839", B: "#2a2f7a", L: "#111", Y: "#ffe14d" };
  var ST;

  function sprite(c, rows, x, y, u, over) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var k = rows[j][i]; if (k === ".") continue;
      c.fillStyle = (over && over[k]) || COL[k]; c.fillRect(Math.round(x + i * u), Math.round(y + j * u), u, u);
    }
  }
  function skeleton(c, x, y, u, kind, t) {
    var bob = Math.round(Math.sin(t * 9) * u * .4);
    sprite(c, SKULL, x, y + bob, u, kind ? { E: "#16060a", X: "#f3ecd8" } : null);
    if (kind) {
      c.fillStyle = "#ffe14d"; c.fillRect(x + 5 * u, y + bob + 6 * u, u, u); c.fillRect(x + 10 * u, y + bob + 6 * u, u, u);
      c.fillStyle = "#16060a"; c.fillRect(x + 5 * u, y + bob + 12 * u, u, u); c.fillRect(x + 6 * u, y + bob + 13 * u, 4 * u, u); c.fillRect(x + 10 * u, y + bob + 12 * u, u, u);
    } else {
      c.fillStyle = "#ff2a2a"; c.fillRect(x + 5 * u, y + bob + 6 * u, 2 * u, 2 * u); c.fillRect(x + 9 * u, y + bob + 6 * u, 2 * u, 2 * u);
    }
  }
  function man(c, x, y, u, f) { sprite(c, MAN, x, y, u); sprite(c, LEGS[f], x, y + MAN.length * u, u); }
  function shadow(c, x, w, h) { c.fillStyle = "rgba(0,0,0," + Math.max(.12, .45 - h / 400) + ")"; c.fillRect(x + (h / 12), GROUND, Math.max(10, w - h / 4), 4); }

  function start() {
    if (document.getElementById("egg")) return;
    var ov = document.createElement("div"); ov.id = "egg"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Секретная игра"); ov.dataset.state = "ready"; ov.dataset.score = "0";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px;background:#7a0a16;animation:eggf 1.1s steps(2) infinite;touch-action:manipulation;-webkit-user-select:none;user-select:none";
    ov.innerHTML = '<style>@keyframes eggf{50%{background:#3a0409}}@media (prefers-reduced-motion:reduce){#egg{animation:none!important}}#egg button{font:600 clamp(14px,2.6vw,19px) "IBM Plex Mono",monospace;padding:12px 20px;min-height:48px;border:3px solid #fff;background:#fff;color:#a8101f;cursor:pointer}#egg button.g{background:transparent;color:#fff}#egg button:focus-visible{outline:4px dashed #ffe14d;outline-offset:3px}</style>' +
      '<div id="egt" style="font:400 clamp(12px,3vw,20px)/1.5 \'Press Start 2P\',monospace;color:#fff;text-shadow:2px 2px 0 #000;text-align:center">Убеги от скелета</div>' +
      '<canvas id="egc" width="' + W + '" height="' + H + '" style="width:min(100%,calc((100vh - 190px)*1.78),880px);height:auto;background:#1a0206;border:4px solid #fff;image-rendering:pixelated;touch-action:none" aria-label="Игра: прыгай через препятствия"></canvas>' +
      '<div id="egm" style="font:500 clamp(14px,2.4vw,18px)/1.5 \'IBM Plex Mono\',monospace;color:#fff;text-align:center;min-height:3em" role="status">Нажми «Прыжок», пробел или стрелку вверх. Перепрыгни 25 препятствий.</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center"><button type="button" id="egj">Прыжок</button><button type="button" id="egx" class="g">Выйти</button></div>';
    document.body.appendChild(ov);
    var cv = ov.querySelector("#egc"), c = cv.getContext("2d"), msg = ov.querySelector("#egm"), title = ov.querySelector("#egt");
    var GOAL = 25, raf = 0, last = 0, T = 0, s, UM = 5, PW = 36, PH = MH * UM;
    var BOOST = { shield: { name: "Щит", col: "#4db8ff", dur: 0 }, slow: { name: "Замедление", col: "#ffe14d", dur: 6 }, jump2: { name: "Двойной прыжок", col: "#6dff8a", dur: 9 } };
    function reset() {
      s = { y: 0, vy: 0, on: true, obs: [], items: [], cleared: 0, gap: 150, speed: 230, next: 1.2, nextItem: 5, state: "play", f: 0, ft: 0, flash: 0, jumps: 0, shield: false, slow: 0, jump2: 0, note: "", noteT: 0 };
      ov.dataset.state = "playing"; ov.dataset.score = "0"; title.textContent = "Убеги от скелета"; var b = ov.querySelector("#egj"); b.textContent = "Прыжок";
      msg.textContent = "Перепрыгни " + GOAL + " препятствий. Лови цветные шары: щит, замедление, двойной прыжок. Под летучей мышью не прыгай.";
    }
    function say(t) { s.note = t; s.noteT = 1.6; }
    function jump() {
      if (s.state === "lost") { reset(); return; } if (s.state === "won") return;
      if (s.on) { s.vy = -560; s.on = false; s.jumps = 1; }
      else if (s.jump2 > 0 && s.jumps < 2) { s.vy = -520; s.jumps = 2; }
    }
    function spawn() {
      var r = Math.random();
      if (s.cleared >= 5 && r < .22) s.obs.push({ x: W + 20, w: 34, h: 22, bat: true, y: 82 + Math.random() * 14, pass: false });
      else { var tall = r < .5, h = (tall ? 3 : 2) * 16, w = (Math.random() < .3 ? 2 : 1) * 16 + 8; s.obs.push({ x: W + 20, w: w, h: h, spike: !tall && Math.random() < .5, pass: false }); }
      s.next = .85 + Math.random() * .9 - Math.min(.35, s.cleared * .012);
    }
    function spawnItem() { var k = ["shield", "slow", "jump2"][Math.floor(Math.random() * 3)]; s.items.push({ x: W + 20, y: 40 + Math.random() * 60, k: k }); s.nextItem = 6 + Math.random() * 4; }
    function hurt() { if (s.shield) { s.shield = false; say("Щит спас!"); s.flash = .3; return; } s.gap -= 55; s.flash = .35; }
    function step(dt) {
      if (s.state !== "play") return;
      var sp = (230 + s.cleared * 5) * (s.slow > 0 ? .6 : 1);
      s.speed = sp; s.ft += dt; if (s.ft > .11) { s.ft = 0; s.f = (s.f + 1) % 2; }
      s.vy += 1700 * dt; s.y += s.vy * dt; if (s.y >= 0) { s.y = 0; s.vy = 0; s.on = true; s.jumps = 0; }
      s.next -= dt; if (s.next <= 0) spawn(); s.nextItem -= dt; if (s.nextItem <= 0) spawnItem();
      s.gap = Math.min(150, s.gap + 7 * dt); if (s.flash > 0) s.flash -= dt; if (s.noteT > 0) s.noteT -= dt;
      if (s.slow > 0) s.slow -= dt; if (s.jump2 > 0) s.jump2 -= dt;
      var px = 210, py = GROUND - PH + s.y, top = py, bot = py + PH;
      s.obs.forEach(function (o) {
        o.x -= sp * dt;
        var oy = o.bat ? GROUND - o.y - o.h : GROUND - o.h, ob = oy + o.h;
        if (!o.hit && px + PW - 6 > o.x + 3 && px + 6 < o.x + o.w - 3 && bot - 4 > oy + 3 && top + 6 < ob) { o.hit = true; hurt(); }
        if (!o.pass && !o.hit && o.x + o.w < px) { o.pass = true; s.cleared++; ov.dataset.score = s.cleared; }
      });
      s.items.forEach(function (it) {
        it.x -= sp * dt; var iy = GROUND - it.y - 12;
        if (!it.got && px + PW > it.x && px < it.x + 24 && bot > iy && top < iy + 24) {
          it.got = true; var d = BOOST[it.k];
          if (it.k === "shield") s.shield = true; else s[it.k] = d.dur; say(d.name + "!");
        }
      });
      s.obs = s.obs.filter(function (o) { return o.x > -60 && !o.hit; }); s.items = s.items.filter(function (it) { return it.x > -40 && !it.got; });
      if (s.gap <= 0) { s.state = "lost"; ov.dataset.state = "lost"; title.textContent = "Он догнал тебя"; msg.textContent = "Нажми «Прыжок», чтобы попробовать ещё раз."; var b = ov.querySelector("#egj"); b.textContent = "Ещё раз"; }
      else if (s.cleared >= GOAL) { s.state = "won"; ov.dataset.state = "won"; title.textContent = "Ты убежал!"; msg.innerHTML = "<b style=\"font-size:1.5em\">Позови преподавателя</b>"; var b2 = ov.querySelector("#egj"); b2.textContent = "Закрыть"; }
    }
    function orb(x, y, k) { var col = BOOST[k].col; c.fillStyle = col; c.fillRect(x + 4, y, 16, 24); c.fillRect(x, y + 4, 24, 16); c.fillStyle = "#fff"; c.fillRect(x + 6, y + 4, 5, 5); c.fillStyle = "#16060a"; c.font = "bold 14px monospace"; c.fillText(k === "shield" ? "Щ" : k === "slow" ? "З" : "2", x + 6, y + 18); }
    function draw() {
      c.fillStyle = "#1a0206"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#2a0710"; for (var i = 0; i < 9; i++) { var bx = ((i * 97 - (s.state === "play" ? T * 30 : 0)) % W + W) % W; c.fillRect(bx, 40 + (i % 3) * 28, 40, 8); }
      c.fillStyle = "#5a0f1b"; c.fillRect(0, GROUND, W, H - GROUND); c.fillStyle = "#9a1a2b"; c.fillRect(0, GROUND, W, 4);
      c.fillStyle = "#7a1424"; for (var k = 0; k < 14; k++) { var gx = ((k * 61 - (s.state === "play" ? T * s.speed : 0)) % W + W) % W; c.fillRect(gx, GROUND + 14 + (k % 3) * 14, 18, 3); }
      if (s.state === "won") {
        skeleton(c, 330, GROUND - 23 * 6, 6, true, T); man(c, 220, GROUND - MH * 6, 6, 2); shadow(c, 220, 54, 0);
        c.fillStyle = "#ffe14d"; c.font = "bold 22px monospace"; c.fillText("♥", 300, GROUND - 130); return;
      }
      var sx = 210 - s.gap - 16 * U - 20; skeleton(c, sx, GROUND - 23 * U, U, false, T);
      s.obs.forEach(function (o) {
        if (o.bat) { var by = GROUND - o.y - o.h, wf = Math.sin(T * 20) > 0; c.fillStyle = "#2b2b3a"; c.fillRect(o.x + 10, by + 6, 14, 12); c.fillRect(o.x, by + (wf ? 0 : 8), 12, 6); c.fillRect(o.x + 22, by + (wf ? 0 : 8), 12, 6); c.fillStyle = "#ff2a2a"; c.fillRect(o.x + 13, by + 9, 3, 3); c.fillRect(o.x + 19, by + 9, 3, 3); return; }
        c.fillStyle = "#c9c1ac"; if (o.spike) { c.beginPath(); c.moveTo(o.x, GROUND); c.lineTo(o.x + o.w / 2, GROUND - o.h); c.lineTo(o.x + o.w, GROUND); c.fill(); }
        else { c.fillRect(o.x, GROUND - o.h, o.w, o.h); c.fillStyle = "#8a826e"; c.fillRect(o.x + 4, GROUND - o.h + 4, o.w - 8, 4); }
      });
      s.items.forEach(function (it) { orb(it.x, GROUND - it.y - 12 + Math.round(Math.sin(T * 4 + it.x) * 3), it.k); });
      var py = GROUND - PH + s.y; shadow(c, 210, PW + 4, -s.y);
      if (s.shield) { c.strokeStyle = "#4db8ff"; c.lineWidth = 3; c.beginPath(); c.arc(210 + PW / 2, py + PH / 2, PH / 2 + 8, 0, 6.3); c.stroke(); }
      if (s.flash > 0 && Math.floor(s.flash * 20) % 2) c.globalAlpha = .4;
      man(c, 210 - 1, py, UM, s.on ? s.f : 2); c.globalAlpha = 1;
      c.fillStyle = "#fff"; c.font = "bold 18px monospace"; c.fillText(s.cleared + " / " + GOAL, 14, 28);
      c.fillStyle = "#ff5a6a"; c.fillRect(14, 40, Math.max(0, s.gap), 8); c.strokeStyle = "#fff"; c.lineWidth = 1; c.strokeRect(14, 40, 150, 8);
      var ix = W - 14; c.font = "bold 13px monospace"; c.textAlign = "right";
      [["shield", s.shield ? 1 : 0, "Щит"], ["slow", s.slow, "Замедл."], ["jump2", s.jump2, "2 прыжка"]].forEach(function (r, n) { if (r[1] > 0) { c.fillStyle = BOOST[r[0]].col; c.fillText(r[2] + (r[0] === "shield" ? "" : " " + Math.ceil(r[1]) + "с"), ix, 24 + n * 18); } });
      if (s.noteT > 0) { c.fillStyle = "#fff"; c.font = "bold 22px monospace"; c.textAlign = "center"; c.fillText(s.note, 210 + PW / 2, GROUND - PH - 30 + s.y * .3); }
      c.textAlign = "left";
    }
    function loop(ts) { var dt = Math.min(.05, (ts - (last || ts)) / 1000); last = ts; T += dt; step(dt); draw(); raf = requestAnimationFrame(loop); }
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "ц" || e.key === "Enter") { if (e.target && e.target.tagName === "BUTTON" && e.key !== " ") return; e.preventDefault(); act(); }
    }
    function act() { if (s.state === "won") { close(); return; } jump(); }
    function close() { cancelAnimationFrame(raf); document.removeEventListener("keydown", key, true); ov.remove(); ST = null; }
    document.addEventListener("keydown", key, true);
    cv.addEventListener("pointerdown", function (e) { e.preventDefault(); act(); });
    ov.querySelector("#egj").onclick = act; ov.querySelector("#egx").onclick = close;
    reset(); raf = requestAnimationFrame(loop); ov.querySelector("#egj").focus();
    ST = { win: function () { s.cleared = GOAL; }, s: function () { return s; }, state: function () { return s.state; }, close: close };
  }
  window.Egg = { start: start, _t: function () { return ST; } };
})();
