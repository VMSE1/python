/* «Разбей баги»: арканоид в стиле курса. Платформа-терминал отбивает мяч «0», кирпичи это баги. Всё рисуется кодом.
   Zap.mount(хозяин, {onEnd}) -> {destroy}. Состояние в атрибутах корня: data-state, data-score, data-level (для автотестов). */
var Zap = (function () {
  var W = 320, H = 180;
  var PATTERNS = [
    function (r, c) { return true; },
    function (r, c) { return (r + c) % 2 === 0; },
    function (r, c) { return !(r > 0 && r < 4 && c > 2 && c < 7); }
  ];
  var ROWC = ["#d03030", "#f08a1c", "#ffe44d", "#2a9a2a", "#4aa3ff"];
  function best(v) { try { var o = +localStorage.getItem("best_zap") || 0; if (v != null && v > o) { localStorage.setItem("best_zap", v); o = v; } return o; } catch (e) { return v || 0; } }
  function mount(host, opt) {
    opt = opt || {};
    host.innerHTML = '<div class="gm-root" data-state="menu" data-score="0" data-level="0"><div class="gm-screen"><canvas width="' + W + '" height="' + H + '" tabindex="0" aria-label="Игра «Разбей баги»"></canvas><div class="gm-over" hidden></div></div>' +
      '<div class="gm-pad zappad" aria-hidden="true"><button data-k="left">◀</button><button data-k="right">▶</button></div></div>';
    var root = host.firstChild, cv = root.querySelector("canvas"), g = cv.getContext("2d"), over = root.querySelector(".gm-over");
    var keys = {}, pad = {}, raf = 0, last = 0, st = null, mode = "menu", paused = false, mx = null;
    function load(n) {
      st = st || { score: 0, lives: 3 };
      st.n = n; st.bricks = []; var P = PATTERNS[n % PATTERNS.length], rows = 5 + Math.min(2, n);
      for (var r = 0; r < rows; r++) for (var c = 0; c < 10; c++) if (P(r, c)) st.bricks.push({ x: 10 + c * 30, y: 24 + r * 11, w: 28, h: 9, hp: r < 1 + (n > 0 ? 1 : 0) ? 2 : 1, col: ROWC[r % 5] });
      st.pad = { x: W / 2 - 24, y: H - 14, w: 48, h: 6 }; st.fx = []; serve(); root.setAttribute("data-level", n + 1);
    }
    function serve() { st.ball = { x: st.pad.x + st.pad.w / 2, y: st.pad.y - 6, vx: 0, vy: 0, r: 3, stuck: true }; }
    function launch() { if (!st.ball.stuck) return; var sp = 120 + st.n * 12; st.ball.vx = sp * 0.55 * (Math.random() < 0.5 ? -1 : 1); st.ball.vy = -sp; st.ball.stuck = false; }
    function update(dt) {
      var p = st.pad, b = st.ball, sp = 190;
      if (mx != null) { p.x += (mx - p.w / 2 - p.x) * Math.min(1, dt * 22); } else { if (keys.left || pad.left) p.x -= sp * dt; if (keys.right || pad.right) p.x += sp * dt; }
      p.x = Math.max(2, Math.min(W - p.w - 2, p.x));
      if (b.stuck) { b.x = p.x + p.w / 2; b.y = p.y - b.r - 1; return; }
      var steps = 3; for (var s = 0; s < steps; s++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); } if (b.y < b.r + 14) { b.y = b.r + 14; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r <= p.y + p.h && b.x >= p.x - 2 && b.x <= p.x + p.w + 2) {
          var rel = (b.x - (p.x + p.w / 2)) / (p.w / 2), spd = Math.min(260, Math.hypot(b.vx, b.vy) * 1.01), ang = rel * 1.05;
          b.vx = Math.sin(ang) * spd; b.vy = -Math.cos(ang) * spd; b.y = p.y - b.r;
        }
        for (var i = 0; i < st.bricks.length; i++) {
          var k = st.bricks[i];
          if (b.x + b.r > k.x && b.x - b.r < k.x + k.w && b.y + b.r > k.y && b.y - b.r < k.y + k.h) {
            var ox = Math.min(b.x + b.r - k.x, k.x + k.w - (b.x - b.r)), oy = Math.min(b.y + b.r - k.y, k.y + k.h - (b.y - b.r));
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            k.hp--; st.score += 10; for (var q = 0; q < 4; q++) st.fx.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0.4, col: k.col });
            if (k.hp <= 0) { st.bricks.splice(i, 1); st.score += 10; }
            break;
          }
        }
      }
      if (b.y > H + 8) { st.lives--; if (st.lives <= 0) { end(false); return; } serve(); }
      if (!st.bricks.length) { st.score += 100; if (st.n >= 2) { end(true); return; } load(st.n + 1); }
      st.fx.forEach(function (f) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; }); st.fx = st.fx.filter(function (f) { return f.life > 0; });
      root.setAttribute("data-score", st.score);
    }
    function txt(s, x, y, col, size, al) { g.font = (size || 8) + "px 'Press Start 2P',monospace"; g.textBaseline = "top"; g.textAlign = al || "left"; g.fillStyle = "#1a0f4d"; g.fillText(s, x + 1, y + 1); g.fillStyle = col || "#fff"; g.fillText(s, x, y); g.textAlign = "left"; }
    function draw() {
      g.fillStyle = "#2f7777"; g.fillRect(0, 0, W, H); g.fillStyle = "#3a8888"; for (var y = 4; y < H; y += 12) for (var x = (y / 12 % 2) * 6 + 2; x < W; x += 12) g.fillRect(x, y, 1, 1);
      g.fillStyle = "#1a0f4d"; g.fillRect(0, 0, W, 14);
      st.bricks.forEach(function (k) { g.fillStyle = "#1a0f4d"; g.fillRect(k.x - 1, k.y - 1, k.w + 2, k.h + 2); g.fillStyle = k.hp > 1 ? "#c0c0c0" : k.col; g.fillRect(k.x, k.y, k.w, k.h); g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(k.x, k.y, k.w, 1); g.fillStyle = "#1a0f4d"; g.fillRect(k.x + 6, k.y + 3, 2, 2); g.fillRect(k.x + k.w - 8, k.y + 3, 2, 2); });
      var p = st.pad; g.fillStyle = "#1a0f4d"; g.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2); g.fillStyle = "#3a1aa0"; g.fillRect(p.x, p.y, p.w, p.h); g.fillStyle = "#c0c0c0"; g.fillRect(p.x + 2, p.y + 1, p.w - 4, 2); g.fillStyle = "#4aff6a"; g.fillRect(p.x + p.w / 2 - 1, p.y + 4, 3, 1);
      var b = st.ball; g.fillStyle = "#1a0f4d"; g.fillRect(Math.round(b.x) - 4, Math.round(b.y) - 4, 8, 8); g.fillStyle = "#ffe44d"; g.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6);
      st.fx.forEach(function (f) { g.fillStyle = f.col; g.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); });
      txt("ОЧКИ " + st.score, 6, 3, "#ffe44d", 8); txt("УР." + (st.n + 1), W / 2, 3, "#ffffff", 8, "center");
      for (var i = 0; i < 3; i++) { g.fillStyle = i < st.lives ? "#d03030" : "#3a1aa0"; g.fillRect(W - 40 + i * 12, 3, 8, 8); }
      if (st.ball.stuck && mode === "play") txt("ПРОБЕЛ или касание: запуск", W / 2, 120, "#ffffff", 8, "center");
      if (paused) { g.fillStyle = "rgba(26,15,77,.6)"; g.fillRect(0, 0, W, H); txt("ПАУЗА", W / 2, 76, "#ffffff", 12, "center"); }
    }
    function frame(ts) { raf = requestAnimationFrame(frame); var dt = Math.min(0.033, (ts - (last || ts)) / 1000); last = ts; if (!st) return; if (mode === "play" && !paused && !document.hidden) update(dt); draw(); }
    function end(won) {
      mode = "over"; root.setAttribute("data-state", won ? "won" : "over"); var bb = best(st.score);
      try { if (window.Net && Net.score && st.score > 0) Net.score("zap", st.score); } catch (e) {}
      over.hidden = false; over.innerHTML = '<div class="gm-card"><h3>' + (won ? "Все баги разбиты!" : "Баги победили") + '</h3><p>Очки: <b>' + st.score + '</b></p><p class="m">Рекорд: ' + bb + '</p><div class="btns"><button class="btn go" type="button" data-a="go">Ещё раз</button></div></div>';
      if (opt.onEnd) opt.onEnd(st.score);
    }
    function start() { st = null; load(0); mode = "play"; paused = false; over.hidden = true; root.setAttribute("data-state", "play"); cv.focus(); }
    function menu() { over.hidden = false; over.innerHTML = '<div class="gm-card"><h3>Разбей баги</h3><p class="m">Отбивай мяч терминалом и разбивай баги-кирпичи. Серые кирпичи крепкие: нужно два попадания. Три уровня, три жизни.</p><p class="m gm-keys">← → или A D, или мышь и палец: двигать, пробел или клик: запуск, P: пауза</p><div class="btns"><button class="btn big go" type="button" data-a="go" id="zapGo">Играть</button></div><p class="m">Рекорд: ' + best() + '</p></div>'; }
    over.addEventListener("click", function (e) { var b = e.target.closest("[data-a]"); if (b && b.dataset.a === "go") start(); });
    var MAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
    function kd(e) {
      if (!document.body.contains(root) || mode !== "play") return; var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA") return;
      if (e.code === "KeyP" || e.code === "Escape") { paused = !paused; e.preventDefault(); return; }
      if (e.code === "Space") { launch(); e.preventDefault(); return; }
      var k = MAP[e.code]; if (k) { keys[k] = true; mx = null; e.preventDefault(); }
    }
    function ku(e) { var k = MAP[e.code]; if (k) keys[k] = false; }
    function blur() { keys = {}; pad = {}; }
    cv.addEventListener("pointermove", function (e) { if (mode !== "play") return; var r = cv.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width * W; });
    cv.addEventListener("pointerdown", function (e) { if (mode !== "play") return; var r = cv.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width * W; launch(); });
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku); window.addEventListener("blur", blur);
    root.querySelectorAll(".gm-pad button").forEach(function (b) { var k = b.dataset.k;
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); pad[k] = true; mx = null; if (mode === "play") launch(); try { b.setPointerCapture(e.pointerId); } catch (x) {} });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (ev) { b.addEventListener(ev, function () { pad[k] = false; }); }); });
    load(0); draw(); menu(); raf = requestAnimationFrame(frame);
    return { root: root, start: start, destroy: function () { cancelAnimationFrame(raf); document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); host.innerHTML = ""; }, _state: function () { return st; } };
  }
  return { mount: mount, best: function () { return best(); } };
})();
