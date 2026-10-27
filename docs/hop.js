/* «Пикс-прыгун»: платформер с прокруткой в стиле игр 90-х. Свой герой (Пикс в наушниках), свои враги (баги) и блоки «{ }».
   Всё рисуется кодом, чужих персонажей и картинок нет.
   Hop.mount(хозяин, {onEnd}) -> {destroy}. Состояние в атрибутах корня: data-state, data-score, data-level (для автотестов). */
var Hop = (function () {
  var W = 320, H = 180, T = 16, ROWS = 11;
  var GROUND = 9; /* верхняя строка земли */

  /* ---------- уровни: собираем из кусочков, чтобы не ошибиться с выравниванием ---------- */
  function level(name, w, build) {
    var m = []; for (var y = 0; y < ROWS; y++) { m.push(new Array(w).fill(".")); }
    var ents = [], api = {
      ground: function (x0, x1) { for (var x = x0; x <= x1; x++) for (var y = GROUND; y < ROWS; y++) m[y][x] = "#"; },
      brick: function (x, y, n) { for (var i = 0; i < (n || 1); i++) m[y][x + i] = "="; },
      block: function (x, y) { m[y][x] = "?"; },
      coins: function (x, y, n) { for (var i = 0; i < (n || 1); i++) m[y][x + i] = "o"; },
      spike: function (x, y) { m[y][x] = "S"; },
      bug: function (x, y) { ents.push({ x: x * T, y: y * T + 4, w: 12, h: 12, vx: -28, dead: 0 }); },
      flag: function (x) { for (var y = GROUND - 5; y < GROUND; y++) m[y][x] = "|"; m[GROUND - 5][x] = "F"; }
    };
    build(api);
    return { name: name, w: w, map: m, ents: ents };
  }
  var LEVELS = [
    function () { return level("Привет, мир!", 70, function (a) {
      a.ground(0, 21); a.ground(25, 41); a.ground(45, 69);
      a.brick(11, 6, 3); a.block(14, 6); a.coins(11, 5, 4);
      a.coins(17, 7, 3); a.bug(19, 8);
      a.coins(33, 8, 2); a.brick(27, 6, 2); a.block(29, 6); a.bug(35, 8); a.bug(38, 8);
      a.brick(23, 6, 3); a.coins(23, 5, 3);
      a.coins(47, 8, 3); a.bug(52, 8); a.block(56, 6); a.brick(55, 6); a.brick(57, 6); a.coins(55, 5, 3);
      a.spike(60, 8); a.coins(59, 6, 3); a.bug(63, 8);
      a.flag(67);
    }); },
    function () { return level("Цикл for", 84, function (a) {
      a.ground(0, 14); a.ground(18, 30); a.ground(34, 46); a.ground(50, 62); a.ground(66, 83);
      a.brick(8, 6, 2); a.block(10, 6); a.coins(8, 5, 3);
      a.brick(15, 7, 2); a.coins(15, 6, 2); a.bug(22, 8); a.bug(26, 8);
      a.coins(31, 6, 2);
      a.spike(38, 8); a.spike(39, 8); a.coins(37, 6, 4); a.bug(42, 8);
      a.brick(47, 7, 2); a.brick(48, 4, 2); a.coins(48, 3, 2); a.bug(53, 8); a.bug(57, 8); a.block(55, 5);
      a.coins(63, 6, 2); a.bug(70, 8); a.bug(73, 8); a.spike(77, 8); a.coins(76, 6, 3);
      a.flag(80);
    }); },
    function () { return level("Рекурсия", 96, function (a) {
      a.ground(0, 9); a.ground(13, 22); a.ground(26, 33); a.ground(37, 48); a.ground(52, 60); a.ground(64, 74); a.ground(77, 95);
      a.brick(10, 7, 2); a.coins(10, 6, 2); a.brick(23, 7, 2); a.coins(23, 6, 2); a.brick(34, 7, 2); a.coins(34, 6, 2);
      a.bug(16, 8); a.bug(19, 8); a.block(28, 6); a.bug(30, 8);
      a.spike(42, 8); a.spike(43, 8); a.bug(40, 8); a.bug(46, 8); a.coins(41, 5, 4);
      a.coins(49, 5, 2); a.bug(55, 8); a.brick(57, 5, 2); a.coins(57, 4, 2);
      a.brick(61, 7, 2); a.coins(61, 6, 2); a.bug(67, 8); a.spike(71, 8); a.block(68, 5);
      a.bug(82, 8); a.bug(85, 8); a.bug(88, 8); a.coins(81, 5, 8);
      a.flag(92);
    }); }
  ];

  var PAL = { K: "#1a0f4d", S: "#ffd9a0", H: "#7a1a8a", B: "#3a1aa0", W: "#ffffff", Y: "#ffe44d", P: "#d03030", G: "#2a9a2a" };
  /* Пикс: фиолетовые наушники, жёлтая толстовка, смотрит вправо; 10×14 */
  var HERO = [
    "...HHHH...",
    "..HKKKKH..",
    ".HKSSSSKH.",
    ".HKSKSSKH.",
    "..KSSSSK..",
    "...KSSK...",
    "..KYYYYK..",
    ".KYYYYYYK.",
    ".KYYYYYYK.",
    ".KYYYYYYK.",
    "..KBBBBK..",
    "..KBBBBK..",
    "..KB..BK..",
    "..KK..KK.."
  ];
  var HERO_RUN = HERO.slice(0, 12).concat(["..KBB.BK..", "..KK..KKK."]);
  var cache = {};
  function hero(frame, flip, flash) {
    var k = frame + "|" + flip + "|" + flash; if (cache[k]) return cache[k];
    var c = document.createElement("canvas"); c.width = 10; c.height = 14; var g = c.getContext("2d"), rows = frame ? HERO_RUN : HERO;
    for (var y = 0; y < 14; y++) for (var x = 0; x < 10; x++) { var ch = rows[y].charAt(x); if (ch === ".") continue; g.fillStyle = flash ? "#ffffff" : PAL[ch]; g.fillRect(flip ? 9 - x : x, y, 1, 1); }
    cache[k] = c; return c;
  }
  var BUG = ["..K....K..", "...K..K...", "..KGGGGK..", ".KGGGGGGK.", "KGPWGGPWGK", "KGGGGGGGGK", ".KGKGGKGK.", "K.K....K.K"];
  var BUG2 = ["..K....K..", "...K..K...", "..KGGGGK..", ".KGGGGGGK.", "KGPWGGPWGK", "KGGGGGGGGK", ".KGKGGKGK.", ".K..K.K..K"];
  function bugSpr(f) { var k = "bug" + f; if (cache[k]) return cache[k]; var c = document.createElement("canvas"); c.width = 10; c.height = 8; var g = c.getContext("2d"), rows = f ? BUG2 : BUG;
    for (var y = 0; y < 8; y++) for (var x = 0; x < 10; x++) { var ch = rows[y].charAt(x); if (ch === ".") continue; g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } cache[k] = c; return c; }

  function best(v) { try { var o = +localStorage.getItem("best_hop") || 0; if (v != null && v > o) { localStorage.setItem("best_hop", v); o = v; } return o; } catch (e) { return v || 0; } }

  function mount(host, opt) {
    opt = opt || {};
    host.innerHTML = '<div class="gm-root" data-state="menu" data-score="0" data-level="0">' +
      '<div class="gm-screen"><canvas width="' + W + '" height="' + H + '" tabindex="0" aria-label="Игра «Пикс-прыгун»"></canvas><div class="gm-over" hidden></div></div>' +
      '<div class="gm-pad hoppad" aria-hidden="true"><button data-k="left">◀</button><button data-k="right">▶</button><span></span><button data-k="jump">▲</button></div></div>';
    var root = host.firstChild, cv = root.querySelector("canvas"), g = cv.getContext("2d"), over = root.querySelector(".gm-over");
    g.imageSmoothingEnabled = false;
    var keys = {}, pad = {}, raf = 0, last = 0, st = null, mode = "menu", paused = false;

    function load(n) {
      var L = LEVELS[n](); st = st || { score: 0, lives: 3, coins: 0, t: 0 };
      st.n = n; st.L = L; st.map = L.map; st.bugs = L.ents; st.cam = 0; st.fx = []; st.bumps = [];
      spawn(); st.lvlT = 0; root.setAttribute("data-level", n + 1);
    }
    function spawn() { var p = st.p = { x: 2 * T, y: (GROUND - 1) * T - 2, w: 8, h: 14, vx: 0, vy: 0, on: false, face: 1, coyote: 0, buf: 0, held: false, inv: 1.2, step: 0, flash: 0 }; st.cam = 0; }
    function tile(tx, ty) { if (tx < 0 || tx >= st.L.w) return "#"; if (ty < 0) return "."; if (ty >= ROWS) return "."; return st.map[ty][tx]; }
    function solid(c) { return c === "#" || c === "=" || c === "?" || c === "x"; }
    function fx(x, y, col, n) { for (var i = 0; i < n; i++) st.fx.push({ x: x, y: y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 90, life: 0.5 + Math.random() * 0.4, col: col }); }
    function die() {
      if (st.p.dead) return; st.p.dead = 1; st.lives--; fx(st.p.x + 4, st.p.y + 7, "#ffe44d", 10);
      if (st.lives <= 0) { mode = "dying"; setTimeout(function () { if (mode === "dying") end(false); }, 700); return; }
      mode = "dying"; setTimeout(function () { if (mode === "dying") { load(st.n); mode = "play"; } }, 700);
    }
    /* движение по осям отдельно: так нет «залипания» в углах */
    function moveX(e, dx) {
      e.x += dx; var l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 0.01) / T), t = Math.floor(e.y / T), b = Math.floor((e.y + e.h - 0.01) / T);
      for (var ty = t; ty <= b; ty++) {
        if (dx > 0 && solid(tile(r, ty))) { e.x = r * T - e.w; return true; }
        if (dx < 0 && solid(tile(l, ty))) { e.x = (l + 1) * T; return true; }
      }
      return false;
    }
    function moveY(e, dy, isP) {
      e.y += dy; var l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 0.01) / T), t = Math.floor(e.y / T), b = Math.floor((e.y + e.h - 0.01) / T);
      for (var tx = l; tx <= r; tx++) {
        if (dy > 0 && solid(tile(tx, b))) { e.y = b * T - e.h; e.vy = 0; e.on = true; return; }
        if (dy < 0 && solid(tile(tx, t))) { e.y = (t + 1) * T; e.vy = 0; if (isP) bump(tx, t); return; }
      }
      if (dy > 0) e.on = false;
    }
    function bump(tx, ty) {
      if (st.map[ty][tx] === "?") { st.map[ty][tx] = "x"; st.coins++; st.score += 50; st.bumps.push({ x: tx, y: ty, t: 0.2 }); fx(tx * T + 8, ty * T, "#ffe44d", 8); }
      else if (st.map[ty][tx] === "=") st.bumps.push({ x: tx, y: ty, t: 0.12 });
      /* баг, стоящий на блоке, подбрасывается */
      st.bugs.forEach(function (b) { if (!b.dead && Math.floor((b.y + b.h + 1) / T) === ty && Math.floor((b.x + 6) / T) === tx) { b.dead = 1; b.vy = -120; st.score += 100; } });
    }
    function update(dt) {
      st.t += dt; st.lvlT += dt; var p = st.p;
      if (mode === "dying") { p.vy += 700 * dt; p.y += p.vy * dt; st.fx.forEach(step(dt)); st.fx = st.fx.filter(alive); return; }
      var L = keys.left || pad.left, R = keys.right || pad.right, J = keys.jump || pad.jump, run = keys.run ? 1.45 : 1, max = 82 * run, acc = 560;
      if (L && !R) { p.vx = Math.max(-max, p.vx - acc * dt); p.face = -1; } else if (R && !L) { p.vx = Math.min(max, p.vx + acc * dt); p.face = 1; } else { var f = (p.on ? 700 : 150) * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
      if (p.on) p.coyote = 0.09; else p.coyote -= dt;
      if (J && !p.held) p.buf = 0.1; p.held = J; p.buf -= dt;
      if (p.buf > 0 && p.coyote > 0) { p.vy = -285; p.on = false; p.coyote = 0; p.buf = 0; }
      p.vy += (p.vy < 0 && !J ? 1500 : 720) * dt; if (p.vy > 330) p.vy = 330;
      p.on = false;
      moveX(p, p.vx * dt); moveY(p, p.vy * dt, true);
      if (p.vx && p.on) p.step += dt * Math.abs(p.vx) / 8;
      if (p.inv > 0) p.inv -= dt; if (p.flash > 0) p.flash -= dt;
      if (p.y > ROWS * T + 20) { die(); return; }
      /* монеты, шипы, флаг */
      var cx0 = Math.floor(p.x / T), cx1 = Math.floor((p.x + p.w - 0.01) / T), cy0 = Math.floor(p.y / T), cy1 = Math.floor((p.y + p.h - 0.01) / T);
      for (var ty = cy0; ty <= cy1; ty++) for (var tx = cx0; tx <= cx1; tx++) {
        var c = tile(tx, ty);
        if (c === "o") { st.map[ty][tx] = "."; st.coins++; st.score += 10; fx(tx * T + 8, ty * T + 8, "#ffe44d", 3); }
        else if (c === "S" && p.inv <= 0 && p.y + p.h > ty * T + 8) { die(); return; }
        else if (c === "F" || c === "|") { win(); return; }
      }
      /* баги */
      st.bugs.forEach(function (b) {
        if (b.dead) { b.vy = (b.vy || 0) + 700 * dt; b.y += b.vy * dt; return; }
        if (Math.abs(b.x - p.x) > 260) return;
        var hit = moveX(b, b.vx * dt); var ahead = tile(Math.floor((b.x + (b.vx > 0 ? b.w + 1 : -1)) / T), Math.floor((b.y + b.h + 2) / T));
        if (hit || !solid(ahead) && b.on) b.vx = -b.vx;
        b.vy = (b.vy || 0) + 700 * dt; b.on = false; moveY(b, b.vy * dt, false);
        if (p.x + p.w > b.x + 1 && p.x < b.x + b.w - 1 && p.y + p.h > b.y + 1 && p.y < b.y + b.h) {
          if (p.vy > 20 && p.y + p.h - b.y < 11) { b.dead = 2; b.vy = -140; p.vy = -170; st.score += 100; fx(b.x + 6, b.y + 4, "#2a9a2a", 6); }
          else if (p.inv <= 0) { die(); }
        }
      });
      st.bugs = st.bugs.filter(function (b) { return b.y < ROWS * T + 40; });
      st.bumps.forEach(function (b) { b.t -= dt; }); st.bumps = st.bumps.filter(function (b) { return b.t > 0; });
      st.fx.forEach(step(dt)); st.fx = st.fx.filter(alive);
      st.cam = Math.max(0, Math.min(st.L.w * T - W, p.x - W / 2 + 10));
      root.setAttribute("data-score", st.score);
    }
    function step(dt) { return function (f) { f.life -= dt; f.vy += 300 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }; }
    function alive(f) { return f.life > 0; }
    function win() {
      st.score += 200 + Math.max(0, Math.floor(100 - st.lvlT)) * 3;
      if (st.n + 1 < LEVELS.length) { load(st.n + 1); } else end(true);
    }
    function end(won) {
      mode = "over"; root.setAttribute("data-state", won ? "won" : "over"); var b = best(st.score);
      try { if (window.Net && Net.score && st.score > 0) Net.score("hop", st.score); } catch (e) {}
      over.hidden = false;
      over.innerHTML = '<div class="gm-card"><h3>' + (won ? "Деплой прошёл! Все уровни пройдены" : "Игра окончена") + '</h3><p>Очки: <b>' + st.score + '</b> · бит собрано: ' + st.coins + '</p><p class="m">Рекорд: ' + b + '</p><div class="btns"><button class="btn go" type="button" data-a="go">Ещё раз</button></div></div>';
      if (opt.onEnd) opt.onEnd(st.score);
    }
    /* ---------- рисование ---------- */
    function sky() {
      g.fillStyle = "#2f7777"; g.fillRect(0, 0, W, H);
      var off = -(st.cam * 0.3) % 160;
      for (var i = -1; i < 4; i++) { var x = Math.round(off + i * 160 + 30), y = 20 + (i & 1) * 26; g.fillStyle = "#1a0f4d"; g.fillRect(x, y, 44, 22); g.fillStyle = "#3a1aa0"; g.fillRect(x + 1, y + 1, 42, 4); g.fillStyle = "#c0c0c0"; g.fillRect(x + 1, y + 5, 42, 16); g.fillStyle = "#ffffff"; g.fillRect(x + 3, y + 8, 18, 1); g.fillRect(x + 3, y + 11, 26, 1); }
    }
    function drawTiles() {
      var x0 = Math.floor(st.cam / T), x1 = Math.min(st.L.w - 1, x0 + 21);
      for (var ty = 0; ty < ROWS; ty++) for (var tx = x0; tx <= x1; tx++) {
        var c = st.map[ty][tx]; if (c === ".") continue; var x = tx * T - Math.round(st.cam), y = ty * T;
        for (var i = 0; i < st.bumps.length; i++) if (st.bumps[i].x === tx && st.bumps[i].y === ty) y -= 4;
        if (c === "#") { g.fillStyle = "#3a1aa0"; g.fillRect(x, y, T, T); g.fillStyle = "#4a2ab0"; g.fillRect(x + 3, y + 7, 2, 2); g.fillRect(x + 10, y + 11, 2, 2); if (tile(tx, ty - 1) !== "#") { g.fillStyle = "#2a9a2a"; g.fillRect(x, y, T, 4); g.fillStyle = "#4aff6a"; g.fillRect(x, y, T, 1); } }
        else if (c === "=") { g.fillStyle = "#808080"; g.fillRect(x, y, T, T); g.fillStyle = "#c0c0c0"; g.fillRect(x + 1, y + 1, T - 2, T - 2); g.fillStyle = "#ffffff"; g.fillRect(x + 1, y + 1, T - 2, 1); g.fillRect(x + 1, y + 1, 1, T - 2); g.fillStyle = "#808080"; g.fillRect(x, y + 8, T, 1); g.fillRect(x + 8, y, 1, 8); }
        else if (c === "?" || c === "x") { g.fillStyle = "#1a0f4d"; g.fillRect(x, y, T, T); g.fillStyle = c === "?" ? "#ffe44d" : "#808080"; g.fillRect(x + 1, y + 1, T - 2, T - 2); g.fillStyle = c === "?" ? "#c9a000" : "#555566"; g.fillRect(x + 1, y + T - 3, T - 2, 2); g.fillStyle = "#1a0f4d"; if (c === "?") { g.fillRect(x + 4, y + 4, 2, 8); g.fillRect(x + 4, y + 4, 3, 1); g.fillRect(x + 4, y + 11, 3, 1); g.fillRect(x + 11, y + 4, 2, 8); g.fillRect(x + 9, y + 4, 3, 1); g.fillRect(x + 9, y + 11, 3, 1); } }
        else if (c === "o") { var wob = Math.abs(Math.sin(st.t * 5 + tx)); var w = 2 + Math.round(wob * 4); g.fillStyle = "#1a0f4d"; g.fillRect(x + 8 - w - 1, y + 3, w * 2 + 2, 10); g.fillStyle = "#ffe44d"; g.fillRect(x + 8 - w, y + 4, w * 2, 8); }
        else if (c === "S") { g.fillStyle = "#1a0f4d"; for (var k = 0; k < 4; k++) { g.fillRect(x + k * 4, y + 12 - (k % 2 ? 4 : 0), 4, 4 + (k % 2 ? 4 : 0)); } g.fillStyle = "#d8d8e8"; for (var k2 = 0; k2 < 4; k2++) g.fillRect(x + k2 * 4 + 1, y + 12 - (k2 % 2 ? 3 : 0), 2, 3 + (k2 % 2 ? 3 : 0)); }
        else if (c === "|") { g.fillStyle = "#1a0f4d"; g.fillRect(x + 6, y, 4, T); g.fillStyle = "#c0c0c0"; g.fillRect(x + 7, y, 2, T); }
        else if (c === "F") { g.fillStyle = "#1a0f4d"; g.fillRect(x + 6, y, 4, T); g.fillStyle = "#c0c0c0"; g.fillRect(x + 7, y, 2, T); g.fillStyle = "#1a0f4d"; g.fillRect(x + 9, y, 18, 12); g.fillStyle = "#2a9a2a"; g.fillRect(x + 10, y + 1, 16, 10); g.fillStyle = "#ffffff"; g.font = "6px 'Press Start 2P',monospace"; g.textBaseline = "top"; g.fillText("OK", x + 12, y + 3); }
      }
    }
    function txt(s, x, y, col, size, al) { g.font = (size || 8) + "px 'Press Start 2P',monospace"; g.textBaseline = "top"; g.textAlign = al || "left"; g.fillStyle = "#1a0f4d"; g.fillText(s, x + 1, y + 1); g.fillStyle = col || "#fff"; g.fillText(s, x, y); g.textAlign = "left"; }
    function draw() {
      sky(); drawTiles(); var cam = Math.round(st.cam);
      st.bugs.forEach(function (b) { var x = Math.round(b.x - cam) - 1, y = Math.round(b.y) + 4; if (b.dead === 2) { g.fillStyle = "#2a9a2a"; g.fillRect(x, y + 4, 12, 3); return; } g.save(); if (b.dead) { g.translate(x + 5, y + 4); g.scale(1, -1); g.drawImage(bugSpr(0), -5, -4); } else g.drawImage(bugSpr(Math.floor(st.t * 6) % 2), x, y); g.restore(); });
      var p = st.p;
      if (!(p.inv > 0 && Math.floor(p.inv * 12) % 2)) { var fr = !p.on ? 1 : (p.vx ? Math.floor(p.step) % 2 : 0); g.drawImage(hero(fr, p.face < 0, 0), Math.round(p.x) - 1 - cam, Math.round(p.y)); }
      st.fx.forEach(function (f) { g.globalAlpha = Math.min(1, f.life * 2); g.fillStyle = f.col; g.fillRect(Math.round(f.x - cam), Math.round(f.y), 2, 2); }); g.globalAlpha = 1;
      txt("ОЧКИ " + st.score, 6, 6, "#ffe44d", 8); txt("УР." + (st.n + 1) + " " + st.L.name, W / 2, 6, "#ffffff", 8, "center");
      for (var i = 0; i < 3; i++) { g.fillStyle = i < st.lives ? "#d03030" : "#1a0f4d"; g.fillRect(W - 40 + i * 12, 6, 8, 8); g.fillStyle = "#ffffff"; if (i < st.lives) g.fillRect(W - 39 + i * 12, 7, 2, 2); }
      if (st.lvlT < 2.2) txt(st.L.name, W / 2, 70, "#ffe44d", 12, "center");
      if (paused) { g.fillStyle = "rgba(26,15,77,.6)"; g.fillRect(0, 0, W, H); txt("ПАУЗА", W / 2, 76, "#ffffff", 12, "center"); }
    }
    function frame(ts) {
      raf = requestAnimationFrame(frame); var dt = Math.min(0.033, (ts - (last || ts)) / 1000); last = ts;
      if (!st) return; if ((mode === "play" || mode === "dying") && !paused && !document.hidden) update(dt); draw();
    }
    function start() { st = null; load(0); mode = "play"; paused = false; over.hidden = true; root.setAttribute("data-state", "play"); cv.focus(); }
    function menu() {
      over.hidden = false;
      over.innerHTML = '<div class="gm-card"><h3>Пикс-прыгун</h3><p class="m">Добеги до флажка «OK». Прыгай на головы багам, бей блоки «{ }» снизу, собирай биты, обходи шипы и ямы. Три уровня, три жизни.</p>' +
        '<p class="m gm-keys">← → или A D: бег, пробел ↑ W: прыжок (держи дольше — выше), Shift: ускорение, P: пауза</p>' +
        '<div class="btns"><button class="btn big go" type="button" data-a="go" id="hopGo">Играть</button></div><p class="m">Рекорд: ' + best() + '</p></div>';
    }
    over.addEventListener("click", function (e) { var b = e.target.closest("[data-a]"); if (b && b.dataset.a === "go") start(); });
    var MAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "jump", KeyW: "jump", Space: "jump", KeyZ: "jump", ShiftLeft: "run", ShiftRight: "run" };
    function kd(e) {
      if (!document.body.contains(root)) return; var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA") return;
      if (mode !== "play" && mode !== "dying") return;
      if (e.code === "KeyP" || e.code === "Escape") { paused = !paused; e.preventDefault(); return; }
      var k = MAP[e.code]; if (k) { keys[k] = true; e.preventDefault(); }
    }
    function ku(e) { var k = MAP[e.code]; if (k) keys[k] = false; }
    function blur() { keys = {}; pad = {}; }
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku); window.addEventListener("blur", blur);
    root.querySelectorAll(".gm-pad button").forEach(function (b) {
      var k = b.dataset.k;
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); pad[k] = true; try { b.setPointerCapture(e.pointerId); } catch (x) {} });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (ev) { b.addEventListener(ev, function () { pad[k] = false; }); });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
    load(0); draw(); menu();
    raf = requestAnimationFrame(frame);
    return {
      root: root, start: start,
      destroy: function () { cancelAnimationFrame(raf); document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); host.innerHTML = ""; },
      _state: function () { return st; }, _mode: function () { return mode; }
    };
  }
  return { mount: mount, LEVELS: LEVELS, best: function () { return best(); } };
})();
