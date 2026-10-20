/* Движок презентаций: слайды, фрагменты, клавиши, свайп, полный экран,
   и «запускатель кода» (пошаговый запуск настоящих трассировок из decks/traces.js). */
(function () {
  "use strict";
  var reduced = false; try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- дополнительные пиксельные иконки ---------- */
  var EXTRA = {
    bulb: ["", ".....KKKKKK.....", "....KYYYYYYK....", "...KYYWWYYYYK...", "...KYWYYYYYYK...", "...KYWYYYYYYK...", "...KYYYYYYYYK...", "....KYYYYYYK....", ".....KYYYYK.....", ".....KGGGGK.....", ".....KDDDDK.....", ".....KGGGGK.....", "......KKKK......"],
    cup: ["", "....D..D..D.....", ".....D..D.......", "", "..KKKKKKKKKK....", "..KWWWWWWWWKKK..", "..KWRRRRRRWK.K..", "..KWRRRRRRWK.K..", "..KWRRRRRRWKKK..", "...KWWWWWWK.....", "....KKKKKK......", "..KKKKKKKKKK...."],
    globe: ["", ".....KKKKKK.....", "...KKLLNNLLKK...", "..KLLNNNLLLLLK..", "..KLNNNLLLNNLK..", ".KLLNNLLLNNNLLK.", ".KLLLNLLLLNNLLK.", ".KLLLLLLLLLNLLK.", ".KLNNLLLLLLLLLK.", ".KLNNNLLLNLLLLK.", "..KLNNLLNNNLLK..", "..KLLLLLLNNLLK..", "...KKLLLLLLKK...", ".....KKKKKK....."],
    bug: ["", "...K........K...", "....K......K....", ".....KKKKKK.....", "....KRRRRRRK....", "..KKKRRKKRRKKK..", "....KRRRRRRK....", "..KKKRRKKRRKKK..", "....KRRRRRRK....", "..KKKRRKKRRKKK..", "....KRRRRRRK....", ".....KKKKKK....."],
    chart: ["", "", "..K.............", "..K.........NN..", "..K.........NN..", "..K....LL...NN..", "..K....LL...NN..", "..K.YY.LL...NN..", "..K.YY.LL...NN..", "..K.YY.LL...NN..", "..KKKKKKKKKKKKK."],
    gear: ["", ".......KK.......", "...KK.KGGK.KK...", "..KGGKKGGKKGGK..", "...KGGGGGGGGK...", "....KGGKKGGK....", ".KKKGGK..KGGKKK.", ".KGGGGK..KGGGGK.", ".KKKGGK..KGGKKK.", "....KGGKKGGK....", "...KGGGGGGGGK...", "..KGGKKGGKKGGK..", "...KK.KGGK.KK...", ".......KK......."],
    game: ["", "", "...KKKKKKKKKK...", "..KDDDDDDDDDDK..", ".KDDWDDDDDRDDDK.", ".KDWWWDDDRDRDDK.", ".KDDWDDDDDRDDDK.", "..KDDDDDDDDDDK..", "...KKKKKKKKKK..."],
    team: ["", "...KKK....KKK...", "..KYYYK..KYYYK..", "..KYKYK..KYKYK..", "..KYYYK..KYYYK..", "...KKK....KKK...", "..KBBBBK.KRRRRK.", ".KBBBBBBKKRRRRRK", ".KBBBBBBKKRRRRRK", ".KBBBBBBKKRRRRRK"]
  };
  Object.keys(EXTRA).forEach(function (k) { var m = EXTRA[k].map(function (r) { return (r + "................").slice(0, 16); }); while (m.length < 16) m.push("................"); PIX[k] = m; });

  /* ---------- подсветка кода ---------- */
  function hlLine(t) {
    var re = /(#.*$)|(f?"[^"]*"|f?'[^']*')|(\b\d+(?:\.\d+)?\b)|(\b(?:def|if|elif|else|for|in|return|while|import|and|or|not|True|False)\b)|(\b(?:print|input|float|int|str|len|range|upper|append|type)\b)/g;
    var out = "", last = 0, m;
    while ((m = re.exec(t))) {
      out += esc(t.slice(last, m.index));
      out += '<span class="' + (m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : m[4] ? "k" : "f") + '">' + esc(m[0]) + "</span>";
      last = re.lastIndex;
    }
    return out + esc(t.slice(last));
  }
  function codeHtml(code, cur, hl) {
    return String(code).split("\n").map(function (t, i) {
      return '<div class="ln' + (i === cur || (hl && hl.indexOf(i) >= 0) ? " cur" : "") + '"><i>' + (i + 1) + "</i><span>" + hlLine(t) + "</span></div>";
    }).join("");
  }
  function typeInto(el, text, ms) {
    if (el._tt) clearInterval(el._tt);
    if (reduced) { el.textContent = text; return; }
    var k = 0; el.textContent = "";
    el._tt = setInterval(function () { k++; el.textContent = text.slice(0, k); if (k >= text.length) { clearInterval(el._tt); el._tt = null; } }, ms || 45);
  }

  /* ---------- запускатель кода ---------- */
  function runnerHtml(id, title) {
    return '<div class="rn" data-t="' + id + '"><div class="rn-t"><span>' + esc(title || "main.py") + '</span><i>_ □ ×</i></div>' +
      '<div class="rn-m"><div class="rn-code" role="region" aria-label="Код программы"></div><div class="rn-s"><div class="rn-v"><b>ПЕРЕМЕННЫЕ</b><div class="vv"></div></div>' +
      '<div class="rn-o"><b>ВЫВОД</b><pre></pre></div></div></div>' +
      '<div class="rn-b"><button class="go">▶ Запустить</button><button class="sp">Шаг →</button><button class="rs">↺ Сначала</button><span class="st" role="status"></span></div></div>';
  }
  function initRunner(rn) {
    var T = TRACES[rn.getAttribute("data-t")], code = T.code, steps = T.steps, last = steps.length - 1;
    var i = -1, timer = null, typed = false, tt = null, prev = {};
    var cEl = rn.querySelector(".rn-code"), vv = rn.querySelector(".vv"), vh = rn.querySelector(".rn-v b"), oo = rn.querySelector(".rn-o pre"),
      stt = rn.querySelector(".st"), bGo = rn.querySelector(".go"), bSp = rn.querySelector(".sp"), bRs = rn.querySelector(".rs");
    function paint() {
      if (i < 0) { cEl.innerHTML = codeHtml(code, -1); vv.textContent = ""; vh.textContent = "ПЕРЕМЕННЫЕ"; oo.textContent = ""; stt.textContent = "Нажми «Шаг» или «Запустить»"; if (rn.onstep) rn.onstep(null); return; }
      var s = steps[i];
      cEl.innerHTML = codeHtml(code, s.l);
      vh.textContent = "ПЕРЕМЕННЫЕ" + (s.f ? " · " + s.f + "()" : "");
      var rows = Object.keys(s.v).map(function (k) { return "<tr><td>" + esc(k) + '</td><td class="' + (prev[k] !== s.v[k] ? "chg" : "") + '">' + esc(s.v[k]) + "</td></tr>"; }).join("");
      vv.innerHTML = rows ? "<table>" + rows + "</table>" : '<span class="m">пока пусто</span>';
      prev = s.v; oo.textContent = s.o; oo.parentNode.scrollTop = oo.parentNode.scrollHeight;
      stt.textContent = i === last ? "Готово ✓" : "Строка " + (s.l + 1);
      if (rn.onstep) rn.onstep(s);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } bGo.textContent = "▶ Запустить"; }
    function tick() { if (i >= last) { stopTimer(); return; } i++; paint(); if (i >= last) stopTimer(); }
    bGo.onclick = function () { if (timer) { stopTimer(); return; } if (i >= last) { i = -1; prev = {}; } bGo.textContent = "⏸ Пауза"; tick(); if (i < last) timer = setInterval(tick, 850); };
    bSp.onclick = function () { stopTimer(); if (i >= last) return; i++; paint(); };
    bRs.onclick = function () { stopTimer(); i = -1; prev = {}; paint(); };
    rn._show = function () {
      if (typed) return; typed = true;
      if (reduced) { paint(); return; }
      var k = 0, total = code.length, inc = Math.max(1, Math.ceil(total / 36));
      bGo.disabled = bSp.disabled = true;
      tt = setInterval(function () {
        k += inc;
        if (k >= total) { clearInterval(tt); tt = null; bGo.disabled = bSp.disabled = false; paint(); return; }
        cEl.innerHTML = codeHtml(code.slice(0, k), -1);
      }, 25);
    };
    rn._stop = function () { stopTimer(); if (tt) { clearInterval(tt); tt = null; bGo.disabled = bSp.disabled = false; typed = false; paint(); } };
    paint();
  }

  /* ---------- «Городской помощник» на JS: для живой консоли ---------- */
  function cityAnswer(name, d) { return name + ", рекомендуемый способ: " + (d <= 2 ? "пешком" : d <= 8 ? "на наземном транспорте" : "на метро") + "."; }
  function branchOf(d) { return d <= 2 ? 0 : d <= 8 ? 1 : 2; }

  /* ---------- калькулятор Python-выражений (без eval) ---------- */
  function calc(src) {
    var s = String(src).replace(/\s+/g, ""), p = 0;
    if (!s) throw new Error("пусто");
    function num(v, f) { return { v: v, f: f }; }
    function peek(t) { return s.substr(p, t.length) === t; }
    function atom() {
      if (peek("(")) { p++; var r = expr(); if (!peek(")")) throw new Error("SyntaxError: нет закрывающей скобки"); p++; return r; }
      var m = /^\d+(\.\d+)?/.exec(s.slice(p)); if (!m) throw new Error("SyntaxError: неверная запись"); p += m[0].length;
      return num(parseFloat(m[0]), m[1] !== undefined);
    }
    function pow() {
      var b = atom(); if (peek("**")) { p += 2; var e = unary(); var v = Math.pow(b.v, e.v); if (!isFinite(v)) throw new Error("OverflowError"); return num(v, b.f || e.f || e.v < 0); } return b;
    }
    function unary() { if (peek("-")) { p++; var r = unary(); return num(-r.v, r.f); } if (peek("+")) { p++; return unary(); } return pow(); }
    function term() {
      var l = unary();
      for (;;) {
        if (peek("//")) { p += 2; var r = unary(); if (r.v === 0) throw new Error("ZeroDivisionError: division by zero"); l = num(Math.floor(l.v / r.v), l.f || r.f); }
        else if (peek("*") && !peek("**")) { p++; var r2 = unary(); l = num(l.v * r2.v, l.f || r2.f); }
        else if (peek("/")) { p++; var r3 = unary(); if (r3.v === 0) throw new Error("ZeroDivisionError: division by zero"); l = num(l.v / r3.v, true); }
        else if (peek("%")) { p++; var r4 = unary(); if (r4.v === 0) throw new Error("ZeroDivisionError: modulo by zero"); l = num(((l.v % r4.v) + r4.v) % r4.v, l.f || r4.f); }
        else return l;
      }
    }
    function expr() {
      var l = term();
      for (;;) {
        if (peek("+")) { p++; var r = term(); l = num(l.v + r.v, l.f || r.f); }
        else if (peek("-")) { p++; var r2 = term(); l = num(l.v - r2.v, l.f || r2.f); }
        else return l;
      }
    }
    var out = expr(); if (p < s.length) throw new Error("SyntaxError: лишние символы");
    return out.f && Number.isInteger(out.v) ? out.v.toFixed(1) : String(out.v);
  }

  /* ---------- общие кирпичики для слайдов ---------- */
  window.DeckKit = {
    esc: esc, runner: runnerHtml, codeHtml: codeHtml, hl: hlLine, typeInto: typeInto, calc: calc, cityAnswer: cityAnswer, branchOf: branchOf, reduced: reduced,
    card: function (ic, title, text, cls, tag) {
      tag = tag || "div";
      return "<" + tag + ' class="cd ' + (cls || "") + '">' + (ic ? pix(ic) : "") + "<b>" + esc(title) + "</b><span>" + esc(text) + "</span></" + tag + ">";
    },
    numline: function (id) {
      var seg = function (a, b, t, bg) { return '<div class="seg" style="left:' + (a / 12 * 100) + "%;width:" + ((b - a) / 12 * 100) + "%;background:" + bg + '"><span>' + t + "</span></div>"; };
      var ticks = [0, 2, 4, 6, 8, 10, 12].map(function (x) { return '<span class="tk" style="left:' + (x / 12 * 100) + '%">' + x + "</span>"; }).join("");
      return '<div class="nl" id="' + id + '" aria-label="Числовая прямая от 0 до 12 км">' + seg(0, 2, "пешком", "#d3f0d9") + seg(2, 8, "наземный транспорт", "#d4e6ff") + seg(8, 12, "метро", "#ffe3cc") + ticks + '<div class="mk" style="left:0"><b></b></div></div>';
    },
    setMark: function (id, d) { var mk = document.querySelector("#" + id + " .mk"); if (mk) { mk.style.left = Math.max(0, Math.min(12, d)) / 12 * 100 + "%"; mk.firstChild.textContent = d + " км"; } }
  };

  /* ---------- движок ---------- */
  var stage, secs = [], cur = -1, inited = {}, tocOpen = false;
  function buildAll() {
    stage = $("stage"); var n = DECK.slides.length;
    DECK.slides.forEach(function (s, i) {
      var sec = document.createElement("section"); sec.className = "sl" + (s.cls ? " " + s.cls : ""); sec.setAttribute("aria-label", s.t);
      sec.innerHTML = '<div class="sl-h">' + pix(s.ic || "win") + "<span>" + esc(s.t) + '</span><span class="no">' + (i + 1) + " / " + n + '</span></div><div class="sl-b">' + s.html + "</div>";
      stage.appendChild(sec); secs.push(sec);
      Array.prototype.forEach.call(sec.querySelectorAll(".rn"), initRunner);
    });
    var nav = document.createElement("div"); nav.className = "fsn"; nav.innerHTML = '<button id="fp" aria-label="Назад">◀</button><button id="fn" aria-label="Дальше">▶</button><button id="fx" aria-label="Выйти из полного экрана">✕</button>';
    stage.appendChild(nav);
  }
  function stopAll(sec) { Array.prototype.forEach.call(sec.querySelectorAll(".rn"), function (r) { if (r._stop) r._stop(); }); if (sec._stop) sec._stop(); }
  function go(i, back) {
    i = Math.max(0, Math.min(secs.length - 1, i)); if (i === cur) return;
    if (cur >= 0) { stopAll(secs[cur]); secs[cur].classList.remove("on"); }
    cur = i; var sec = secs[i]; sec.classList.add("on");
    Array.prototype.forEach.call(sec.querySelectorAll(".frag"), function (f) { f.classList.toggle("show", !!back); });
    if (!inited[i]) { inited[i] = 1; var s = DECK.slides[i]; if (s.init) s.init(sec); }
    if (sec._show) sec._show();
    Array.prototype.forEach.call(sec.querySelectorAll(".rn"), function (r) { if (r._show) r._show(); });
    $("pg").textContent = (i + 1) + " / " + secs.length; $("prog").firstChild.style.width = ((i + 1) / secs.length * 100) + "%";
    $("prev").disabled = i === 0; document.title = DECK.slides[i].t + " · " + DECK.title;
    try { history.replaceState(null, "", "#" + (i + 1)); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll(".toc a"), function (a, k) { a.classList.toggle("on", k === i); });
    var nx = $("next"); nx.textContent = sec.querySelector(".frag:not(.show)") ? "Показать ▶" : "Дальше ▶";
  }
  function next() {
    var sec = secs[cur], f = sec.querySelector(".frag:not(.show)");
    if (f) { f.classList.add("show"); var rest = sec.querySelector(".frag:not(.show)"); if (!rest && cur === secs.length - 1) $("next").textContent = "Конец"; else $("next").textContent = rest ? "Показать ▶" : "Дальше ▶"; return; }
    if (cur < secs.length - 1) go(cur + 1);
  }
  function prev() { if (cur > 0) go(cur - 1, true); }
  function fit() { var w = stage.clientWidth; stage.style.setProperty("--u", (innerWidth <= 760 ? 14 : Math.max(10, Math.min(44, w / 54))) + "px"); }
  function fs() { try { if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen(); } catch (e) {} }
  function toc(open) {
    tocOpen = open; $("toc").hidden = !open; $("tocb").setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var a = $("toc").querySelector("a.on"); if (a) a.focus(); }
  }
  function init() {
    if (!window.DECK || !window.TRACES) return;
    var n = DECK.slides.length;
    buildAll();
    $("toc").innerHTML = DECK.slides.map(function (s, i) { return '<a href="#' + (i + 1) + '" data-i="' + i + '">' + pix(s.ic || "win") + "<span>" + (i + 1) + ". " + esc(s.t) + "</span></a>"; }).join("");
    $("toc").onclick = function (e) { var a = e.target.closest("a"); if (!a) return; e.preventDefault(); toc(false); go(+a.getAttribute("data-i"), true); };
    $("prog").innerHTML = '<div class="pbar"><i></i></div>';
    $("next").onclick = next; $("prev").onclick = prev; $("fsb").onclick = fs; $("tocb").onclick = function () { toc(!tocOpen); };
    $("fn").onclick = next; $("fp").onclick = prev; $("fx").onclick = fs;
    document.addEventListener("keydown", function (e) {
      var t = e.target, tag = t && t.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape" && tocOpen) { toc(false); $("tocb").focus(); return; }
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === " " && tag !== "BUTTON" && tag !== "A") { e.preventDefault(); next(); }
      else if (e.key === "Home") { e.preventDefault(); go(0, true); }
      else if (e.key === "End") { e.preventDefault(); go(secs.length - 1, true); }
      else if (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А") { fs(); }
    });
    var sx = null, sy = null;
    stage.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; if (e.target.closest("input,button,a,.rn")) sx = null; }, { passive: true });
    stage.addEventListener("touchend", function (e) { if (sx === null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)(); }, { passive: true });
    addEventListener("resize", fit); document.addEventListener("fullscreenchange", fit);
    addEventListener("hashchange", function () { var k = parseInt(location.hash.slice(1), 10); if (k >= 1 && k <= n && k - 1 !== cur) go(k - 1, true); });
    fit();
    var h = parseInt(location.hash.slice(1), 10); go(h >= 1 && h <= n ? h - 1 : 0, true);
    if (!(h >= 1)) Array.prototype.forEach.call(secs[0].querySelectorAll(".frag"), function (f) { f.classList.remove("show"); });
  }
  window.addEventListener("DOMContentLoaded", init);
})();
