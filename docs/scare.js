/* Шуточный «скример» от учителя: на 3 секунды выскакивает наш скелет из игр сайта (egg.js) с красными светящимися глазами и открытой пастью.
   Это шутка, а не страшилка: без резких вспышек, закрывается касанием или Esc, сам исчезает за 3 секунды.
   При включённом «уменьшении движения» скелет просто появляется без прыжка и звука. */
(function () {
  var ov = null, raf = 0, tmr = 0;
  /* рисуем скелета из egg.js крупными пикселями: глаза мигают красным, челюсть открывается и закрывается */
  function skull(c, t) {
    var E = window.Egg, u = 6, glow = Math.sin(t * 23) > .92 ? .45 : 1, open = (Math.sin(t * 11) + 1) / 2 * .7 + .3;
    c.globalAlpha = 1; E.sprite(c, E.SKULL, 0, 0, u, { E: glow > .8 ? "#ff2a2a" : "#7a1018", X: "#f3ecd8" });
    var mo = Math.round(open * 3 + 1) * u; c.fillStyle = "#12030a"; c.fillRect(4 * u, 11 * u, 8 * u, mo);
    c.fillStyle = "#f3ecd8"; for (var i = 0; i < 4; i++) { c.fillRect((4 + i * 2) * u, 11 * u, u, u); c.fillRect((5 + i * 2) * u, 11 * u + mo - u, u, u); }
  }
  /* «Спасибо за урок»: добрый скелет с тёплыми глазами, улыбкой и большим пульсирующим сердцем */
  var HEART = ["..XX...XX..", ".XXXX.XXXX.", "XXXXXXXXXXX", "XXXXXXXXXXX", "XXXXXXXXXXX", ".XXXXXXXXX.", "..XXXXXXX..", "...XXXXX...", "....XXX....", ".....X....."];
  function nice(c, t) {
    var E = window.Egg, u = 6;
    c.globalAlpha = 1; E.sprite(c, E.SKULL, 0, 0, u, { E: "#ffcf4a", X: "#f3ecd8" });
    c.fillStyle = "#f3ecd8"; c.fillRect(4 * u, 11 * u, 8 * u, 4 * u);
    c.fillStyle = "#12030a"; c.fillRect(4 * u, 12 * u, u, u); c.fillRect(11 * u, 12 * u, u, u); c.fillRect(5 * u, 13 * u, 6 * u, u);   // улыбка
    var k = 1 + Math.sin(t * 6) * .08, hu = 5, hw = 11 * hu, hx = 48 - hw / 2 * k, hy = 100;
    c.save(); c.translate(48, hy + 25); c.scale(k, k); c.translate(-48, -(hy + 25));
    for (var r = 0; r < HEART.length; r++) for (var q = 0; q < HEART[r].length; q++) if (HEART[r][q] === "X") { c.fillStyle = r < 3 && q > 5 ? "#ff5a7a" : "#ff2d55"; c.fillRect(48 - hw / 2 + q * hu, hy + r * hu, hu, hu); }
    c.fillStyle = "#ffd0da"; c.fillRect(48 - hw / 2 + 2 * hu, hy + 2 * hu, hu, hu); c.fillRect(48 - hw / 2 + 3 * hu, hy + 1 * hu, hu, hu);
    c.restore();
  }
  function chime() {
    try {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var a = new A(), g = a.createGain(); g.connect(a.destination);
      [523, 659, 784].forEach(function (f, i) { var o = a.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(g); var s = a.currentTime + i * .16; o.start(s); o.stop(s + .25); });
      g.gain.setValueAtTime(.08, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .9);
      setTimeout(function () { try { a.close(); } catch (e) {} }, 1200);
    } catch (e) {}
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
  /* «Респект»: учитель держит тарелку с надписью PYTHON, вокруг летают маленькие пятёрки. Окно в стиле сайта на весь экран. */
  var FONT = { P: ["111", "101", "111", "100", "100"], Y: ["101", "101", "010", "010", "010"], T: ["111", "010", "010", "010", "010"], H: ["101", "101", "111", "101", "101"], O: ["111", "101", "101", "101", "111"], N: ["101", "111", "111", "101", "101"], 5: ["111", "100", "111", "001", "111"] };
  var FIVES = [[2, 2, 0], [31, 1, 1.3], [1, 10, 2.1], [34, 9, .7], [1, 14, 1.8], [35, 16, 2.6], [5, 0, 3.1], [27, 3, 2.3]];
  function line(c, x0, y0, x1, y1, u, ox, oy) {
    var n = 14;
    for (var p = 0; p < 2; p++) for (var i = 0; i <= n; i++) {
      var x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      c.fillStyle = p ? "#ffffff" : "#1a0f4d"; var m = p ? 1 : 2, w = p ? 2 : 4;
      c.fillRect(ox + (x - m) * u, oy + (y - m) * u, w * u, w * u);
    }
  }
  function respectScene(c, t) {
    var u = 8, X0 = 7, bob = Math.round(Math.sin(t * 3) * .6);
    c.clearRect(0, 0, 304, 224);
    c.save(); c.translate(0, bob * u / 2);
    window.Hero.draw(c, window.Hero.teacher, X0 * u, 0, u);
    line(c, 12, 14, 6, 19, u, 0, 0); line(c, 27, 14, 31, 19, u, 0, 0);
    var px = 4, py = 17, pw = 30, ph = 9;                        // тарелка
    for (var y = 0; y < ph; y++) for (var x = 0; x < pw; x++) {
      var edge = (y === 0 || y === ph - 1) && (x < 2 || x >= pw - 2); if (edge) continue;
      var k = y === 0 || y === ph - 1 || x === 0 || x === pw - 1 || ((y === 1 || y === ph - 2) && (x === 1 || x === pw - 2));
      var rim = !k && (y === 1 || y === ph - 2 || x === 1 || x === pw - 2);
      c.fillStyle = k ? "#1a0f4d" : rim ? "#c0c0c0" : (y >= ph - 4 ? "#e8e4d0" : "#fffbdc"); c.fillRect((px + x) * u, (py + y) * u, u, u);
    }
    c.fillStyle = "#808080"; for (var q = 3; q < pw - 3; q++) c.fillRect((px + q) * u, (py + ph - 2) * u, u, u);
    var word = "PYTHON", lx = px + 4, ly = py + 2;
    for (var li = 0; li < word.length; li++) { var g = FONT[word[li]]; for (var r = 0; r < 5; r++) for (var cc = 0; cc < 3; cc++) if (g[r][cc] === "1") { c.fillStyle = li % 2 ? "#3a1aa0" : "#4aa3ff"; c.fillRect((lx + li * 4 + cc) * u, (ly + r) * u, u, u); } }
    [[4, 19], [4, 20], [4, 21], [5, 19], [5, 20], [5, 21], [32, 19], [32, 20], [32, 21], [33, 19], [33, 20], [33, 21]].forEach(function (h, i) { c.fillStyle = (i % 6 === 0 || i % 6 === 3) ? "#d79f6f" : "#f6c99a"; c.fillRect(h[0] * u, h[1] * u, u, u); });
    c.restore();
    FIVES.forEach(function (f) {                                  // маленькие пятёрки
      var dy = Math.round(Math.sin(t * 2 + f[2] * 2) * 3), x0 = f[0] * u, y0 = f[1] * u + dy, s = 3, g = FONT[5];
      c.fillStyle = "#1a0f4d"; for (var r = 0; r < 5; r++) for (var cc = 0; cc < 3; cc++) if (g[r][cc] === "1") [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { c.fillRect(x0 + (cc + d[0]) * s, y0 + (r + d[1]) * s, s, s); });
      c.fillStyle = "#d03030"; for (var r2 = 0; r2 < 5; r2++) for (var c2 = 0; c2 < 3; c2++) if (g[r2][c2] === "1") c.fillRect(x0 + c2 * s, y0 + r2 * s, s, s);
    });
  }
  function respect(calm) {
    ov = document.createElement("div"); ov.id = "scare"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Респект от учителя");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:radial-gradient(circle at 50% 40%,#5a2fc8 0%,#2a1280 65%,#12084a 100%);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;overflow:auto";
    ov.innerHTML = '<div style="width:min(100%,960px);background:#c0c0c0;border:4px solid #000;box-shadow:8px 8px 0 #000"><div style="background:#3a1aa0;color:#fff;font:400 12px \'Press Start 2P\',monospace;padding:10px 12px">C:\\Python\\Респект</div>' +
      '<div style="display:flex;gap:26px;align-items:center;padding:22px;background:#fffbdc;flex-wrap:wrap;justify-content:center"><canvas width="304" height="224" style="width:min(86vw,520px);height:auto;image-rendering:pixelated"></canvas>' +
      '<div style="flex:1;min-width:230px"><div style="font:400 clamp(20px,4vw,34px)/1.4 \'Press Start 2P\',monospace;color:#3a1aa0;margin:0 0 12px">Респект!</div><div style="font:600 clamp(16px,2.4vw,24px)/1.5 \'IBM Plex Mono\',monospace;color:#1d1370">Учитель высылает тебе респект за то, что ты работаешь.</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button type="button" class="btn go" id="rsh">❤ Ответить сердечком</button><button type="button" class="btn ghost" id="rsx">Закрыть</button></div><div id="rsm" role="status" style="font:500 14px \'IBM Plex Mono\',monospace;color:#55547a;margin-top:10px;min-height:20px"></div></div></div></div>';
    document.body.appendChild(ov); document.addEventListener("keydown", onKey, true);
    var cv = ov.querySelector("canvas"), c = cv.getContext("2d"), t0 = performance.now(); c.imageSmoothingEnabled = false;
    ov.querySelector("#rsx").onclick = close;
    ov.querySelector("#rsh").onclick = function () {
      var b = this, m = ov.querySelector("#rsm"); b.disabled = true; m.textContent = "Сердечко улетело учителю ❤";
      try { if (window.Net && Net.on) Net.req("POST", "/api/heart", {}).catch(function () {}); } catch (e) {}
      tmr = setTimeout(close, 1500);
    };
    if (!calm) chime();
    (function fr(now) { respectScene(c, calm ? 0 : (now - t0) / 1000); raf = requestAnimationFrame(fr); })(t0);
  }
  function show(kind) {
    if (ov || !window.Egg) return; kind = kind === "thanks" || kind === "respect" ? kind : "skull"; var th = kind === "thanks";
    var calm = false; try { calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (kind === "respect") { if (window.Hero) respect(calm); else { var hs = document.createElement("script"); hs.src = "hero.js"; hs.onload = function () { if (!ov) respect(calm); }; document.head.appendChild(hs); } return; }
    ov = document.createElement("div"); ov.id = "scare"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", th ? "Спасибо от учителя" : "Шутка от учителя");
    ov.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;background:"+(th?"radial-gradient(circle at 50% 45%,#5a1030 0%,#1a0714 60%,#08030a 100%)":"radial-gradient(circle at 50% 45%,#3a0508 0%,#120104 55%,#000 100%)")+";cursor:pointer;overflow:hidden";
    ov.innerHTML = '<canvas style="position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated"></canvas><div style="position:absolute;left:0;right:0;bottom:5vh;text-align:center;padding:0 12px"><div style="font:400 clamp(16px,4.5vw,34px) \'Press Start 2P\',monospace;color:'+(th?'#ff9fb5':'#ffe14d')+';text-shadow:3px 3px 0 #000;margin-bottom:10px">'+(th?'Спасибо за урок!':'Скелет нашёл тебя…')+'</div><div style="font:500 clamp(13px,2.2vw,18px) \'IBM Plex Mono\',monospace;color:#ddd;text-shadow:2px 2px 0 #000">'+(th?'Ты молодец. Скелет передаёт сердечко. Коснись, чтобы закрыть.':'Это шутка учителя. Коснись, чтобы закрыть.')+'</div></div>';
    document.body.appendChild(ov); ov.onclick = close; document.addEventListener("keydown", onKey, true);
    var cv = ov.querySelector("canvas"), c = cv.getContext("2d"), t0 = performance.now();
    if (!calm) { if (th) chime(); else beep(); }
    function fr(now) {
      var w = innerWidth, h = innerHeight; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } c.imageSmoothingEnabled = false;
      var t = (now - t0) / 1000, k = calm ? 1 : t < .35 ? .45 + t / .35 * .8 : t < .5 ? 1.25 - (t - .35) / .15 * .2 : 1.05 + Math.sin(t * 6) * .01;
      var sh = !th && !calm && t > .3 && t < 1.6 ? (Math.random() * 2 - 1) * 6 : 0, fit = Math.min(w * .8 / 96, h * .74 / 150);
      c.clearRect(0, 0, w, h); c.save(); c.translate(w / 2 + sh, h * .42 + sh); c.scale(fit * k, fit * k); c.translate(-48, -72); (th ? nice : skull)(c, calm ? 0 : t); c.restore();
      raf = requestAnimationFrame(fr);
    }
    raf = requestAnimationFrame(fr); tmr = setTimeout(close, th ? 5000 : 3200);
  }
  window.Scare = { show: show, close: close, kinds: ["skull", "thanks", "respect"] };
})();
