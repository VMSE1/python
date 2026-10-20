/* «Честный ввод»: мешает вставить готовый код и записывает, как он набирался.
   Это сдерживание, а не гарантия: ученик может набрать чужой код руками.
   Honest.attach(textarea, {id, onBlock})  — включает защиту и учёт
   Honest.meta(textarea)                   — строка для заявки: v1;t=..;p=..;b=..;e=..;s=..;h=..
   Honest.verdict(метаданные, код)         — проверка на стороне учителя */
var Honest = (function () {
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
  function attach(ta, o) {
    o = o || {}; var key = "hn_" + (o.id || "x"), st = { t: 0, p: 0, b: 0, e: 0, s: 0 }, last = 0, lastLen = 0;
    try { var sv = JSON.parse(localStorage.getItem(key) || "null"); if (sv && typeof sv.t === "number") st = { t: sv.t | 0, p: sv.p | 0, b: sv.b | 0, e: sv.e | 0, s: sv.s | 0 }; } catch (e) {}
    function save() { try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) {} }
    function block(kind, n) { if (kind === "bulk") st.b++; else st.p++; save(); if (o.onBlock) o.onBlock(kind, n); }
    function tick() { var now = Date.now(); if (last) st.s += Math.min(30, Math.round((now - last) / 1000)); last = now; }
    ta.addEventListener("paste", function (e) { var n = 0; try { n = (e.clipboardData.getData("text") || "").length; } catch (x) {} e.preventDefault(); block("paste", n); });
    ta.addEventListener("drop", function (e) { e.preventDefault(); block("paste", 0); });
    ta.addEventListener("beforeinput", function (e) {
      var t = e.inputType || "", d = e.data == null ? "" : e.data;
      if (/^insertFrom(Paste|Drop|Yank|PasteAsQuotation)$/.test(t)) { e.preventDefault(); block("paste", d.length); return; }
      if ((t === "insertText" || t === "insertReplacementText" || t === "insertCompositionText") && d.length > BULK) { e.preventDefault(); block("bulk", d.length); return; }
    });
    ta.addEventListener("input", function (e) {
      var t = e.inputType || "", d = e.data == null ? "" : e.data;
      if (/^insert(Text|CompositionText|ReplacementText)$/.test(t)) st.t += d.length;
      else if (t === "insertLineBreak" || t === "insertParagraph") st.t += 1;
      tick(); lastLen = ta.value.length; save();
    });
    ta.addEventListener("keydown", function (e) { if (e.key === "Tab" && !e.shiftKey) { st.t += 4; save(); } });
    ta._hn = { st: st, sync: function () { lastLen = ta.value.length; }, reset: function () { st.t = st.p = st.b = st.e = st.s = 0; save(); lastLen = ta.value.length; },
      silent: function () { return ta.value.length !== lastLen; } };
    lastLen = ta.value.length;
  }
  function meta(ta) {
    var h = ta._hn; if (!h) return "";
    var st = h.st; if (h.silent()) { st.e++; h.sync(); }
    return "v1;t=" + st.t + ";p=" + st.p + ";b=" + st.b + ";e=" + st.e + ";s=" + st.s + ";h=" + hash(ta.value);
  }
  return { attach: attach, meta: meta, hash: hash, norm: norm, parse: parse, verdict: verdict };
})();
