/* Облако слов. Только отрисовка, без хранения.
   WordCloud.render(элемент, слова[, {width, height, max}])
   слова: массив строк ["питон","цикл","питон"] или объектов [{text:"питон", count:3}]. */
var WordCloud = (function () {
  var COLORS = ["#3a1aa0", "#b3261e", "#1b6b5a", "#8a5a00", "#2f7777", "#6a1b9a"];
  function count(words, max) {
    var m = {};
    (words || []).forEach(function (w) {
      var t = typeof w === "string" ? w : w && w.text, n = typeof w === "string" ? 1 : Math.max(1, +(w && w.count) || 1);
      t = String(t == null ? "" : t).toLowerCase().replace(/[^0-9a-zа-яё_+#\- ]/gi, "").replace(/\s+/g, " ").trim().slice(0, 24);
      if (t) m[t] = (m[t] || 0) + n;
    });
    return Object.keys(m).map(function (k) { return { text: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n || (a.text < b.text ? -1 : 1); }).slice(0, max || 60);
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
  return { render: render, count: count };
})();
