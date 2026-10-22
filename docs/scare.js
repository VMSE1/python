/* Шуточный «скример» от учителя: на секунду выскакивает мультяшный зверёк (мишка, цыплёнок или зайка) с большими глазами и зубастой улыбкой.
   Персонажи придуманы здесь и нарисованы кодом. Это шутка, а не страшилка: без резких вспышек, закрывается касанием или Esc, сам исчезает за 3 секунды.
   При включённом «уменьшении движения» зверёк просто появляется без прыжка и звука. */
(function () {
  var ov = null, raf = 0, tmr = 0, KINDS = ["bear", "chick", "bunny"], NAMES = { bear: "Мишка", chick: "Цыплёнок", bunny: "Зайка" };
  function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); }
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill(); }
  function tri(c, a, b, d, col) { c.fillStyle = col; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill(); }
  /* страшнее: тёмные цвета, чёрные провалы глаз со светящимися зрачками, острые зубы, швы и трещины */
  function eyes(c, look, glow) {
    [150, 250].forEach(function (x) {
      circ(c, x, 184, 38, "#0a0408"); circ(c, x, 184, 30, "#1a0a0c");
      c.globalAlpha = glow; circ(c, x + look, 186, 17, glow > .8 ? "#ffe14d" : "#b9a020"); c.globalAlpha = 1;
      c.fillStyle = "#0a0408"; c.fillRect(x + look - 3, 172, 6, 28);
    });
    c.fillStyle = "#0a0408"; tri(c, [108, 150], [190, 162], [190, 172], "#0a0408"); tri(c, [292, 150], [210, 162], [210, 172], "#0a0408");
  }
  function teeth(c, y, w, open) {
    var n = 7, step = (2 * w) / n, i, x0 = 200 - w;
    c.fillStyle = "#e8e2c8";
    for (i = 0; i < n; i++) { tri(c, [x0 + i * step, y], [x0 + (i + 1) * step, y], [x0 + (i + .5) * step, y + 18 + (i % 2) * 8], "#e8e2c8"); }
    for (i = 0; i < n; i++) { var by = y + 6 + open * 36; tri(c, [x0 + i * step, by], [x0 + (i + 1) * step, by], [x0 + (i + .5) * step, by - 16 - ((i + 1) % 2) * 8], "#e8e2c8"); }
  }
  function mouth(c, y, w, open) {
    var h = 10 + open * 40; ell(c, 200, y + h / 2, w, h, "#12030a"); teeth(c, y + 2, w - 4, open);
  }
  function scars(c) {
    c.strokeStyle = "#120608"; c.lineWidth = 5; c.beginPath(); c.moveTo(250, 130); c.lineTo(285, 175); c.moveTo(262, 128); c.lineTo(292, 160); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(90, 235); c.lineTo(125, 235); for (var k = 0; k < 4; k++) { c.moveTo(98 + k * 8, 227); c.lineTo(98 + k * 8, 243); } c.stroke();
  }
  function face(c, kind, t) {
    var open = (Math.sin(t * 11) + 1) / 2 * .7 + .3, look = Math.sin(t * 3) * 3, glow = Math.sin(t * 23) > .92 ? .35 : 1;
    if (kind === "bear") {
      circ(c, 105, 95, 48, "#2a180c"); circ(c, 295, 95, 48, "#2a180c"); circ(c, 105, 95, 27, "#0f0806"); circ(c, 295, 95, 27, "#0f0806");
      circ(c, 200, 215, 150, "#4a2f1a"); ell(c, 200, 268, 78, 58, "#8a6a48"); eyes(c, look, glow); ell(c, 200, 236, 22, 15, "#0a0504"); mouth(c, 268, 62, open); scars(c);
    } else if (kind === "chick") {
      circ(c, 200, 218, 152, "#b89a1e"); ell(c, 200, 70, 14, 38, "#b89a1e"); ell(c, 165, 78, 12, 30, "#b89a1e"); ell(c, 235, 78, 12, 30, "#b89a1e");
      circ(c, 98, 262, 20, "#6a2a22"); circ(c, 302, 262, 20, "#6a2a22"); eyes(c, look, glow);
      var o = open * 26; tri(c, [160, 238], [240, 238], [200, 232], "#a8580c"); tri(c, [162, 244], [238, 244], [200, 268], "#a8580c");
      ell(c, 200, 270 + o / 2, 52, 10 + o, "#12030a"); teeth(c, 266, 48, open); scars(c);
    } else {
      ell(c, 140, 92, 38, 86, "#6e5a98"); ell(c, 260, 92, 38, 86, "#6e5a98"); ell(c, 140, 98, 18, 62, "#2a1030"); ell(c, 260, 98, 18, 62, "#2a1030");
      circ(c, 200, 228, 142, "#6e5a98"); eyes(c, look, glow); tri(c, [184, 232], [216, 232], [200, 250], "#2a1030"); mouth(c, 266, 58, open);
      c.fillStyle = "#e8e2c8"; c.fillRect(180, 262, 18, 30 + open * 8); c.fillRect(202, 262, 18, 30 + open * 8); scars(c);
    }
  }
  function close() { clearTimeout(tmr); cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey, true); if (ov) { ov.remove(); ov = null; } }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
  function beep() {
    try {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var a = new A(), o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(95, a.currentTime); o.frequency.exponentialRampToValueAtTime(48, a.currentTime + .7);
      o2.type = "square"; o2.frequency.setValueAtTime(101, a.currentTime); o2.frequency.exponentialRampToValueAtTime(52, a.currentTime + .7);
      g.gain.setValueAtTime(.001, a.currentTime); g.gain.exponentialRampToValueAtTime(.11, a.currentTime + .08); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .8);
      o.connect(g); o2.connect(g); g.connect(a.destination); o.start(); o2.start(); o.stop(a.currentTime + .85); o2.stop(a.currentTime + .85);
      setTimeout(function () { try { a.close(); } catch (e) {} }, 1000);
    } catch (e) {}
  }
  function show(kind) {
    if (ov) return; if (KINDS.indexOf(kind) < 0) kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    var calm = false; try { calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    ov = document.createElement("div"); ov.id = "scare"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Шутка от учителя");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:radial-gradient(circle at 50% 45%,#3a0508 0%,#120104 55%,#000 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer";
    ov.innerHTML = '<canvas width="100" height="100" style="width:min(86vw,62vh,440px);height:auto;image-rendering:pixelated"></canvas><div style="font:400 clamp(14px,4vw,22px) \'Press Start 2P\',monospace;color:#ffe14d;text-align:center;padding:0 12px">' + NAMES[kind] + ' смотрит на тебя…</div><div style="font:500 14px \'IBM Plex Mono\',monospace;color:#bbb">Это шутка учителя. Коснись, чтобы закрыть.</div>';
    document.body.appendChild(ov); ov.onclick = close; document.addEventListener("keydown", onKey, true);
    var c = ov.querySelector("canvas").getContext("2d"), t0 = performance.now(); c.imageSmoothingEnabled = false;
    if (!calm) beep();
    function fr(now) {
      var t = (now - t0) / 1000, k = calm ? 1 : t < .35 ? .45 + t / .35 * .8 : t < .5 ? 1.25 - (t - .35) / .15 * .2 : 1.05 + Math.sin(t * 6) * .01;
      var sh = !calm && t > .3 && t < 1.6 ? (Math.random() * 2 - 1) * 6 : 0;
      c.clearRect(0, 0, 100, 100); c.save(); c.scale(.25, .25); c.translate(200 + sh, 210 + sh); c.scale(k, k); c.translate(-200, -210); face(c, kind, calm ? 0 : t); c.restore();
      raf = requestAnimationFrame(fr);
    }
    raf = requestAnimationFrame(fr); tmr = setTimeout(close, 2800);
  }
  window.Scare = { show: show, close: close, kinds: KINDS };
})();
