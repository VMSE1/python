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
  function show(kind) {
    if (ov || !window.Egg) return; kind = kind === "thanks" ? "thanks" : "skull"; var th = kind === "thanks";
    var calm = false; try { calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    ov = document.createElement("div"); ov.id = "scare"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", th ? "Спасибо от учителя" : "Шутка от учителя");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:"+(th?"radial-gradient(circle at 50% 45%,#5a1030 0%,#1a0714 60%,#08030a 100%)":"radial-gradient(circle at 50% 45%,#3a0508 0%,#120104 55%,#000 100%)")+";display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer";
    ov.innerHTML = '<canvas width="96" height="150" style="width:min(70vw,58vh,360px);height:auto;image-rendering:pixelated"></canvas><div style="font:400 clamp(14px,4vw,22px) \'Press Start 2P\',monospace;color:'+(th?'#ff9fb5':'#ffe14d')+';text-align:center;padding:0 12px">'+(th?'Спасибо за урок!':'Скелет нашёл тебя…')+'</div><div style="font:500 14px \'IBM Plex Mono\',monospace;color:#bbb">'+(th?'Ты молодец. Скелет передаёт сердечко. Коснись, чтобы закрыть.':'Это шутка учителя. Коснись, чтобы закрыть.')+'</div>';
    document.body.appendChild(ov); ov.onclick = close; document.addEventListener("keydown", onKey, true);
    var c = ov.querySelector("canvas").getContext("2d"), t0 = performance.now(); c.imageSmoothingEnabled = false;
    if (!calm) { if (th) chime(); else beep(); }
    function fr(now) {
      var t = (now - t0) / 1000, k = calm ? 1 : t < .35 ? .45 + t / .35 * .8 : t < .5 ? 1.25 - (t - .35) / .15 * .2 : 1.05 + Math.sin(t * 6) * .01;
      var sh = !th && !calm && t > .3 && t < 1.6 ? (Math.random() * 2 - 1) * 6 : 0;
      c.clearRect(0, 0, 96, 150); c.save(); c.translate(48 + sh, 70 + sh); c.scale(k, k); c.translate(-48, -70); (th ? nice : skull)(c, calm ? 0 : t); c.restore();
      raf = requestAnimationFrame(fr);
    }
    raf = requestAnimationFrame(fr); tmr = setTimeout(close, th ? 5000 : 2800);
  }
  window.Scare = { show: show, close: close, kinds: ["skull", "thanks"] };
})();
