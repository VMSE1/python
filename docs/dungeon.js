/* «Подземелье багов»: шутер от первого лица на рейкастинге (как в старых играх 90-х), всё своё: текстуры, баги и оружие рисуются кодом.
   Двери-терминалы открываются правильным ответом на вопрос по твоему предмету.
   Dungeon.mount(хозяин, {questions, onEnd}) -> {destroy}. Состояние в атрибутах корня: data-state, data-score, data-level. */
var Dungeon = (function () {
  var W = 320, VH = 156, H = 180, FOV = 0.66, TS = 16;
  /* карты: # кирпич, T плитка, S серверная стойка, O окно, D дверь-терминал, E выход, P старт, b жук, r красный жук (плюётся), c кофе */
  var LEVELS = [
    { name: "Подвал школы", map: [
      "################",
      "#P..#.....c....#",
      "#...#..b...###.#",
      "#...D......#...#",
      "#####..TTTT#.b.#",
      "#c..#..T..T#...#",
      "#...#..T..T##D##",
      "#.b.......T#...#",
      "#...#TTTT.T#.E.#",
      "################"] },
    { name: "Серверная", map: [
      "SSSSSSSSSSSSSSSS",
      "SP.....S...r...S",
      "S.SSS..S.......S",
      "S.S.c..D..SS.b.S",
      "S.S.SSSS..SS...S",
      "S...b.....c..r.S",
      "SSSSSS.SSSSSSDSS",
      "Sc..b......S...S",
      "S.....r....D.E.S",
      "SSSSSSSSSSSSSSSS"] },
    { name: "Гнездо багов", map: [
      "OOOOOOOOOOOOOOOOOO",
      "OP...#....r.....cO",
      "O....#.###...##..O",
      "O.b..D.#c#.b.##..O",
      "O....#.#.#.......O",
      "O#D###.#.#####D###",
      "O...r..........b.O",
      "O.##.##.r.##.##..O",
      "Oc...b.......b..EO",
      "OOOOOOOOOOOOOOOOOO"] }
  ];
  /* ---------- текстуры 16×16 ---------- */
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function tex(fn) { var a = []; for (var y = 0; y < TS; y++) for (var x = 0; x < TS; x++) a.push(rgb(fn(x, y))); return a; }
  var TEX = {
    "#": tex(function (x, y) { var row = y >> 2, off = row % 2 ? 4 : 0; if (y % 4 === 3 || (x + off) % 8 === 7) return "#1a0f4d"; return (x + y * 3) % 7 === 0 ? "#4a2ab0" : "#3a1aa0"; }),
    "T": tex(function (x, y) { if (x % 8 === 0 || y % 8 === 0) return "#1f5555"; return (x + y) % 5 === 0 ? "#3a8888" : "#2f7777"; }),
    "S": tex(function (x, y) { if (x === 0 || x === 15) return "#55546a"; if (y % 4 === 0) return "#0f0f2b"; if (x > 10 && x < 13 && y % 4 === 2) return y % 8 === 2 ? "#4aff6a" : "#ff4a4a"; return x < 9 && y % 4 === 2 ? "#3a3a55" : "#1d1d38"; }),
    "O": tex(function (x, y) { if (x === 0 || y === 0) return "#ffffff"; if (x === 15 || y === 15) return "#808080"; if (y < 4) return x > 11 ? "#c0c0c0" : "#3a1aa0"; if (y > 5 && y < 14 && x > 2 && x < 13) return (x + y) % 6 === 0 ? "#d4e6ff" : "#ffffff"; return "#c0c0c0"; }),
    "D": tex(function (x, y) { if (x === 0 || x === 15 || y === 0 || y === 15) return "#1a0f4d"; var q = ["................", "................", "................", ".....KKKKKK.....", "....KK....KK....", "....KK....KK....", "..........KK....", ".........KK.....", "........KK......", ".......KK.......", ".......KK.......", "................", ".......KK.......", ".......KK.......", "................", "................"]; return q[y].charAt(x) === "K" ? "#1a0f4d" : (y > 1 && y < 14 ? "#ffe44d" : "#c9a000"); }),
    "E": tex(function (x, y) { if (x === 0 || x === 15 || y === 0 || y === 15) return "#0d4a1a"; var a = ["................", "................", "................", "................", ".........K......", ".........KK.....", "..KKKKKKKKKK....", "..KKKKKKKKKKK...", "..KKKKKKKKKKK...", "..KKKKKKKKKK....", ".........KK.....", ".........K......", "................", "................", "................", "................"]; return a[y].charAt(x) === "K" ? "#ffffff" : "#1b7a2e"; })
  };
  /* спрайты: жуки, кофе, плевок; "." — прозрачно */
  var SPR = {
    bug: [["................", "................", "...K........K...", "....K......K....", ".....KNNNNK.....", "....KNNNNNNK....", "...KNRRNNRRNK...", "...KNRWNNWRNK...", "K..KNNNNNNNNK..K", ".KKKNNNNNNNNKKK.", "...KNNKNNKNNK...", "..KKNNNNNNNNKK..", ".K..KNNNNNNK..K.", "K....KNNNNK....K", "......KKKK......", "................"],
          ["................", "................", "...K........K...", "....K......K....", ".....KNNNNK.....", "....KNNNNNNK....", "...KNRRNNRRNK...", "...KNRWNNWRNK...", "...KNNNNNNNNK...", "KKKKNNNNNNNNKKKK", "...KNNKNNKNNK...", "...KNNNNNNNNK...", "..KKKNNNNNNKKK..", ".K...KNNNNK...K.", "......KKKK......", "................"]],
    red: [["................", "...K........K...", "....K......K....", ".....KRRRRK.....", "....KRRRRRRK....", "...KRYYRRYYRK...", "...KRYKRRKYRK...", "K..KRRRRRRRRK..K", ".KKKRRKKKKRRKKK.", "...KRRKWWKRRK...", "..KKRRRKKRRRKK..", ".K..KRRRRRRK..K.", "K....KRRRRK....K", "......KKKK......", "................", "................"],
          ["................", "...K........K...", "....K......K....", ".....KRRRRK.....", "....KRRRRRRK....", "...KRYYRRYYRK...", "...KRYKRRKYRK...", "...KRRRRRRRRK...", "KKKKRRKKKKRRKKKK", "...KRRKWWKRRK...", "...KRRRKKRRRK...", "..KKKRRRRRRKKK..", ".K...KRRRRK...K.", "......KKKK......", "................", "................"]],
    coffee: [["................", "................", "................", "......W.W.......", ".......W.W......", "................", "....KKKKKKKK....", "....KWWWWWWKKK..", "....KWMMMMWK.K..", "....KWWWWWWK.K..", "....KWWBBWWKKK..", "....KWWWWWWK....", ".....KWWWWK.....", "....KKKKKKKK....", "................", "................"]],
    spit: [["................", "................", "................", "................", "................", "......YYYY......", ".....YYRRYY.....", ".....YRRRRY.....", ".....YRRRRY.....", ".....YYRRYY.....", "......YYYY......", "................", "................", "................", "................", "................"]],
    dead: [["................", "................", "................", "................", "................", "................", "................", "................", "................", "................", "................", "....N..N..N.....", "...KNNKNNKNNK...", "..KNNNNNNNNNNK..", ".K.KKKKKKKKKK.K.", "................"]]
  };
  var SP = { K: "#1a0f4d", N: "#2a9a2a", R: "#d03030", W: "#ffffff", Y: "#ffe44d", M: "#6a3a1a", B: "#3a1aa0" };
  var SPRT = {};
  Object.keys(SPR).forEach(function (k) { SPRT[k] = SPR[k].map(function (m) { var a = []; for (var y = 0; y < TS; y++) for (var x = 0; x < TS; x++) { var c = m[y].charAt(x); a.push(c === "." ? null : rgb(SP[c])); } return a; }); });

  function best(v) { try { var o = +localStorage.getItem("best_dungeon") || 0; if (v != null && v > o) { localStorage.setItem("best_dungeon", v); o = v; } return o; } catch (e) { return v || 0; } }
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function mount(host, opt) {
    opt = opt || {};
    var QS = (opt.questions || []).filter(function (q) { return q && q.q && q.o && q.o.length > 1; });
    host.innerHTML = '<div class="gm-root dg" data-state="menu" data-score="0" data-level="0">' +
      '<div class="gm-screen"><canvas width="' + W + '" height="' + H + '" tabindex="0" aria-label="Игра «Подземелье багов»"></canvas><div class="gm-over" hidden></div></div>' +
      '<div class="gm-pad dgpad" aria-hidden="true"><button data-k="tl">⟲</button><button data-k="up">▲</button><button data-k="tr">⟳</button><button data-k="fire">⚡</button><button data-k="sl">◀</button><button data-k="down">▼</button><button data-k="sr">▶</button><button data-k="use">E</button></div></div>';
    var root = host.firstChild, cv = root.querySelector("canvas"), g = cv.getContext("2d"), over = root.querySelector(".gm-over");
    var img = g.createImageData(W, VH), buf = img.data, zb = new Float32Array(W);
    var keys = {}, pad = {}, raf = 0, last = 0, st = null, mode = "menu", mouseDX = 0, qi = Math.floor(Math.random() * 1000);

    function load(n) {
      var L = LEVELS[n], map = L.map.map(function (r) { return r.split(""); }), ents = [], px = 1.5, py = 1.5;
      map.forEach(function (row, y) { row.forEach(function (c, x) {
        if (c === "P") { px = x + 0.5; py = y + 0.5; row[x] = "."; }
        else if (c === "b" || c === "r") { ents.push({ k: c === "b" ? "bug" : "red", x: x + 0.5, y: y + 0.5, hp: c === "b" ? 2 : 3, cd: 1, flash: 0, alert: false, anim: Math.random() * 2 }); row[x] = "."; }
        else if (c === "c") { ents.push({ k: "coffee", x: x + 0.5, y: y + 0.5 }); row[x] = "."; }
      }); });
      /* смотрим в сторону свободной клетки */
      var dir = [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(function (d) { return map[Math.floor(py + d[1])][Math.floor(px + d[0])] === "."; })[0] || [1, 0];
      st = st || { score: 0, hp: 100, t: 0 };
      st.n = n; st.map = map; st.ents = ents; st.shots = []; st.x = px; st.y = py; st.dx = dir[0]; st.dy = dir[1]; st.plx = -dir[1] * FOV; st.ply = dir[0] * FOV;
      st.cd = 0; st.flash = 0; st.hurt = 0; st.bob = 0; st.msg = L.name; st.msgT = 2.5; st.total = ents.filter(function (e) { return e.hp; }).length; st.kills = 0;
      root.setAttribute("data-level", n + 1);
    }
    function cell(x, y) { var r = st.map[Math.floor(y)]; return r ? (r[Math.floor(x)] || "#") : "#"; }
    function free(x, y) { return cell(x, y) === "."; }
    function move(e, nx, ny, r) {
      if (free(nx + Math.sign(nx - e.x) * r, e.y) && free(nx, e.y + r) && free(nx, e.y - r)) e.x = nx;
      if (free(e.x, ny + Math.sign(ny - e.y) * r) && free(e.x + r, ny) && free(e.x - r, ny)) e.y = ny;
    }
    function rot(a) { var dx = st.dx, px = st.plx; st.dx = dx * Math.cos(a) - st.dy * Math.sin(a); st.dy = dx * Math.sin(a) + st.dy * Math.cos(a); st.plx = px * Math.cos(a) - st.ply * Math.sin(a); st.ply = px * Math.sin(a) + st.ply * Math.cos(a); }
    /* видно ли точку b из точки a (шаги по лучу) */
    function sees(ax, ay, bx, by) { var d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 6); for (var i = 1; i < n; i++) { var t = i / n; if (!free(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; } return true; }
    function facing() { var c = cell(st.x + st.dx * 0.9, st.y + st.dy * 0.9); return { c: c, x: Math.floor(st.x + st.dx * 0.9), y: Math.floor(st.y + st.dy * 0.9) }; }
    function fire() {
      st.cd = 0.32; st.flash = 0.08;
      var tgt = null, bd = 99;
      st.ents.forEach(function (e) {
        if (!e.hp || e.hp <= 0) return;
        var vx = e.x - st.x, vy = e.y - st.y, d = Math.hypot(vx, vy), dot = (vx * st.dx + vy * st.dy) / d / Math.hypot(st.dx, st.dy);
        var ang = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (dot > 0 && ang < Math.atan(0.38 / d) + 0.03 && d < bd && sees(st.x, st.y, e.x, e.y)) { tgt = e; bd = d; }
      });
      if (tgt) { tgt.hp--; tgt.flash = 0.15; tgt.alert = true; if (tgt.hp <= 0) { st.score += tgt.k === "red" ? 150 : 100; tgt.k = "dead"; st.kills++; } }
    }
    function use() {
      var f = facing();
      if (f.c === "D") ask(f.x, f.y);
      else if (f.c === "E") win();
    }
    function hurt(n) { st.hp -= n; st.hurt = 0.3; if (st.hp <= 0) { st.hp = 0; end(false); } }
    function update(dt) {
      st.t += dt; st.cd -= dt; st.flash -= dt; st.hurt -= dt; st.msgT -= dt;
      var sp = (keys.run ? 3.6 : 2.6) * dt, mv = 0, sd = 0;
      if (keys.up || pad.up) mv += 1; if (keys.down || pad.down) mv -= 1;
      if (keys.sl || pad.sl) sd -= 1; if (keys.sr || pad.sr) sd += 1;
      var turn = ((keys.tr || pad.tr) ? 1 : 0) - ((keys.tl || pad.tl) ? 1 : 0);
      if (turn) rot(turn * 2.4 * dt);
      if (mouseDX) { rot(mouseDX * 0.0035); mouseDX = 0; }
      if (mv || sd) {
        var len = Math.hypot(st.dx, st.dy), fx = st.dx / len, fy = st.dy / len;
        move(st, st.x + (fx * mv - fy * sd) * sp, st.y + (fy * mv + fx * sd) * sp, 0.22); st.bob += dt * 9;
      }
      if ((keys.fire || pad.fire) && st.cd <= 0) fire();
      st.ents.forEach(function (e) {
        if (e.k === "coffee") { if (Math.hypot(e.x - st.x, e.y - st.y) < 0.5 && st.hp < 100) { st.hp = Math.min(100, st.hp + 25); e.k = "gone"; st.msg = "Кофе: +25"; st.msgT = 1.2; } return; }
        if (!(e.hp > 0)) return;
        e.anim += dt; e.cd -= dt; e.flash -= dt;
        var d = Math.hypot(st.x - e.x, st.y - e.y);
        if (!e.alert && d < 8 && sees(e.x, e.y, st.x, st.y)) e.alert = true;
        if (!e.alert) return;
        var spd = (e.k === "red" ? 0.8 : 1.35) * dt;
        if (d > (e.k === "red" ? 3 : 0.6)) move(e, e.x + (st.x - e.x) / d * spd, e.y + (st.y - e.y) / d * spd, 0.25);
        if (e.k === "bug" && d < 0.75 && e.cd <= 0) { e.cd = 0.9; hurt(12); }
        if (e.k === "red" && d < 9 && e.cd <= 0 && sees(e.x, e.y, st.x, st.y)) { e.cd = 1.8; st.shots.push({ x: e.x, y: e.y, vx: (st.x - e.x) / d * 3.2, vy: (st.y - e.y) / d * 3.2, life: 4 }); }
      });
      st.shots.forEach(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (!free(s.x, s.y)) s.life = 0; if (Math.hypot(s.x - st.x, s.y - st.y) < 0.3) { s.life = 0; hurt(10); } });
      st.shots = st.shots.filter(function (s) { return s.life > 0; });
      st.ents = st.ents.filter(function (e) { return e.k !== "gone"; });
      root.setAttribute("data-score", st.score);
    }
    /* ---------- рендер ---------- */
    function px(i, c, f) { buf[i] = c[0] * f; buf[i + 1] = c[1] * f; buf[i + 2] = c[2] * f; buf[i + 3] = 255; }
    function render() {
      var half = VH / 2, x, y;
      /* пол и потолок: шахматка, темнее вдали */
      var rx0 = st.dx - st.plx, ry0 = st.dy - st.ply, rx1 = st.dx + st.plx, ry1 = st.dy + st.ply;
      for (y = Math.floor(half) + 1; y < VH; y++) {
        var p = y - half, rd = half / p, sx = rd * (rx1 - rx0) / W, sy = rd * (ry1 - ry0) / W, fx = st.x + rd * rx0, fy = st.y + rd * ry0, sh = Math.max(0.25, 1 - rd / 9);
        for (x = 0; x < W; x++) {
          var chk = (Math.floor(fx) + Math.floor(fy)) & 1, i = (y * W + x) * 4, j = ((VH - 1 - y) * W + x) * 4;
          px(i, chk ? [47, 119, 119] : [38, 96, 96], sh);
          px(j, chk ? [40, 22, 110] : [30, 15, 80], sh * 0.85);
          fx += sx; fy += sy;
        }
      }
      /* стены: DDA по клеткам */
      for (x = 0; x < W; x++) {
        var cam = 2 * x / W - 1, rdx = st.dx + st.plx * cam, rdy = st.dy + st.ply * cam, mx = Math.floor(st.x), my = Math.floor(st.y);
        var ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy), stx, sty, sdx, sdy, side = 0, hitc = "#";
        if (rdx < 0) { stx = -1; sdx = (st.x - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - st.x) * ddx; }
        if (rdy < 0) { sty = -1; sdy = (st.y - my) * ddy; } else { sty = 1; sdy = (my + 1 - st.y) * ddy; }
        for (var k = 0; k < 64; k++) { if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; } hitc = cell(mx, my); if (hitc !== ".") break; }
        var dist = side === 0 ? sdx - ddx : sdy - ddy; if (dist < 0.01) dist = 0.01; zb[x] = dist;
        var lh = VH / dist, top = Math.floor(half - lh / 2), bot = Math.floor(half + lh / 2);
        var wx = side === 0 ? st.y + dist * rdy : st.x + dist * rdx; wx -= Math.floor(wx);
        var tx = Math.floor(wx * TS); if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TS - 1 - tx;
        var T = TEX[hitc] || TEX["#"], f = Math.max(0.2, 1 - dist / 11) * (side ? 0.78 : 1);
        for (y = Math.max(0, top); y < Math.min(VH, bot); y++) {
          var ty = Math.floor((y - top) / lh * TS) & 15, c = T[ty * TS + tx];
          if (hitc === "S" && c[1] > 200 && Math.floor(st.t * 3 + ty + mx) % 3 === 0) c = [255, 74, 74];
          px((y * W + x) * 4, c, f);
        }
      }
      /* спрайты: от дальних к ближним */
      var list = st.ents.concat(st.shots.map(function (s) { return { k: "spit", x: s.x, y: s.y, shot: true }; }));
      list.forEach(function (e) { e._d = (st.x - e.x) * (st.x - e.x) + (st.y - e.y) * (st.y - e.y); });
      list.sort(function (a, b) { return b._d - a._d; });
      var inv = 1 / (st.plx * st.dy - st.dx * st.ply);
      list.forEach(function (e) {
        var frames = SPRT[e.k]; if (!frames) return;
        var fr = frames.length > 1 ? frames[Math.floor((e.anim || 0) * 6) % frames.length] : frames[0];
        var sx = e.x - st.x, sy = e.y - st.y, tX = inv * (st.dy * sx - st.dx * sy), tY = inv * (-st.ply * sx + st.plx * sy);
        if (tY <= 0.1) return;
        var scx = Math.floor(W / 2 * (1 + tX / tY)), size = Math.abs(VH / tY) * (e.k === "coffee" || e.shot ? 0.5 : 0.8), drop = Math.floor((VH / tY) * (e.k === "coffee" || e.shot ? 0.25 : 0.1));
        var y0 = Math.floor(half - size / 2) + drop, x0 = Math.floor(scx - size / 2), f = Math.max(0.3, 1 - Math.sqrt(e._d) / 11);
        for (var sxp = Math.max(0, x0); sxp < Math.min(W, x0 + size); sxp++) {
          if (tY >= zb[sxp]) continue;
          var tx = Math.floor((sxp - x0) / size * TS);
          for (var syp = Math.max(0, y0); syp < Math.min(VH, y0 + size); syp++) {
            var c = fr[Math.floor((syp - y0) / size * TS) * TS + tx]; if (!c) continue;
            px((syp * W + sxp) * 4, e.flash > 0 ? [255, 255, 255] : c, e.flash > 0 ? 1 : f);
          }
        }
      });
      g.putImageData(img, 0, 0);
      hud();
    }
    function weapon() {
      var b = Math.sin(st.bob) * 3, bx = W / 2 - 14 + Math.cos(st.bob / 2) * 3, by = VH - 34 + Math.abs(b) + (st.flash > 0 ? 4 : 0);
      /* «дебаггер»: пиксельный бластер-мышка */
      g.fillStyle = "#1a0f4d"; g.fillRect(bx - 1, by - 1, 30, 36);
      g.fillStyle = "#c0c0c0"; g.fillRect(bx, by, 28, 34); g.fillStyle = "#ffffff"; g.fillRect(bx, by, 28, 2); g.fillRect(bx, by, 2, 34);
      g.fillStyle = "#3a1aa0"; g.fillRect(bx + 6, by + 4, 16, 8); g.fillStyle = "#ffe44d"; g.fillRect(bx + 12, by - 6, 4, 10);
      g.fillStyle = "#808080"; g.fillRect(bx + 13, by + 14, 2, 10);
      if (st.flash > 0) { g.fillStyle = "#fff59a"; g.fillRect(bx + 8, by - 18, 12, 12); g.fillStyle = "#ffffff"; g.fillRect(bx + 11, by - 15, 6, 6); }
    }
    function t8(s, x, y, col, size, al) { g.font = (size || 8) + "px 'Press Start 2P',monospace"; g.textBaseline = "top"; g.textAlign = al || "left"; g.fillStyle = "#1a0f4d"; g.fillText(s, x + 1, y + 1); g.fillStyle = col || "#fff"; g.fillText(s, x, y); g.textAlign = "left"; }
    function face(x, y) {
      /* лицо героя внизу экрана: чем меньше здоровья, тем грустнее цыплёнок */
      var m = st.hp > 60 ? 0 : st.hp > 25 ? 1 : 2;
      g.fillStyle = "#1a0f4d"; g.fillRect(x, y, 20, 20); g.fillStyle = st.hurt > 0 ? "#ff8a8a" : "#ffe44d"; g.fillRect(x + 1, y + 1, 18, 18);
      g.fillStyle = "#1a0f4d"; g.fillRect(x + 5, y + 6, 2, m === 2 ? 1 : 2); g.fillRect(x + 13, y + 6, 2, m === 2 ? 1 : 2);
      g.fillStyle = "#f08a1c"; g.fillRect(x + 8, y + 10, 4, 3);
      g.fillStyle = "#1a0f4d"; if (m === 0) { g.fillRect(x + 6, y + 15, 8, 1); g.fillRect(x + 5, y + 14, 1, 1); g.fillRect(x + 14, y + 14, 1, 1); } else if (m === 1) g.fillRect(x + 6, y + 15, 8, 1); else { g.fillRect(x + 6, y + 15, 8, 1); g.fillRect(x + 5, y + 16, 1, 1); g.fillRect(x + 14, y + 16, 1, 1); }
    }
    function hud() {
      weapon();
      g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(W / 2 - 3, VH / 2, 7, 1); g.fillRect(W / 2, VH / 2 - 3, 1, 7);
      if (st.hurt > 0) { g.fillStyle = "rgba(208,48,48," + (st.hurt * 1.4) + ")"; g.fillRect(0, 0, W, VH); }
      g.fillStyle = "#c0c0c0"; g.fillRect(0, VH, W, H - VH); g.fillStyle = "#ffffff"; g.fillRect(0, VH, W, 1); g.fillStyle = "#808080"; g.fillRect(0, H - 1, W, 1);
      t8("ЖИЗНЬ", 6, VH + 3, "#3a1aa0", 8); t8(Math.ceil(st.hp) + "%", 6, VH + 13, st.hp > 30 ? "#1b7a2e" : "#c01a2f", 8);
      t8("БАГИ", 76, VH + 3, "#3a1aa0", 8); t8(st.kills + "/" + st.total, 76, VH + 13, "#1a0f4d", 8);
      face(W / 2 - 10, VH + 2);
      t8("УР.", 190, VH + 3, "#3a1aa0", 8); t8((st.n + 1) + "/" + LEVELS.length, 190, VH + 13, "#1a0f4d", 8);
      t8("ОЧКИ", 250, VH + 3, "#3a1aa0", 8); t8(String(st.score), 250, VH + 13, "#c01a2f", 8);
      if (st.msgT > 0) t8(st.msg, W / 2, 10, "#ffe44d", 8, "center");
      var f = facing(); if (f.c === "D") t8("E: открыть терминал", W / 2, VH - 48, "#ffffff", 8, "center"); else if (f.c === "E") t8("E: выход", W / 2, VH - 48, "#ffffff", 8, "center");
      if (keys.map) minimap();
    }
    function minimap() {
      var s = 4, ox = 4, oy = 22, C = { "#": "#3a1aa0", T: "#2f7777", S: "#55546a", O: "#c0c0c0", D: "#ffe44d", E: "#1b7a2e" };
      st.map.forEach(function (r, y) { r.forEach(function (c, x) { g.fillStyle = c === "." ? "rgba(0,0,0,.5)" : C[c]; g.fillRect(ox + x * s, oy + y * s, s, s); }); });
      g.fillStyle = "#ffffff"; g.fillRect(ox + st.x * s - 1, oy + st.y * s - 1, 3, 3);
      st.ents.forEach(function (e) { if (e.hp > 0) { g.fillStyle = "#d03030"; g.fillRect(ox + e.x * s - 1, oy + e.y * s - 1, 2, 2); } });
    }
    /* ---------- терминал с вопросом ---------- */
    function ask(cx, cy) {
      mode = "ask"; keys = {}; pad = {}; try { if (document.pointerLockElement === cv) document.exitPointerLock(); } catch (e) {}
      if (!QS.length) { st.map[cy][cx] = "."; mode = "play"; return; }
      var q = QS[qi++ % QS.length], order = q.o.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; });
      over.hidden = false; root.setAttribute("data-state", "ask");
      over.innerHTML = '<div class="gm-card dgq"><h3>Терминал двери</h3><p>' + E(q.q) + '</p>' + (q.code ? '<pre>' + E(q.code) + '</pre>' : "") +
        '<div class="dgo">' + order.map(function (i) { return '<button type="button" class="btn" data-i="' + i + '">' + E(q.o[i]) + '</button>'; }).join("") + '</div><p class="m" id="dgr" role="status"></p></div>';
      over.querySelectorAll("[data-i]").forEach(function (b) {
        b.onclick = function () {
          var ok = +b.dataset.i === q.a, r = over.querySelector("#dgr");
          over.querySelectorAll("[data-i]").forEach(function (x) { x.disabled = true; if (+x.dataset.i === q.a) x.classList.add("go"); });
          r.textContent = (ok ? "Верно! Дверь открыта. " : "Неверно: баг кусается (−15). ") + (q.why || "");
          if (ok) { st.map[cy][cx] = "."; st.score += 50; } else hurt(15);
          setTimeout(function () { if (mode !== "ask") return; over.hidden = true; mode = st.hp > 0 ? "play" : mode; if (mode === "play") root.setAttribute("data-state", "play"); cv.focus(); }, ok ? 1400 : 2600);
        };
      });
    }
    function win() {
      st.score += 500 + Math.max(0, 300 - Math.floor(st.t));
      if (st.n + 1 < LEVELS.length) { load(st.n + 1); return; }
      end(true);
    }
    function end(won) {
      mode = "over"; root.setAttribute("data-state", won ? "won" : "over"); keys = {}; pad = {};
      try { if (document.pointerLockElement === cv) document.exitPointerLock(); } catch (e) {}
      var b = best(st.score);
      try { if (window.Net && Net.score && st.score > 0) Net.score("dungeon", st.score); } catch (e) {}
      over.hidden = false;
      over.innerHTML = '<div class="gm-card"><h3>' + (won ? "Все баги исправлены!" : "Баги победили") + '</h3><p>Очки: <b>' + st.score + '</b> · уровень ' + (st.n + 1) + ' из ' + LEVELS.length + '</p><p class="m">Рекорд: ' + b + '</p><div class="btns"><button class="btn go" type="button" data-a="go">Ещё раз</button></div></div>';
      if (opt.onEnd) opt.onEnd(st.score);
    }
    function start() { st = null; load(0); mode = "play"; over.hidden = true; root.setAttribute("data-state", "play"); cv.focus(); }
    function menu() {
      over.hidden = false;
      over.innerHTML = '<div class="gm-card"><h3>Подземелье багов</h3><p class="m">Найди выход на каждом из трёх уровней. Баги кусаются, красные плюются. Жёлтые двери-терминалы открывает правильный ответ' + (QS.length ? "" : " (вопросов нет, двери открыты)") + '. Кофе лечит.</p>' +
        '<p class="m gm-keys">W S: вперёд и назад, A D: шаг вбок, ← →: поворот (или мышь: кликни по игре), пробел или клик: выстрел, E: открыть дверь, Shift: бег, M: карта, P: пауза</p>' +
        '<div class="btns"><button class="btn big go" type="button" data-a="go" id="dgGo">Вперёд</button></div><p class="m">Рекорд: ' + best() + '</p></div>';
    }
    over.addEventListener("click", function (e) { var b = e.target.closest("[data-a]"); if (b && b.dataset.a === "go") start(); });
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
      if (!st) return;
      if (mode === "play" && !document.hidden) update(dt);
      if (mode === "pause") { render(); g.fillStyle = "rgba(26,15,77,.6)"; g.fillRect(0, 0, W, H); t8("ПАУЗА", W / 2, 70, "#fff", 12, "center"); return; }
      render();
    }
    var MAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "sl", KeyD: "sr", ArrowLeft: "tl", ArrowRight: "tr", KeyQ: "tl", Space: "fire", ControlLeft: "fire", ShiftLeft: "run", ShiftRight: "run", KeyM: "map" };
    function kd(e) {
      if (!document.body.contains(root) || mode === "menu" || mode === "over" || mode === "ask") return;
      var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA") return;
      if (e.code === "KeyP" || (e.code === "Escape" && document.pointerLockElement !== cv)) { mode = mode === "pause" ? "play" : "pause"; e.preventDefault(); return; }
      if (mode !== "play") return;
      if (e.code === "KeyE" || e.code === "Enter") { use(); e.preventDefault(); return; }
      var k = MAP[e.code]; if (k) { keys[k] = true; e.preventDefault(); }
      if (k === "fire" && !e.repeat && st.cd <= 0) fire(); /* короткое нажатие тоже стреляет */
    }
    function ku(e) { var k = MAP[e.code]; if (k) keys[k] = false; }
    function mm(e) { if (document.pointerLockElement === cv && mode === "play") mouseDX += e.movementX || 0; }
    function blur() { keys = {}; pad = {}; }
    cv.addEventListener("click", function () {
      if (mode !== "play") return;
      if (document.pointerLockElement === cv) { if (st.cd <= 0) fire(); return; }
      if (window.matchMedia && matchMedia("(pointer:fine)").matches && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (x) {} }
    });
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku); document.addEventListener("mousemove", mm); window.addEventListener("blur", blur);
    root.querySelectorAll(".gm-pad button").forEach(function (b) {
      var k = b.dataset.k;
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); if (k === "use") { if (mode === "play") use(); return; } pad[k] = true; try { b.setPointerCapture(e.pointerId); } catch (x) {} });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (ev) { b.addEventListener(ev, function () { pad[k] = false; }); });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
    load(0); render(); menu();
    raf = requestAnimationFrame(frame);
    return {
      root: root, start: start,
      destroy: function () { cancelAnimationFrame(raf); document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); document.removeEventListener("mousemove", mm); window.removeEventListener("blur", blur); try { if (document.pointerLockElement === cv) document.exitPointerLock(); } catch (e) {} host.innerHTML = ""; },
      _state: function () { return st; }, _use: use
    };
  }
  return { mount: mount, LEVELS: LEVELS, best: function () { return best(); } };
})();
