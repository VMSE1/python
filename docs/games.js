/* Мини-игры за пройденные задания. Без картинок и библиотек: всё рисуется кодом.
   Games.mount(хозяин, id) -> {destroy}; Games.modal(id); Games.random(); Games.LIST.
   Состояние видно в атрибутах корня: data-state, data-score (для автотестов). */
var Games = (function () {
  var LIST = [
    { id: "mines", name: "Сапёр", hint: "Открывай клетки и не наступи на мину. Правая кнопка или длинное нажатие ставит флажок." },
    { id: "snake", name: "Змейка", hint: "Стрелки или WASD. Съедай биты и расти. Стены и хвост опасны." },
    { id: "runner", name: "Бегун", hint: "Пробел, стрелка вверх или касание: прыжок. Перепрыгивай баги, собирай монеты." },
    { id: "maze", name: "Лабиринт", hint: "Стрелки или WASD. Собери все биты и убегай от багов." }
  ];
  function E(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function best(id, v) { try { var k = "best_" + id, o = +localStorage.getItem(k) || 0; if (v != null && v > o) { localStorage.setItem(k, v); o = v; } return o; } catch (e) { return v || 0; } }
  function shell(host, g, extra) {
    host.innerHTML = '<div class="gm" data-g="' + g.id + '" data-state="ready" data-score="0"><div class="gm-top"><b>' + E(g.name) + '</b><span class="gm-st"></span><button class="btn sm ghost" type="button" data-r>Заново</button></div>' +
      '<p class="m gm-hint">' + E(g.hint) + "</p>" + extra + "</div>";
    return host.firstChild;
  }
  function setState(root, st, score, text) {
    root.setAttribute("data-state", st); if (score != null) root.setAttribute("data-score", score);
    root.querySelector(".gm-st").textContent = text || "";
    if ((st === "won" || st === "over") && score > 0) { try { if (window.Net && Net.score) Net.score(root.getAttribute("data-g"), score); } catch (e) {} }
  }
  function dpad(root, press) {
    var d = document.createElement("div"); d.className = "gm-pad";
    [["▲", "up"], ["◀", "left"], ["▼", "down"], ["▶", "right"]].forEach(function (a) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn sm"; b.textContent = a[0]; b.setAttribute("aria-label", a[1]); b.setAttribute("data-d", a[1]);
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); press(a[1]); }); d.appendChild(b);
    });
    root.appendChild(d);
  }
  var KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right", "ц": "up", "ы": "down", "ф": "left", "в": "right" };
  var DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  /* ---------- Сапёр ---------- */
  function mines(host) {
    var g = LIST[0], N = 9, MN = 10, cells, started, over, flags, t0, timer, flagMode = false;
    var root = shell(host, g, '<div class="gm-bar"><span data-m></span><button class="btn sm ghost" type="button" data-f>Флажок: выкл</button><span data-t>0 с</span></div><div class="mn" role="grid"></div>');
    var grid = root.querySelector(".mn"), mEl = root.querySelector("[data-m]"), tEl = root.querySelector("[data-t]"), fB = root.querySelector("[data-f]");
    function reset() {
      cells = []; for (var i = 0; i < N * N; i++) cells.push({ m: 0, a: 0, o: 0, f: 0, bad: 0 });
      started = false; over = false; flags = 0; clearInterval(timer); tEl.textContent = "0 с"; draw(); btns = []; draw(); setState(root, "ready", 0, "Нажми на любую клетку");
    }
    function nb(i) { var x = i % N, y = Math.floor(i / N), r = []; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; var nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) r.push(ny * N + nx); } return r; }
    function plant(safe) {
      var ban = {}; ban[safe] = 1; nb(safe).forEach(function (k) { ban[k] = 1; }); var n = 0;
      while (n < MN) { var k = rnd(N * N); if (!ban[k] && !cells[k].m) { cells[k].m = 1; n++; } }
      cells.forEach(function (c, i) { c.a = nb(i).filter(function (k) { return cells[k].m; }).length; });
    }
    function open(i) {
      var st = [i];
      while (st.length) { var k = st.pop(), c = cells[k]; if (c.o || c.f) continue; c.o = 1; if (!c.a && !c.m) nb(k).forEach(function (j) { if (!cells[j].o) st.push(j); }); }
    }
    function lose(i) { over = true; clearInterval(timer); cells.forEach(function (c) { if (c.m && !c.f) c.o = 1; else if (!c.m && c.f) c.bad = 1; }); cells[i].boom = 1; setState(root, "lost", 0, "Мина! Попробуй ещё раз"); }
    function checkWin() { if (cells.every(function (c) { return c.m || c.o; })) { over = true; clearInterval(timer); var s = Math.max(1, Math.round((Date.now() - t0) / 1000)); setState(root, "won", s, "Победа за " + s + " с"); } }
    function act(i, flag) {
      if (over) return; var c = cells[i];
      if (flag) { if (!c.o) { c.f = c.f ? 0 : 1; flags += c.f ? 1 : -1; } draw(); return; }
      if (c.f || c.o) return;
      if (!started) { started = true; plant(i); t0 = Date.now(); timer = setInterval(function () { tEl.textContent = Math.round((Date.now() - t0) / 1000) + " с"; }, 500); setState(root, "playing", 0, "Играем"); }
      if (c.m) { lose(i); draw(); return; }
      open(i); checkWin(); draw();
    }
    var btns = [];
    function build() {
      grid.innerHTML = ""; btns = [];
      for (var i = 0; i < N * N; i++) { var b = document.createElement("button"); b.type = "button"; b.dataset.i = i; b.setAttribute("aria-label", "клетка " + (i + 1)); grid.appendChild(b); btns.push(b); }
    }
    function draw() {
      if (btns.length !== N * N) build();
      mEl.textContent = "Мин: " + Math.max(0, MN - flags);
      cells.forEach(function (c, i) {
        var cls = "c" + (c.o ? " op" + (c.m ? " mine" : "") + (c.boom ? " boom" : "") + (c.a && !c.m ? " n" + c.a : "") : "") + (c.f && !c.o ? " fl" : "") + (c.bad ? " bad" : ""),
            t = c.o ? (c.m ? "✱" : (c.a || "")) : (c.bad ? "✕" : (c.f ? "⚑" : ""));
        var b = btns[i]; if (b.className !== cls) b.className = cls; if (b.textContent !== t) b.textContent = t;
      });
    }
    function chord(i) {
      var c = cells[i]; if (!c.o || !c.a) return;
      var around = nb(i), fl = around.filter(function (k) { return cells[k].f; }).length;
      if (fl !== c.a) return;
      for (var q = 0; q < around.length && !over; q++) { var k = around[q]; if (cells[k].f || cells[k].o) continue; if (cells[k].m) { lose(k); break; } open(k); }
      if (!over) checkWin();
    }
    var press = null, lastLong = 0, lastType = "mouse";
    function clearPress() { if (press) { clearTimeout(press.t); press = null; } }
    grid.addEventListener("pointerdown", function (e) {
      lastType = e.pointerType || "mouse"; clearPress();
      var b = e.target.closest("[data-i]"); if (!b || lastType === "mouse") return;
      var i = +b.dataset.i, x = e.clientX, y = e.clientY;
      press = { x: x, y: y, t: setTimeout(function () { press = null; lastLong = Date.now(); act(i, true); if (navigator.vibrate) { try { navigator.vibrate(20); } catch (er) {} } }, 420) };
    });
    grid.addEventListener("pointermove", function (e) { if (press && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 10) clearPress(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { grid.addEventListener(n, clearPress); });
    grid.addEventListener("click", function (e) {
      var b = e.target.closest("[data-i]"); if (!b || Date.now() - lastLong < 700) return;
      var i = +b.dataset.i; if (cells[i].o) { if (!over) { chord(i); draw(); } return; }
      act(i, flagMode);
    });
    grid.addEventListener("contextmenu", function (e) { e.preventDefault(); if (lastType !== "mouse") return; var b = e.target.closest("[data-i]"); if (b) act(+b.dataset.i, true); });
    fB.onclick = function () { flagMode = !flagMode; fB.textContent = "Флажок: " + (flagMode ? "вкл" : "выкл"); };
    root.querySelector("[data-r]").onclick = reset; reset();
    return { destroy: function () { clearInterval(timer); host.innerHTML = ""; }, _cells: function () { return cells; } };
  }

  /* ---------- Змейка ---------- */
  function snake(host) {
    var g = LIST[1], N = 20, S = 22, sn, dir, nd, food, score, alive, tm, started;
    var root = shell(host, g, '<canvas class="gm-cv" width="' + N * S + '" height="' + N * S + '" tabindex="0" aria-label="Поле змейки"></canvas>');
    var cv = root.querySelector("canvas"), cx = cv.getContext("2d");
    function reset() {
      sn = [[10, 10], [9, 10], [8, 10]]; dir = "right"; nd = "right"; score = 0; alive = true; started = false; put(); clearInterval(tm); draw(); setState(root, "ready", 0, "Нажми стрелку, чтобы начать");
    }
    function put() { do { food = [rnd(N), rnd(N)]; } while (sn.some(function (p) { return p[0] === food[0] && p[1] === food[1]; })); }
    function turn(d) {
      if (!alive) return; var o = { up: "down", down: "up", left: "right", right: "left" };
      if (d !== o[dir]) nd = d; if (!started) { started = true; tm = setInterval(step, 110); setState(root, "playing", score, "Счёт: " + score); }
    }
    function step() {
      dir = nd; var h = sn[0], v = DIR[dir], n = [h[0] + v[0], h[1] + v[1]];
      if (n[0] < 0 || n[1] < 0 || n[0] >= N || n[1] >= N || sn.some(function (p, i) { return i < sn.length - 1 && p[0] === n[0] && p[1] === n[1]; })) { alive = false; clearInterval(tm); setState(root, "over", score, "Конец. Счёт: " + score + ", рекорд: " + best("snake", score)); draw(); return; }
      sn.unshift(n);
      if (n[0] === food[0] && n[1] === food[1]) { score++; put(); setState(root, "playing", score, "Счёт: " + score); } else sn.pop();
      draw();
    }
    function draw() {
      cx.fillStyle = "#0f0f2b"; cx.fillRect(0, 0, N * S, N * S);
      cx.fillStyle = "#1c1c4a"; for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) if ((i + j) % 2) cx.fillRect(i * S, j * S, S, S);
      cx.fillStyle = "#ffe44d"; cx.fillRect(food[0] * S + 4, food[1] * S + 4, S - 8, S - 8);
      sn.forEach(function (p, i) { cx.fillStyle = alive ? (i ? "#4aa3ff" : "#ffffff") : "#c01a2f"; cx.fillRect(p[0] * S + 1, p[1] * S + 1, S - 2, S - 2); });
    }
    function key(e) { var d = KEYS[e.key]; if (d && document.body.contains(root)) { e.preventDefault(); turn(d); } }
    document.addEventListener("keydown", key);
    var sx, sy; cv.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; cv.focus(); });
    cv.addEventListener("pointerup", function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")); });
    dpad(root, turn); root.querySelector("[data-r]").onclick = reset; reset();
    return { destroy: function () { clearInterval(tm); document.removeEventListener("keydown", key); host.innerHTML = ""; }, _turn: turn };
  }

  /* ---------- Бегун: прыгай через баги ---------- */
  function runner(host) {
    var g = LIST[2], W = 480, H = 270, GY = 210, raf, p, obs, coins, speed, score, dist, alive, last, started, cloud = 0;
    var root = shell(host, g, '<canvas class="gm-cv" width="' + W + '" height="' + H + '" tabindex="0" aria-label="Поле бегуна"></canvas>');
    var cv = root.querySelector("canvas"), cx = cv.getContext("2d");
    function reset() { p = { x: 60, y: GY - 34, vy: 0, g: true }; obs = []; coins = []; speed = 180; score = 0; dist = 0; alive = true; started = false; last = 0; spawnIn = 0.9; draw(); setState(root, "ready", 0, "Пробел или касание: прыжок"); cancelAnimationFrame(raf); }
    var spawnIn = 1;
    function jump() {
      if (!alive) { reset(); jumpStart(); return; }
      if (!started) jumpStart(); if (p.g) { p.vy = -430; p.g = false; }
    }
    function jumpStart() { if (started) return; started = true; setState(root, "playing", 0, "Счёт: 0"); last = 0; raf = requestAnimationFrame(loop); }
    function loop(now) {
      if (!alive) return; var dt = last ? Math.min(0.04, (now - last) / 1000) : 0.016; last = now;
      speed += dt * 4; dist += speed * dt; spawnIn -= dt;
      p.vy += 1250 * dt; p.y += p.vy * dt; if (p.y >= GY - 34) { p.y = GY - 34; p.vy = 0; p.g = true; }
      if (spawnIn <= 0) { var h = 28 + rnd(26); obs.push({ x: W + 20, w: 26, h: h }); if (Math.random() < 0.6) coins.push({ x: W + 20 + 60 + rnd(60), y: GY - 90 - rnd(40) }); spawnIn = 0.8 + Math.random() * 0.9 + (200 / speed) * 0.4; }
      obs.forEach(function (o) { o.x -= speed * dt; }); coins.forEach(function (c) { c.x -= speed * dt; });
      obs = obs.filter(function (o) { return o.x > -40; });
      coins = coins.filter(function (c) { if (c.x < -20) return false; if (Math.abs(c.x - (p.x + 12)) < 18 && Math.abs(c.y - (p.y + 17)) < 26) { score += 10; return false; } return true; });
      for (var i = 0; i < obs.length; i++) { var o = obs[i]; if (p.x + 20 > o.x + 3 && p.x + 4 < o.x + o.w - 3 && p.y + 32 > GY - o.h + 3) { alive = false; setState(root, "over", Math.floor(score + dist / 20), "Конец. Счёт: " + Math.floor(score + dist / 20) + ", рекорд: " + best("runner", Math.floor(score + dist / 20))); draw(); return; } }
      setState(root, "playing", Math.floor(score + dist / 20), "Счёт: " + Math.floor(score + dist / 20)); draw(); raf = requestAnimationFrame(loop);
    }
    function draw() {
      cx.fillStyle = "#4aa3ff"; cx.fillRect(0, 0, W, GY); cx.fillStyle = "#fffbdc";
      var cxo = (cloud = (cloud + 0.3) % (W + 120)); cx.fillRect(W - cxo, 40, 70, 16); cx.fillRect(W - cxo + 14, 30, 40, 12);
      cx.fillStyle = "#2a9a2a"; cx.fillRect(0, GY, W, H - GY); cx.fillStyle = "#1c6b1c"; for (var i = 0; i < W; i += 24) cx.fillRect(((i - dist % 24) + 24) % (W + 24) - 24 + 0, GY, 12, 6);
      obs.forEach(function (o) { cx.fillStyle = "#c01a2f"; cx.fillRect(o.x, GY - o.h, o.w, o.h); cx.fillStyle = "#fff"; cx.fillRect(o.x + 5, GY - o.h + 7, 5, 5); cx.fillRect(o.x + 15, GY - o.h + 7, 5, 5); cx.fillStyle = "#000"; cx.fillRect(o.x + 7, GY - o.h + 9, 2, 2); cx.fillRect(o.x + 17, GY - o.h + 9, 2, 2); cx.fillStyle = "#7a0f1c"; cx.fillRect(o.x - 4, GY - 6, 6, 6); cx.fillRect(o.x + o.w - 2, GY - 6, 6, 6); });
      coins.forEach(function (c) { cx.fillStyle = "#ffe44d"; cx.fillRect(c.x - 7, c.y - 7, 14, 14); cx.fillStyle = "#c9a000"; cx.fillRect(c.x - 3, c.y - 3, 6, 6); });
      var y = p.y; cx.fillStyle = "#3a1aa0"; cx.fillRect(p.x, y + 14, 24, 20); cx.fillStyle = "#ffe0b0"; cx.fillRect(p.x + 2, y + 2, 20, 14); cx.fillStyle = "#fff"; cx.fillRect(p.x + 4, y, 16, 5); cx.fillStyle = "#1a0f4d"; cx.fillRect(p.x + 14, y + 6, 4, 4); cx.fillRect(p.x + (p.g && Math.floor(dist / 12) % 2 ? 2 : 6), y + 32, 8, 4);
      cx.fillStyle = "#1a0f4d"; cx.font = "bold 14px monospace"; cx.fillText("Счёт: " + Math.floor(score + dist / 20), 10, 20);
    }
    function key(e) { if ((e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") && document.body.contains(root)) { e.preventDefault(); jump(); } }
    document.addEventListener("keydown", key); cv.addEventListener("pointerdown", function (e) { e.preventDefault(); jump(); });
    root.querySelector("[data-r]").onclick = reset; reset();
    return { destroy: function () { cancelAnimationFrame(raf); document.removeEventListener("keydown", key); host.innerHTML = ""; }, _jump: jump };
  }

  /* ---------- Лабиринт: собери биты, убегай от багов ---------- */
  var MAZE = ["###############", "#......#......#", "#.####.#.####.#", "#.............#", "#.##.#####.##.#", "#....#...#....#", "####.#.#.#.####", "#.............#", "#.##.#####.##.#", "#.............#", "###############"];
  function maze(host) {
    var g = LIST[3], C = 15, R = 11, S = 30, total = 0, grid, me, gh, dir, nd, left, lives, tm, alive, started, tick;
    var root = shell(host, g, '<div class="gm-bar"><span data-l></span><span data-b></span></div><canvas class="gm-cv" width="' + C * S + '" height="' + R * S + '" tabindex="0" aria-label="Лабиринт"></canvas>');
    var cv = root.querySelector("canvas"), cx = cv.getContext("2d"), lEl = root.querySelector("[data-l]"), bEl = root.querySelector("[data-b]");
    function wall(x, y) { return y < 0 || x < 0 || y >= R || x >= C || grid[y][x] === "#"; }
    function reset() {
      grid = MAZE.map(function (r) { return r.split(""); }); me = [7, 9]; grid[9][7] = " "; gh = [{ x: 1, y: 1, d: "right" }, { x: 13, y: 1, d: "left" }, { x: 7, y: 5, d: "up" }];
      dir = ""; nd = ""; lives = 3; alive = true; started = false; tick = 0; clearInterval(tm);
      left = 0; grid.forEach(function (r) { r.forEach(function (c) { if (c === ".") left++; }); }); total = left; info(); draw(); setState(root, "ready", 0, "Нажми стрелку, чтобы начать");
    }
    function info() { lEl.textContent = "Жизни: " + lives; bEl.textContent = "Бит осталось: " + left; }
    function turn(d) { if (!alive) return; nd = d; if (!started) { started = true; tm = setInterval(step, 150); setState(root, "playing", 0, "Играем"); } }
    function can(o, d) { var v = DIR[d]; return !wall(o[0] + v[0], o[1] + v[1]); }
    function hit() {
      if (!gh.some(function (q) { return q.x === me[0] && q.y === me[1]; })) return false;
      lives--; info(); if (lives <= 0) { alive = false; clearInterval(tm); setState(root, "over", total - left, "Баги победили. Собрано бит: " + (total - left)); } else { me = [7, 9]; dir = ""; nd = ""; gh[0].x = 1; gh[0].y = 1; gh[1].x = 13; gh[1].y = 1; gh[2].x = 7; gh[2].y = 5; }
      return true;
    }
    function step() {
      tick++; if (nd && can(me, nd)) dir = nd; if (dir && can(me, dir)) { me[0] += DIR[dir][0]; me[1] += DIR[dir][1]; }
      if (grid[me[1]][me[0]] === ".") { grid[me[1]][me[0]] = " "; left--; info(); if (!left) { alive = false; clearInterval(tm); setState(root, "won", total + lives, "Все биты собраны! Жизней: " + lives); draw(); return; } }
      if (hit()) { draw(); return; }
      if (tick % 2 === 0) gh.forEach(function (q) {
        var opts = ["up", "down", "left", "right"].filter(function (d) { return can([q.x, q.y], d) && !(DIR[d][0] === -DIR[q.d][0] && DIR[d][1] === -DIR[q.d][1]); });
        if (!opts.length) opts = ["up", "down", "left", "right"].filter(function (d) { return can([q.x, q.y], d); });
        if (Math.random() < 0.55) { opts.sort(function (a, b) { return (Math.abs(q.x + DIR[a][0] - me[0]) + Math.abs(q.y + DIR[a][1] - me[1])) - (Math.abs(q.x + DIR[b][0] - me[0]) + Math.abs(q.y + DIR[b][1] - me[1])); }); q.d = opts[0]; } else q.d = opts[rnd(opts.length)];
        q.x += DIR[q.d][0]; q.y += DIR[q.d][1];
      });
      if (hit()) { draw(); return; } draw();
    }
    function draw() {
      cx.fillStyle = "#0f0f2b"; cx.fillRect(0, 0, C * S, R * S);
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) { var c = grid[y][x];
        if (c === "#") { cx.fillStyle = "#3a1aa0"; cx.fillRect(x * S, y * S, S, S); cx.fillStyle = "#5a3ad0"; cx.fillRect(x * S + 3, y * S + 3, S - 6, S - 6); }
        else if (c === ".") { cx.fillStyle = "#ffe44d"; cx.fillRect(x * S + 12, y * S + 12, 6, 6); } }
      cx.fillStyle = "#4aa3ff"; cx.fillRect(me[0] * S + 4, me[1] * S + 4, S - 8, S - 8); cx.fillStyle = "#fff"; cx.fillRect(me[0] * S + 8, me[1] * S + 9, 5, 5); cx.fillRect(me[0] * S + 17, me[1] * S + 9, 5, 5); cx.fillStyle = "#000"; cx.fillRect(me[0] * S + 10, me[1] * S + 11, 2, 2); cx.fillRect(me[0] * S + 19, me[1] * S + 11, 2, 2);
      gh.forEach(function (q, i) { cx.fillStyle = ["#c01a2f", "#d36a1f", "#2a9a2a"][i]; cx.fillRect(q.x * S + 4, q.y * S + 6, S - 8, S - 10); cx.fillRect(q.x * S + 2, q.y * S + 12, 4, 6); cx.fillRect(q.x * S + S - 6, q.y * S + 12, 4, 6); cx.fillStyle = "#fff"; cx.fillRect(q.x * S + 8, q.y * S + 10, 4, 4); cx.fillRect(q.x * S + 17, q.y * S + 10, 4, 4); });
    }
    function key(e) { var d = KEYS[e.key]; if (d && document.body.contains(root)) { e.preventDefault(); turn(d); } }
    document.addEventListener("keydown", key); dpad(root, turn); root.querySelector("[data-r]").onclick = reset; reset();
    return { destroy: function () { clearInterval(tm); document.removeEventListener("keydown", key); host.innerHTML = ""; }, _turn: turn };
  }

  var IMPL = { mines: mines, snake: snake, runner: runner, maze: maze };
  function byId(id) { return LIST.filter(function (g) { return g.id === id; })[0]; }
  function mount(host, id) { return IMPL[id](host); }
  function random(not) { var a = LIST.filter(function (g) { return g.id !== not; }); return a[rnd(a.length)].id; }
  function modal(id, onClose) {
    var g = byId(id); if (!g || document.querySelector(".xm-back")) return;
    var back = document.createElement("div"); back.className = "xm-back"; back.setAttribute("role", "dialog"); back.setAttribute("aria-modal", "true"); back.setAttribute("aria-label", g.name);
    back.innerHTML = '<div class="xm gm-modal"><div class="xh"><span>Награда: ' + E(g.name) + '</span><button class="btn sm ghost" type="button" id="gm-x">Закрыть</button></div><div class="xb"></div></div>';
    document.body.appendChild(back);
    var inst = mount(back.querySelector(".xb"), id);
    function close() { inst.destroy(); back.remove(); document.removeEventListener("keydown", esc); if (onClose) onClose(); }
    function esc(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", esc); back.querySelector("#gm-x").onclick = close;
    back.addEventListener("click", function (e) { if (e.target === back) close(); }); back.querySelector("#gm-x").focus();
  }
  return { LIST: LIST, mount: mount, modal: modal, random: random, byId: byId, MAZE: MAZE };
})();
