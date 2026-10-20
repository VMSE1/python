/* Сдача без GitHub: ученик получает «код сдачи» и отправляет его учителю любым способом
   (мессенджер, почта, школьная система, файл). Учитель вставляет коды в кабинет,
   и сайт сам перепроверяет код тем же Pyodide.
   Offline.pack({n,g,t,c,m,ok}) -> "PYC1:...";  Offline.find(text) -> [токены];  Offline.unpack(токен) -> объект или null */
var Offline = (function () {
  var MAX_TOKEN = 80000, MAX_CODE = 20000;
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function b64d(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
  function line(t) { return String(t == null ? "" : t).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim(); }
  function sum(o) { return Honest.hash(o.n + "|" + o.g + "|" + o.t + "|" + o.c); }
  function pack(o) {
    var x = { n: line(o.n).slice(0, 60), g: line(o.g).slice(0, 12), t: line(o.t).slice(0, 8), c: String(o.c || "").slice(0, MAX_CODE), m: line(o.m).slice(0, 120), ok: o.ok ? 1 : 0, ts: Date.now() };
    x.k = sum(x);
    return "PYC1:" + b64e(JSON.stringify(x));
  }
  function find(text) {
    var out = [], re = /PYC1:[A-Za-z0-9_-]+/g, m, t = String(text || "").replace(/[\s​]+/g, "");
    /* мессенджеры переносят длинные строки: склеиваем и режем по префиксу */
    t.split("PYC1:").slice(1).forEach(function (p) { var q = /^[A-Za-z0-9_-]+/.exec(p); if (q && out.length < 200) out.push("PYC1:" + q[0]); });
    return out.filter(function (s) { return s.length <= MAX_TOKEN; });
  }
  function unpack(tok) {
    try {
      var o = JSON.parse(b64d(String(tok).replace(/^PYC1:/, "")));
      if (!o || typeof o !== "object" || typeof o.c !== "string") return null;
      var x = { n: line(o.n).slice(0, 60), g: line(o.g).slice(0, 12), t: line(o.t).slice(0, 8), c: o.c.slice(0, MAX_CODE), m: line(o.m).slice(0, 120), ok: o.ok ? 1 : 0, ts: +o.ts || 0 };
      if (!/^\d+\.\d+$/.test(x.t) || !x.n) return null;
      x.valid = String(o.k) === sum({ n: line(o.n).slice(0, 60), g: x.g, t: x.t, c: x.c });
      return x;
    } catch (e) { return null; }
  }
  return { pack: pack, find: find, unpack: unpack };
})();
