/* «Честный ввод»: мешает вставить готовый код и записывает, как он набирался.
   Это сдерживание, а не гарантия: ученик может набрать чужой код руками.
   Honest.attach(textarea, {id, onBlock})  — включает защиту и учёт
   Honest.code(textarea)                   — надёжный текст кода (всё, что набрано руками)
   Honest.restart(textarea)                — «Сбросить»: заготовка и нулевые счётчики
   Honest.meta(textarea)                   — строка для заявки: v1;t=..;p=..;b=..;e=..;s=..;h=..
   Honest.verdict(метаданные, код)         — проверка на стороне учителя */
var Honest = (function () {
  var MAXC = 8000; /* больше символов в решении быть не может: задания короткие */
  var BULK = 25; /* больше символов за одно действие «набора» = вставка кусками (автодополнение ИИ, диктовка) */
  function norm(t) { return String(t == null ? "" : t).replace(/\r\n?/g, "\n").split("\n").map(function (l) { return l.replace(/\s+$/, ""); }).join("\n").trim(); }
  function hash(t) {
    var s = unescape(encodeURIComponent(norm(t))), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("00000000" + h.toString(16)).slice(-8);
  }
  function parse(s) {
    var m = /^v1;/.test(String(s || "").trim()) ? {} : null; if (!m) return null;
    String(s).trim().split(";").slice(1).forEach(function (p) { var kv = p.split("="); if (kv.length === 2 && /^[tpbesh]$/.test(kv[0])) m[kv[0]] = kv[0] === "h" ? kv[1].slice(0, 8) : Math.max(0, parseInt(kv[1], 10) || 0); });
    return m;
  }
  function verdict(m, code) {
    if (!m) return { level: "none", reasons: ["отправлено не через сайт или без служебного поля"] };
    var r = [], len = norm(code).length;
    if (m.h && m.h !== hash(code)) r.push("код изменён после сайта");
    if (m.p > 0) r.push("пытался вставить: " + m.p);
    if (m.b > 0) r.push("вставка кусками: " + m.b);
    if (m.e > 0) r.push("код изменён скриптом");
    if (len >= 60 && (m.t || 0) < len * 0.4) r.push("набрано " + (m.t || 0) + " из " + len + " символов");
    if (m.s > 0 && (m.t || 0) / m.s > 12) r.push("слишком быстрый набор");
    return { level: r.length ? "warn" : "ok", reasons: r };
  }
  var NAT = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  var TEST = false; /* тестовый стенд подменяет это значение на true; на сайте всегда false */
  var RATE = 40;    /* больше символов в секунду человек не набирает */
  var S = typeof WeakMap === "function" ? new WeakMap() : null;
  /* Защита опирается на «эталонный текст» (shadow): он живёт внутри замыкания и меняется только
     настоящими (isTrusted) событиями набора. Всё, что поменяло поле в обход (консоль, скрипт,
     подделанное событие), откатывается, а попытка записывается в счётчик e. */
  function attach(ta, o) {
    o = o || {}; try { ta.maxLength = MAXC; } catch (e) {} var id = o.id || "x", key = "hn_" + id, ckey = "hnc_" + id, st = { t: 0, p: 0, b: 0, e: 0, s: 0 }, last = 0, win = [];
    try { var sv = JSON.parse(localStorage.getItem(key) || "null"); if (sv && typeof sv.t === "number") st = { t: sv.t | 0, p: sv.p | 0, b: sv.b | 0, e: sv.e | 0, s: sv.s | 0 }; } catch (e) {}
    var shadow = NAT.get.call(ta), hist = [shadow], initial = o.starter != null ? o.starter : shadow;
    try { var hc = localStorage.getItem(ckey); if (hc && hc !== hash(shadow)) st.e++; } catch (e) {}
    function save() { try { localStorage.setItem(key, JSON.stringify(st)); localStorage.setItem(ckey, hash(shadow)); } catch (e) {} }
    function say(kind, n) { if (o.onBlock) o.onBlock(kind, n); }
    function block(kind, n) { if (kind === "bulk") st.b++; else st.p++; save(); say(kind, n); }
    function remember(v) { shadow = v; if (hist[hist.length - 1] !== v) { hist.push(v); if (hist.length > 200) hist.shift(); } }
    function put(v) { NAT.set.call(ta, v); }
    function revert(kind) {
      var s = 0; try { s = ta.selectionStart; } catch (e) {}
      put(shadow); try { ta.selectionStart = ta.selectionEnd = Math.min(s, shadow.length); } catch (e) {}
      st.e++; save(); say(kind || "script", 0);
    }
    function verify() { if (NAT.get.call(ta) !== shadow) revert("script"); }
    function tick() { var now = Date.now(); if (last) st.s += Math.min(30, Math.round((now - last) / 1000)); last = now; }
    function tooFast(n) { var now = Date.now(), sum = 0; while (win.length && now - win[0][0] > 1000) win.shift(); win.forEach(function (w) { sum += w[1]; }); if (sum + n > RATE) return true; win.push([now, n]); return false; }
    /* присваивание ta.value = "..." из консоли ничего не меняет */
    Object.defineProperty(ta, "value", { configurable: true, get: function () { return NAT.get.call(ta); }, set: function () { st.e++; save(); say("script", 0); } });
    ta.addEventListener("paste", function (e) { var n = 0; try { n = (e.clipboardData.getData("text") || "").length; } catch (x) {} e.preventDefault(); block("paste", n); }, true);
    ta.addEventListener("drop", function (e) { e.preventDefault(); block("paste", 0); }, true);
    ta.addEventListener("beforeinput", function (e) {
      var t = e.inputType || "", d = e.data == null ? "" : e.data;
      if (!e.isTrusted) { e.preventDefault(); st.e++; save(); say("script", 0); return; }
      if (NAT.get.call(ta) !== shadow) revert("script");
      if (/^insertFrom(Paste|Drop|Yank|PasteAsQuotation)$/.test(t)) { e.preventDefault(); block("paste", d.length); return; }
      if ((t === "insertText" || t === "insertReplacementText" || t === "insertCompositionText") && d.length > BULK) { e.preventDefault(); block("bulk", d.length); return; }
    }, true);
    ta.addEventListener("input", function (e) {
      if (!e.isTrusted) { e.stopImmediatePropagation(); verify(); return; }
      var t = e.inputType || "", d = e.data == null ? "" : e.data, v = NAT.get.call(ta);
      var undo = /^history(Undo|Redo)$/.test(t);
      var grow = v.length - shadow.length;
      if (!undo && grow > 0 && v.length > MAXC) { e.stopImmediatePropagation(); put(shadow); say("size", 0); return; }
      if ((undo && hist.indexOf(v) < 0) || (!undo && (grow > BULK + 5 || (grow > 0 && tooFast(grow))))) { e.stopImmediatePropagation(); revert(undo ? "script" : "bulk"); if (!undo) { st.e--; st.b++; save(); } return; }
      if (/^insert(Text|CompositionText|ReplacementText)$/.test(t)) st.t += d.length;
      else if (t === "insertLineBreak" || t === "insertParagraph") st.t += 1;
      remember(v); tick(); save();
    }, true);
    ta.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      var ok = false; try { ok = document.execCommand("insertText", false, "    "); } catch (x) {}
      if (!ok) { var sp = ta.selectionStart, v = NAT.get.call(ta); put(v.slice(0, sp) + "    " + v.slice(ta.selectionEnd)); ta.selectionStart = ta.selectionEnd = sp + 4; st.t += 4; remember(NAT.get.call(ta)); save(); if (ta.oninput) ta.oninput(); }
    }, true);
    var h = { verify: verify, code: function () { verify(); return shadow; }, st: function () { return st; },
      restart: function () { put(initial); shadow = initial; hist = [initial]; st.t = st.p = st.b = st.e = st.s = 0; last = 0; save(); },
      fill: function (text) { put(text); remember(text); save(); if (ta.oninput) ta.oninput(); } };
    if (S) S.set(ta, h); save();
  }
  function H(ta) { var h = S && S.get(ta); if (!h) throw new Error("Honest: поле не подключено"); return h; }
  function code(ta) { var h = S && S.get(ta); return h ? h.code() : ta.value; }
  function meta(ta) {
    var h = S && S.get(ta); if (!h) return "";
    var c = h.code(), st = h.st();
    return "v1;t=" + st.t + ";p=" + st.p + ";b=" + st.b + ";e=" + st.e + ";s=" + st.s + ";h=" + hash(c);
  }
  var api = { attach: attach, code: code, meta: meta, restart: function (ta) { H(ta).restart(); }, hash: hash, norm: norm, parse: parse, verdict: verdict };
  if (TEST) api._fill = function (ta, text) { H(ta).fill(text); };
  return api;
})();
