/* «Пернатый бой»: аркада с цыплятами в стиле курса. Картинок и чужих ассетов нет: всё рисуется кодом.
   Chick.mount(хозяин, {onEnd}) -> {destroy}. Состояние видно в атрибутах корня: data-state, data-score, data-wave (для автотестов). */
var Chick = (function () {
  var W = 320, H = 180, GROUND = 164;
  var PAL = { K: "#1a0f4d", Y: "#ffe44d", O: "#f08a1c", W: "#ffffff", R: "#d03030", P: "#7a1a8a", B: "#3a1aa0", L: "#4aa3ff", G: "#c0c0c0", D: "#808080", N: "#2a9a2a", C: "#fffbdc", E: "#16060a", M: "#9a6a3a", S: "#555566" };
  /* цыплёнок смотрит вправо; X — цвет тела, Z — тень тела (крыло) */
  var BODY = [
    "....KKKK....",
    "...KXXXXK...",
    "...KXXEXKOO.",
    "...KXXXXKOOK",
    "....KXXXKKK.",
    "..KKXXXXXK..",
    ".KXXXXXXXXK.",
    ".KXZZZXXXXK.",
    ".KXXZZXXXXK.",
    "..KXXXXXXK..",
    "...KOK.KOK..",
    "...OO..OO..."
  ];
  var LEGS2 = ["...KOK..KOK.", "..OO....OO.."];
  var HATS = {
    none: { name: "Без шапки", rows: [] },
    cap: { name: "Кепка", rows: ["............", "....BBBB....", "...BBBBBBBB."] },
    crown: { name: "Корона", rows: ["...Y.Y.Y....", "...YYYYY....", "...YRYLY...."] },
    phones: { name: "Наушники", rows: ["....KKKK....", "...K....K...", "..PK....KP.."] },
    pixel: { name: "Пикс-очки", rows: ["............", "............", "...KKKKKKK.."] }
  };
  var COLORS = { yellow: ["Жёлтый", "#ffe44d", "#e0b800"], white: ["Белый", "#ffffff", "#c8c8d8"], brown: ["Рыжий", "#c07a3a", "#8a5222"], mint: ["Мятный", "#7fe0b0", "#3aa77a"] };
  var BOTS = [["#d8d8e8", "#9a9ab0", "bug"], ["#9a6a3a", "#6a4422", "helm"], ["#5a5a70", "#3a3a4a", "bug"], ["#e85a5a", "#a03030", "helm"]];
  var BOT_HATS = { bug: ["...R...R....", "....R.R.....", "............"], helm: ["............", "....SSSS....", "...SSSSSS..."] };
  var PLAT = [{ x: 30, y: 128, w: 76 }, { x: 214, y: 128, w: 76 }, { x: 122, y: 98, w: 76 }, { x: 8, y: 70, w: 60 }, { x: 252, y: 70, w: 60 }, { x: 128, y: 42, w: 64 }];
  var cache = {};
  function sprite(body, shade, hat, legs, flip, flash) {
    var key = [body, shade, hat, legs, flip, flash].join("|");
    if (cache[key]) return cache[key];
    var c = document.createElement("canvas"); c.width = 12; c.height = 15;
    var g = c.getContext("2d"), rows = BODY.slice(), hr = HATS[hat] ? HATS[hat].rows : (BOT_HATS[hat] || []);
    if (legs) { rows[10] = LEGS2[0]; rows[11] = LEGS2[1]; }
    function put(r, y) { for (var x = 0; x < 12; x++) { var ch = r.charAt(x); if (!ch || ch === ".") continue; var col = ch === "X" ? body : ch === "Z" ? shade : PAL[ch]; if (flash) col = "#ffffff"; g.fillStyle = col; g.fillRect(flip ? 11 - x : x, y, 1, 1); } }
    rows.forEach(function (r, y) { put(r, y + 3); });
    hr.forEach(function (r, y) { put(r, y + 1 + (hat === "pixel" ? 2 : 0)); });
    cache[key] = c; return c;
  }
  function look() { try { var v = JSON.parse(localStorage.getItem("chickLook") || "null"); if (v && COLORS[v.c] && HATS[v.h]) return v; } catch (e) {} return { c: "yellow", h: "cap" }; }
  function best(v) { try { var o = +localStorage.getItem("best_chick") || 0; if (v != null && v > o) { localStorage.setItem("best_chick", v); o = v; } return o; } catch (e) { return v || 0; } }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function E(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function mount(host, opt) {
    opt = opt || {};
    var me = look();
    host.innerHTML = '<div class="gm-root" data-state="menu" data-score="0" data-wave="0">' +
      '<div class="gm-screen"><canvas width="' + W + '" height="' + H + '" aria-label="Игра «Пернатый бой»"></canvas><div class="gm-over" hidden></div></div>' +
      '<div class="gm-pad" aria-hidden="true"><button data-k="left">◀</button><button data-k="right">▶</button><span></span><button data-k="jump">▲</button><button data-k="fire">🥚</button></div></div>';
    var root = host.firstChild, cv = root.querySelector("canvas"), g = cv.getContext("2d"), over = root.querySelector(".gm-over");
    g.imageSmoothingEnabled = false;
    var keys = {}, pad = {}, raf = 0, last = 0, st = null, paused = false, dead = false;

    function newChick(isP, wave) {
      var b = BOTS[Math.floor(Math.random() * BOTS.length)];
      return { p: isP, x: isP ? 152 : rnd(10, W - 22), y: isP ? GROUND - 12 : -16, vx: 0, vy: 0, w: 10, h: 12, face: 1, on: false, hp: isP ? 5 : (wave >= 4 ? 3 : 2), cd: isP ? 0 : rnd(0.8, 1.6),
        inv: 0, flash: 0, step: 0, think: 0, dir: 0, gun: isP ? null : null, ammo: 0, body: isP ? COLORS[me.c][1] : b[0], shade: isP ? COLORS[me.c][2] : b[1], hat: isP ? me.h : b[2], jumpHeld: false };
    }
    function reset() {
      st = { t: 0, score: 0, wave: 0, banner: 0, pl: newChick(true), bots: [], eggs: [], fx: [], items: [], toSpawn: 0, spawnT: 0, itemT: 8, combo: 0 };
      nextWave();
    }
    function nextWave() {
      st.wave++; st.toSpawn = Math.min(1 + st.wave, 9); st.spawnT = 1.2; st.banner = 2;
      root.setAttribute("data-wave", st.wave);
    }
    function shoot(c, aimY) {
      var spd = 210, gx = c.face > 0 ? c.x + c.w - 4 : c.x + 1, gy = c.y + 7; /* яйцо вылетает из клюва-ствола: попадает и в упор */
      function egg(vy) { st.eggs.push({ x: gx, y: gy, vx: spd * c.face, vy: vy, p: c.p, life: 1.6, gold: c.gun === "gold" }); }
      if (c.p && c.gun === "corn") { egg(-35); egg(0); egg(35); } else egg(aimY || 0);
      if (c.p && c.gun) { c.ammo--; if (c.ammo <= 0) c.gun = null; }
      c.cd = c.p ? (c.gun === "gold" ? 0.12 : 0.28) : rnd(1.0, 1.7) * Math.max(0.55, 1 - st.wave * 0.05);
      puff(gx + 2, gy + 1, "#ffffff", 2);
    }
    function puff(x, y, col, n) { for (var i = 0; i < n; i++) st.fx.push({ x: x, y: y, vx: rnd(-40, 40), vy: rnd(-60, 10), life: rnd(0.3, 0.7), col: col, f: false }); }
    function feathers(c) { for (var i = 0; i < 7; i++) st.fx.push({ x: c.x + 5, y: c.y + 6, vx: rnd(-50, 50), vy: rnd(-80, -10), life: rnd(0.6, 1.2), col: i % 2 ? c.body : "#ffffff", f: true }); }
    function physics(c, dt, wantJump, holdJump) {
      c.vy += (holdJump && c.vy > 0 ? 220 : 620) * dt; /* держишь прыжок: цыплёнок планирует */
      if (wantJump && c.on) { c.vy = -235; c.on = false; puff(c.x + 5, c.y + 12, "#c0c0c0", 3); }
      var oy = c.y; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.x < 0) c.x = 0; if (c.x > W - c.w) c.x = W - c.w;
      c.on = false;
      if (c.y + c.h >= GROUND) { c.y = GROUND - c.h; c.vy = 0; c.on = true; }
      else if (c.vy >= 0 && !c.drop) PLAT.forEach(function (p) { if (oy + c.h <= p.y + 1 && c.y + c.h >= p.y && c.x + c.w > p.x + 2 && c.x < p.x + p.w - 2) { c.y = p.y - c.h; c.vy = 0; c.on = true; } });
      if (c.drop) c.drop -= dt;
      if (c.drop < 0) c.drop = 0;
    }
    function hit(c, dmg) {
      if (c.p && c.inv > 0) return;
      c.hp -= dmg; c.flash = 0.12; feathers(c);
      if (c.p) { c.inv = 1.2; if (c.hp <= 0) gameOver(); }
    }
    function update(dt) {
      st.t += dt; var P = st.pl;
      if (st.banner > 0) st.banner -= dt;
      var L = keys.left || pad.left, R = keys.right || pad.right, J = keys.jump || pad.jump, F = keys.fire || pad.fire, D = keys.down;
      P.vx = (R ? 85 : 0) - (L ? 85 : 0); if (P.vx) { P.face = P.vx > 0 ? 1 : -1; P.step += dt; }
      if (D && P.on && P.y + P.h < GROUND) P.drop = 0.2;
      physics(P, dt, J && !P.jumpHeld, J); P.jumpHeld = J;
      P.cd -= dt; P.inv -= dt; P.flash -= dt;
      if (F && P.cd <= 0) shoot(P);
      /* появление ботов */
      if (st.toSpawn > 0) { st.spawnT -= dt; if (st.spawnT <= 0 && st.bots.length < 6) { st.bots.push(newChick(false, st.wave)); st.toSpawn--; st.spawnT = rnd(0.6, 1.4); } }
      else if (!st.bots.length) { st.score += 25 * st.wave; nextWave(); }
      st.bots.forEach(function (b) {
        b.think -= dt; b.cd -= dt; b.flash -= dt;
        var dx = P.x - b.x, dy = P.y - b.y;
        if (b.think <= 0) {
          b.think = rnd(0.25, 0.5);
          b.dir = Math.abs(dx) > 50 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.6 ? 1 : 0);
          b.wantJ = dy < -18 && Math.random() < 0.55;
          if (dy > 18 && b.on && b.y + b.h < GROUND && Math.random() < 0.5) b.drop = 0.25;
        }
        b.vx = b.dir * (48 + Math.min(st.wave, 8) * 4); if (b.vx) b.step += dt;
        b.face = Math.abs(dx) > 4 ? Math.sign(dx) : b.face;
        physics(b, dt, b.wantJ, false); b.wantJ = false;
        if (b.cd <= 0 && Math.abs(dy) < 14 && Math.abs(dx) < 230 && b.y > 0) shoot(b, Math.sign(dy) * 12);
        if (Math.abs(dx) < 9 && Math.abs(dy) < 10 && P.inv <= 0) { hit(P, 1); P.vx = 0; P.x += dx > 0 ? 10 : -10; P.vy = -120; b.dir = -Math.sign(dx) || 1; b.think = 0.6; } /* столкнулись: цыплёнка отбрасывает, бот отходит */
      });
      st.eggs.forEach(function (e) {
        e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
        var targets = e.p ? st.bots : [P];
        targets.forEach(function (c) { if (e.life > 0 && e.x + 3 > c.x && e.x < c.x + c.w && e.y + 4 > c.y && e.y < c.y + c.h) { e.life = 0; hit(c, e.gold ? 2 : 1); puff(e.x, e.y, "#fff59a", 4); } });
        PLAT.forEach(function (p) { if (e.life > 0 && e.x > p.x && e.x < p.x + p.w && e.y + 3 > p.y && e.y < p.y + 6) { e.life = 0; puff(e.x, e.y, "#fff59a", 3); } });
        if (e.x < -6 || e.x > W + 6 || e.y > GROUND) e.life = 0;
      });
      st.eggs = st.eggs.filter(function (e) { return e.life > 0; });
      st.bots = st.bots.filter(function (b) { if (b.hp > 0) return true; st.score += 10; puff(b.x + 5, b.y + 6, "#ffe44d", 6); if (Math.random() < 0.2) dropItem(b.x, b.y); return false; });
      /* бонусы: кукурузный дробовик, золотые яйца, сердце */
      st.itemT -= dt; if (st.itemT <= 0) { st.itemT = rnd(9, 14); var p = PLAT[Math.floor(Math.random() * PLAT.length)]; dropItem(p.x + rnd(8, p.w - 16), -10); }
      st.items.forEach(function (it) {
        it.life -= dt; it.vy += 400 * dt; var oy = it.y; it.y += it.vy * dt;
        if (it.y + 8 >= GROUND) { it.y = GROUND - 8; it.vy = 0; }
        PLAT.forEach(function (p) { if (it.vy >= 0 && oy + 8 <= p.y + 1 && it.y + 8 >= p.y && it.x + 8 > p.x && it.x < p.x + p.w) { it.y = p.y - 8; it.vy = 0; } });
        if (it.x + 8 > P.x && it.x < P.x + P.w && it.y + 8 > P.y && it.y < P.y + P.h) {
          it.life = 0;
          if (it.k === "heart") P.hp = Math.min(5, P.hp + 1); else { P.gun = it.k; P.ammo = it.k === "corn" ? 12 : 20; }
          puff(it.x + 4, it.y + 4, "#ffffff", 6);
        }
      });
      st.items = st.items.filter(function (it) { return it.life > 0; });
      st.fx.forEach(function (f) { f.life -= dt; f.vy += (f.f ? 90 : 300) * dt; f.x += f.vx * dt * (f.f ? 0.6 : 1); f.y += f.vy * dt; });
      st.fx = st.fx.filter(function (f) { return f.life > 0; });
      root.setAttribute("data-score", st.score);
    }
    function dropItem(x, y) { var r = Math.random(); st.items.push({ x: x, y: y, vy: 0, life: 12, k: r < 0.4 ? "corn" : r < 0.75 ? "gold" : "heart" }); }

    /* ---------- рисование ---------- */
    function bg() {
      g.fillStyle = "#2f7777"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#3a8888"; for (var y = 4; y < GROUND; y += 12) for (var x = (y / 12 % 2) * 6 + 2; x < W; x += 12) g.fillRect(x, y, 1, 1);
      /* ярлыки «рабочего стола» вдали */
      [[278, 12], [278, 40]].forEach(function (p) { g.fillStyle = "#4a9a9a"; g.fillRect(p[0], p[1], 14, 12); g.fillRect(p[0] + 3, p[1] + 14, 8, 2); });
      PLAT.forEach(function (p) {
        g.fillStyle = "#1a0f4d"; g.fillRect(p.x - 1, p.y - 1, p.w + 2, 9);
        g.fillStyle = "#3a1aa0"; g.fillRect(p.x, p.y, p.w, 4);
        g.fillStyle = "#c0c0c0"; g.fillRect(p.x, p.y + 4, p.w, 3);
        g.fillStyle = "#ffffff"; g.fillRect(p.x + 2, p.y + 1, Math.min(18, p.w - 16), 1);
        for (var i = 0; i < 3; i++) { g.fillStyle = "#c0c0c0"; g.fillRect(p.x + p.w - 12 + i * 4, p.y + 1, 3, 2); }
      });
      /* земля — панель задач */
      g.fillStyle = "#c0c0c0"; g.fillRect(0, GROUND, W, H - GROUND); g.fillStyle = "#ffffff"; g.fillRect(0, GROUND, W, 1);
      g.fillStyle = "#808080"; g.fillRect(1, GROUND + 3, 36, 12); g.fillStyle = "#e8e8e8"; g.fillRect(1, GROUND + 3, 35, 11);
      g.fillStyle = "#1a0f4d"; g.font = "8px 'Press Start 2P',monospace"; g.textBaseline = "top"; g.fillText("ПУСК", 3, GROUND + 5);
      g.fillStyle = "#808080"; g.fillRect(W - 44, GROUND + 3, 41, 11); g.fillStyle = "#d8d8d8"; g.fillRect(W - 43, GROUND + 4, 40, 9);
    }
    function drawChick(c) {
      if (c.p && c.inv > 0 && Math.floor(c.inv * 12) % 2) return;
      var legs = c.vx && c.on && Math.floor(c.step * 10) % 2, s = sprite(c.body, c.shade, c.hat, legs, c.face < 0, c.flash > 0);
      var x = Math.round(c.x) - 1, y = Math.round(c.y) - 3;
      g.drawImage(s, x, y);
      /* яйцемёт */
      g.fillStyle = c.p && c.gun === "gold" ? "#ffe44d" : c.p && c.gun === "corn" ? "#f08a1c" : "#808080";
      if (c.face > 0) { g.fillRect(x + 7, y + 10, 7, 2); g.fillStyle = "#1a0f4d"; g.fillRect(x + 13, y + 10, 1, 2); }
      else { g.fillRect(x - 2, y + 10, 7, 2); g.fillStyle = "#1a0f4d"; g.fillRect(x - 2, y + 10, 1, 2); }
      if (!c.on && c.vy > 0 && c.p && (keys.jump || pad.jump)) { g.fillStyle = "#ffffff"; g.fillRect(x - 2, y + 9, 2, 1); g.fillRect(x + 12, y + 9, 2, 1); }
    }
    function hearts(n) { for (var i = 0; i < 5; i++) { g.fillStyle = i < n ? "#d03030" : "#1a0f4d"; var x = 6 + i * 11, y = 6; g.fillRect(x, y + 1, 3, 3); g.fillRect(x + 4, y + 1, 3, 3); g.fillRect(x + 1, y + 4, 5, 2); g.fillRect(x + 2, y + 6, 3, 1); g.fillRect(x + 3, y + 7, 1, 1); g.fillRect(x + 3, y + 2, 1, 2); } }
    function txt(s, x, y, col, size, al) { g.font = (size || 8) + "px 'Press Start 2P',monospace"; g.textBaseline = "top"; g.textAlign = al || "left"; g.fillStyle = "#1a0f4d"; g.fillText(s, x + 1, y + 1); g.fillStyle = col || "#ffffff"; g.fillText(s, x, y); g.textAlign = "left"; }
    function draw() {
      bg();
      st.items.forEach(function (it) {
        var x = Math.round(it.x), y = Math.round(it.y), bl = it.life < 3 && Math.floor(it.life * 8) % 2; if (bl) return;
        g.fillStyle = "#1a0f4d"; g.fillRect(x - 1, y - 1, 10, 10); g.fillStyle = it.k === "heart" ? "#ffd9e2" : it.k === "corn" ? "#fff59a" : "#ffe44d"; g.fillRect(x, y, 8, 8);
        g.fillStyle = it.k === "heart" ? "#d03030" : it.k === "corn" ? "#f08a1c" : "#c9a000";
        if (it.k === "heart") { g.fillRect(x + 1, y + 2, 2, 2); g.fillRect(x + 5, y + 2, 2, 2); g.fillRect(x + 2, y + 4, 4, 2); } else if (it.k === "corn") { g.fillRect(x + 3, y + 1, 2, 6); g.fillRect(x + 2, y + 2, 1, 4); g.fillRect(x + 5, y + 2, 1, 4); } else { g.fillRect(x + 2, y + 2, 4, 5); g.fillStyle = "#ffffff"; g.fillRect(x + 3, y + 3, 1, 1); }
      });
      st.bots.forEach(drawChick); drawChick(st.pl);
      st.eggs.forEach(function (e) { var x = Math.round(e.x), y = Math.round(e.y); g.fillStyle = "#1a0f4d"; g.fillRect(x - 1, y - 1, 5, 6); g.fillStyle = e.gold ? "#ffe44d" : e.p ? "#ffffff" : "#ffd9e2"; g.fillRect(x, y, 3, 4); });
      st.fx.forEach(function (f) { g.globalAlpha = Math.min(1, f.life * 2); g.fillStyle = f.col; g.fillRect(Math.round(f.x), Math.round(f.y), f.f ? 2 : 1, f.f ? 1 : 1); });
      g.globalAlpha = 1;
      hearts(st.pl.hp);
      txt(String(st.score), W - 6, 6, "#ffe44d", 8, "right");
      txt("ВОЛНА " + st.wave, W / 2, 6, "#ffffff", 8, "center");
      if (st.pl.gun) txt((st.pl.gun === "corn" ? "ДРОБЬ " : "ЗОЛОТО ") + st.pl.ammo, 6, 18, "#fff59a", 8);
      if (st.banner > 0 && Math.floor(st.banner * 4) % 2 === 0) txt("ВОЛНА " + st.wave, W / 2, 70, "#ffe44d", 12, "center");
      if (paused) { g.fillStyle = "rgba(26,15,77,.6)"; g.fillRect(0, 0, W, H); txt("ПАУЗА", W / 2, 76, "#ffffff", 12, "center"); txt("P или Esc: дальше", W / 2, 96, "#ffffff", 8, "center"); }
    }
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.033, (ts - (last || ts)) / 1000); last = ts;
      if (!st || dead) return;
      if (!paused && !document.hidden) update(dt);
      if (st) draw();
    }
    function gameOver() {
      dead = true; draw(); root.setAttribute("data-state", "over");
      var b = best(st.score);
      try { if (window.Net && Net.score && st.score > 0) Net.score("chick", st.score); } catch (e) {}
      over.hidden = false;
      over.innerHTML = '<div class="gm-card"><h3>Тебя ощипали!</h3><p>Очки: <b>' + st.score + '</b> · волна ' + st.wave + '</p><p class="m">Рекорд: ' + b + '</p><div class="btns"><button class="btn go" type="button" data-a="again">Ещё раз</button><button class="btn ghost" type="button" data-a="menu">Сменить образ</button></div></div>';
      if (opt.onEnd) opt.onEnd(st.score);
    }
    function start() { me = look(); over.hidden = true; dead = false; paused = false; reset(); root.setAttribute("data-state", "play"); cv.focus && cv.focus(); }
    function menu() {
      root.setAttribute("data-state", "menu"); dead = true; me = look();
      var prev = function (c, h) { var s = sprite(COLORS[c][1], COLORS[c][2], h, 0, false, false); return '<img alt="" src="' + bigUrl(s) + '" width="48" height="60">'; };
      over.hidden = false;
      over.innerHTML = '<div class="gm-card"><h3>Пернатый бой</h3><p class="m">Отбивайся яйцами от ботов-цыплят. Держи прыжок, чтобы планировать. Бонусы: кукуруза (дробь), золотые яйца, сердце.</p>' +
        '<div class="gm-prev">' + prev(me.c, me.h) + '</div>' +
        '<div class="gm-row"><span>Цвет:</span>' + Object.keys(COLORS).map(function (k) { return '<button type="button" class="btn sm' + (me.c === k ? " go" : " ghost") + '" data-c="' + k + '">' + E(COLORS[k][0]) + '</button>'; }).join("") + '</div>' +
        '<div class="gm-row"><span>Шапка:</span>' + Object.keys(HATS).map(function (k) { return '<button type="button" class="btn sm' + (me.h === k ? " go" : " ghost") + '" data-h="' + k + '">' + E(HATS[k].name) + '</button>'; }).join("") + '</div>' +
        '<p class="m gm-keys">Клавиши: ← → или A D, прыжок ↑ W или пробел, вниз с площадки ↓ S, яйцо X J или Enter, пауза P</p>' +
        '<div class="btns"><button class="btn big go" type="button" data-a="again" id="chGo">В бой!</button></div><p class="m">Рекорд: ' + best() + '</p></div>';
    }
    function bigUrl(s) { var c = document.createElement("canvas"); c.width = 48; c.height = 60; var x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, 48, 60); return c.toDataURL(); }
    over.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.c || b.dataset.h) { var v = look(); if (b.dataset.c) v.c = b.dataset.c; if (b.dataset.h) v.h = b.dataset.h; try { localStorage.setItem("chickLook", JSON.stringify(v)); } catch (x) {} menu(); return; }
      if (b.dataset.a === "again") start(); else if (b.dataset.a === "menu") menu();
    });
    var MAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "jump", KeyW: "jump", Space: "jump", ArrowDown: "down", KeyS: "down", KeyX: "fire", KeyJ: "fire", KeyK: "fire", Enter: "fire", KeyF: "fire" };
    function kd(e) {
      if (!document.body.contains(root)) return;
      var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA") return;
      var k = MAP[e.code];
      if ((e.code === "KeyP" || e.code === "Escape") && root.getAttribute("data-state") === "play") { paused = !paused; e.preventDefault(); return; }
      if (k && root.getAttribute("data-state") === "play") { keys[k] = true; e.preventDefault(); if (k === "fire" && !e.repeat && !paused && st.pl.cd <= 0) shoot(st.pl); }
    }
    function ku(e) { var k = MAP[e.code]; if (k) keys[k] = false; }
    function blur() { keys = {}; pad = {}; }
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku); window.addEventListener("blur", blur);
    Array.prototype.forEach.call(root.querySelectorAll(".gm-pad button"), function (b) {
      var k = b.dataset.k;
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); pad[k] = true; try { b.setPointerCapture(e.pointerId); } catch (x) {} });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (ev) { b.addEventListener(ev, function () { pad[k] = false; }); });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
    reset(); draw(); menu();
    raf = requestAnimationFrame(frame);
    return {
      root: root, start: start,
      destroy: function () { cancelAnimationFrame(raf); document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); host.innerHTML = ""; },
      /* для автотестов: прямой доступ к состоянию */
      _state: function () { return st; }
    };
  }
  return { mount: mount, best: function () { return best(); } };
})();
