/* Облако слов.
   WordCloud.render(элемент, слова[, {width, height, max}])  — рисует облако (SVG).
   WordCloud.topics(issues)          — темы из заявок «[Облако]»: [{name, key, n}].
   WordCloud.fromIssues(issues, key) — слова темы: [{text, count}], где count = число разных людей.
   Слова: массив строк ["питон","цикл"] или объектов [{text:"питон", count:3}]. */
var WordCloud = (function () {
  var COLORS = ["#3a1aa0", "#b3261e", "#1b6b5a", "#8a5a00", "#2f7777", "#6a1b9a"];
  var MAX_WORDS = 5, MAX_LEN = 24, MAX_TOPIC = 40;
  function clean(t) {
    return String(t == null ? "" : t).toLowerCase().replace(/[^0-9a-zа-яё_+#\- ]/gi, "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  }
  function topicKey(t) { return String(t == null ? "" : t).toLowerCase().replace(/[^0-9a-zа-яё ]/gi, "").replace(/\s+/g, " ").trim().slice(0, MAX_TOPIC); }
  function count(words, max) {
    var m = {};
    (words || []).forEach(function (w) {
      var t = typeof w === "string" ? w : w && w.text, n = typeof w === "string" ? 1 : Math.max(1, +(w && w.count) || 1);
      t = clean(t); if (t) m[t] = (m[t] || 0) + n;
    });
    return Object.keys(m).map(function (k) { return { text: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n || (a.text < b.text ? -1 : 1); }).slice(0, max || 60);
  }
  /* Заявка учитывается, если у неё нет метки «скрыто» (так учитель убирает лишнее). */
  function parse(issues) {
    var out = [];
    (issues || []).forEach(function (x) {
      if (!x || (x.labels || []).some(function (l) { return l && l.name === "скрыто"; })) return;
      var s = typeof sections === "function" ? sections(x.body) : {};
      var name = String(s["Тема"] || "").trim().slice(0, MAX_TOPIC), key = topicKey(name);
      if (!key || !s["Слова"]) return;
      var who = (x.user && x.user.login) || "#" + x.number, seen = {}, ws = [];
      String(s["Слова"]).split(/[,;\n]/).forEach(function (w) { w = clean(w); if (w && !seen[w] && ws.length < MAX_WORDS) { seen[w] = 1; ws.push(w); } });
      if (ws.length) out.push({ name: name, key: key, who: who, words: ws });
    });
    return out;
  }
  function topics(issues) {
    var m = {};
    parse(issues).forEach(function (p) { var t = m[p.key] || (m[p.key] = { name: p.name, key: p.key, n: 0 }); t.n++; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.n - a.n || (a.key < b.key ? -1 : 1); });
  }
  function fromIssues(issues, key) {
    var by = {}, people = {};
    parse(issues).forEach(function (p) {
      if (p.key !== key) return;
      people[p.who] = 1;
      p.words.forEach(function (w) { (by[w] || (by[w] = {}))[p.who] = 1; }); /* один человек = один голос за слово */
    });
    var list = Object.keys(by).map(function (w) { return { text: w, count: Object.keys(by[w]).length }; });
    list.people = Object.keys(people).length;
    return list;
  }
  function hit(a, b) { return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y); }
  function layout(items, W, H) {
    var top = items.length ? items[0].n : 1, placed = [];
    items.forEach(function (it, i) {
      it.s = Math.round(14 + 34 * Math.sqrt(it.n / top));
      var w = it.text.length * it.s * 0.62, h = it.s * 1.1;
      for (var t = 0; t < 2500; t++) {
        var r = 2 + t * 0.9, a = t * 0.35 + i;
        var x = W / 2 + r * Math.cos(a) * 1.4 - w / 2, y = H / 2 + r * Math.sin(a) - h / 2;
        var box = { x: x, y: y, w: w, h: h };
        if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
        if (placed.some(function (p) { return hit(box, p); })) continue;
        it.x = x; it.y = y + h * 0.8; placed.push(box); return;
      }
      it.x = null; /* не поместилось, пропускаем */
    });
    return items.filter(function (it) { return it.x !== null; });
  }
  function render(el, words, opt) {
    opt = opt || {};
    var W = opt.width || 640, H = opt.height || 360, items = layout(count(words, opt.max), W, H);
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Облако слов: " + items.map(function (i) { return i.text; }).join(", "));
    svg.style.cssText = "width:100%;height:auto;display:block";
    items.forEach(function (it, i) {
      var t = document.createElementNS(ns, "text");
      t.setAttribute("x", it.x); t.setAttribute("y", it.y); t.setAttribute("font-size", it.s);
      t.setAttribute("fill", COLORS[i % COLORS.length]); t.setAttribute("font-family", "IBM Plex Mono, monospace");
      t.textContent = it.text; /* только textContent: слова пользователей не станут HTML */
      var tt = document.createElementNS(ns, "title"); tt.textContent = it.text + ": " + it.n; t.appendChild(tt);
      svg.appendChild(t);
    });
    el.textContent = ""; el.appendChild(svg);
    return items.length;
  }
  return { render: render, count: count, clean: clean, topicKey: topicKey, topics: topics, fromIssues: fromIssues, parse: parse };
})();
