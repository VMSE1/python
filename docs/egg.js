/* Пасхалка: набери на клавиатуре 22832267. Красный экран, мини-игра «убеги от скелета» (прыгай через препятствия).
   После победы: «Позови преподавателя». Все персонажи нарисованы здесь, это пиксельная графика на canvas. */
(function () {
  var W = 640, H = 360, GROUND = 296, U = 4;
  var SKULL = ["................", "....XXXXXXXX....", "...XXXXXXXXXX...", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..", "..XXEEEXXEEEXX..", "..XEEEEXXEEEEX..", "..XEEEEXXEEEEX..", "..XXEEXXXXEEXX..", "...XXXXNNXXXX...", "....XXXNNXXX....", "....XXXXXXXX....", ".....XTXTXTX....", ".....XTXTXTX....", "......XXXXXX....",
    "......XXXXXX....", "....XXXXXXXXXX..", "..X..XX..XX..X..", "..X..XXXXXX..X..", "..X...XXXX...X..", ".....XX..XX.....", ".....XX..XX.....", "....XXX..XXX...."];
  var MAN = ["..HHH..", "..SSS..", "..SSS..", ".RRRRR.", "SRRRRRS", ".RRRRR.", "..BBB..", "..BBB.."];
  var LEGS = [["..B.B..", ".LL.LL."], ["...B...", "..LLL.."], ["..B.B..", "..L.L.."]];
  var COL = { X: "#e9e2d0", E: "#16060a", N: "#16060a", T: "#bdb39a", H: "#3a1a0a", S: "#f2c9a0", R: "#d62839", B: "#2a2f7a", L: "#111" };
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

  function start() {
    if (document.getElementById("egg")) return;
    var ov = document.createElement("div"); ov.id = "egg"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Секретная игра"); ov.dataset.state = "ready"; ov.dataset.score = "0";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px;background:#7a0a16;animation:eggf 1.1s steps(2) infinite;touch-action:manipulation;-webkit-user-select:none;user-select:none";
    ov.innerHTML = '<style>@keyframes eggf{50%{background:#3a0409}}@media (prefers-reduced-motion:reduce){#egg{animation:none!important}}#egg button{font:600 clamp(14px,2.6vw,19px) "IBM Plex Mono",monospace;padding:12px 20px;min-height:48px;border:3px solid #fff;background:#fff;color:#a8101f;cursor:pointer}#egg button.g{background:transparent;color:#fff}#egg button:focus-visible{outline:4px dashed #ffe14d;outline-offset:3px}</style>' +
      '<div id="egt" style="font:400 clamp(12px,3vw,20px)/1.5 \'Press Start 2P\',monospace;color:#fff;text-shadow:2px 2px 0 #000;text-align:center">Убеги от скелета</div>' +
      '<canvas id="egc" width="' + W + '" height="' + H + '" style="width:min(100%,calc((100vh - 190px)*1.78),880px);height:auto;background:#1a0206;border:4px solid #fff;image-rendering:pixelated;touch-action:none" aria-label="Игра: прыгай через препятствия"></canvas>' +
      '<div id="egm" style="font:500 clamp(14px,2.4vw,18px)/1.5 \'IBM Plex Mono\',monospace;color:#fff;text-align:center;min-height:3em" role="status">Нажми «Прыжок», пробел или стрелку вверх. Перепрыгни 20 препятствий.</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center"><button type="button" id="egj">Прыжок</button><button type="button" id="egx" class="g">Выйти</button></div>';
    document.body.appendChild(ov);
    var cv = ov.querySelector("#egc"), c = cv.getContext("2d"), msg = ov.querySelector("#egm"), title = ov.querySelector("#egt");
    var GOAL = 20, raf = 0, last = 0, T = 0;
    var s;
    function reset() { s = { y: 0, vy: 0, on: true, obs: [], cleared: 0, gap: 150, speed: 230, next: 1.2, state: "play", f: 0, ft: 0, flash: 0, over: 0 }; ov.dataset.state = "playing"; title.textContent = "Убеги от скелета"; msg.textContent = "Перепрыгни " + GOAL + " препятствий. Не дай скелету догнать."; }
    function jump() { if (s.state === "lost") { reset(); return; } if (s.state === "won") return; if (s.on) { s.vy = -560; s.on = false; } }
    function spawn() { var tall = Math.random() < .35, h = (tall ? 3 : 2) * 16, w = (Math.random() < .3 ? 2 : 1) * 16 + 8; s.obs.push({ x: W + 20, w: w, h: h, spike: !tall && Math.random() < .5, pass: false }); s.next = .85 + Math.random() * .9 - Math.min(.35, s.cleared * .015); }
    function step(dt) {
      if (s.state !== "play") return;
      s.speed = 230 + s.cleared * 6; s.ft += dt; if (s.ft > .11) { s.ft = 0; s.f = (s.f + 1) % 2; }
      s.vy += 1700 * dt; s.y += s.vy * dt; if (s.y >= 0) { s.y = 0; s.vy = 0; s.on = true; }
      s.next -= dt; if (s.next <= 0) spawn();
      s.gap = Math.min(150, s.gap + 7 * dt); if (s.flash > 0) s.flash -= dt;
      var px = 210, pw = 28, ph = 80, py = GROUND - ph + s.y;
      s.obs.forEach(function (o) {
        o.x -= s.speed * dt;
        if (!o.hit && px + pw - 4 > o.x + 3 && px + 4 < o.x + o.w - 3 && py + ph > GROUND - o.h + 4) { o.hit = true; s.gap -= 55; s.flash = .35; }
        if (!o.pass && !o.hit && o.x + o.w < px) { o.pass = true; s.cleared++; ov.dataset.score = s.cleared; }
      });
      s.obs = s.obs.filter(function (o) { return o.x > -60 && !o.hit; });
      if (s.gap <= 0) { s.state = "lost"; ov.dataset.state = "lost"; title.textContent = "Он догнал тебя"; msg.textContent = "Нажми «Прыжок», чтобы попробовать ещё раз."; }
      else if (s.cleared >= GOAL) { s.state = "won"; ov.dataset.state = "won"; title.textContent = "Ты убежал!"; msg.innerHTML = "<b style=\"font-size:1.5em\">Позови преподавателя</b>"; var b = ov.querySelector("#egj"); b.textContent = "Закрыть"; }
    }
    function draw() {
      c.fillStyle = "#1a0206"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#2a0710"; for (var i = 0; i < 9; i++) c.fillRect((i * 97 + (s.state === "play" ? -T * 30 : 0)) % W + (i * 97 - T * 30 < 0 ? W : 0), 40 + (i % 3) * 28, 40, 8);
      c.fillStyle = "#5a0f1b"; c.fillRect(0, GROUND, W, H - GROUND); c.fillStyle = "#9a1a2b"; c.fillRect(0, GROUND, W, 4);
      if (s.state === "won") {
        skeleton(c, 330, GROUND - 23 * 6 + 2, 6, true, T); man(c, 220, GROUND - 10 * 6, 6, 2);
        c.fillStyle = "#ffe14d"; c.font = "bold 22px monospace"; c.fillText("♥", 300, GROUND - 120); return;
      }
      var sx = 210 - s.gap - 16 * U - 20; skeleton(c, sx, GROUND - 23 * U + 2, U, false, T);
      s.obs.forEach(function (o) {
        c.fillStyle = "#c9c1ac"; if (o.spike) { c.beginPath(); c.moveTo(o.x, GROUND); c.lineTo(o.x + o.w / 2, GROUND - o.h); c.lineTo(o.x + o.w, GROUND); c.fill(); }
        else { c.fillRect(o.x, GROUND - o.h, o.w, o.h); c.fillStyle = "#8a826e"; c.fillRect(o.x + 4, GROUND - o.h + 4, o.w - 8, 4); }
      });
      var py = GROUND - 14 * U + s.y; if (s.flash > 0 && Math.floor(s.flash * 20) % 2) c.globalAlpha = .4;
      man(c, 210, py, U, s.on ? s.f : 2); c.globalAlpha = 1;
      c.fillStyle = "#fff"; c.font = "bold 18px monospace"; c.fillText(s.cleared + " / " + GOAL, 14, 28);
      c.fillStyle = "#ff5a6a"; c.fillRect(14, 40, Math.max(0, s.gap), 8); c.strokeStyle = "#fff"; c.strokeRect(14, 40, 150, 8);
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
    ST = { win: function () { s.cleared = GOAL; }, state: function () { return s.state; }, close: close };
  }
  window.Egg = { start: start, _t: function () { return ST; } };
})();
