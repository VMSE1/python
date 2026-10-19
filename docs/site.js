/* Общие функции сайта */
var CFG = (function () {
  var h = location.hostname, p = location.pathname.split("/")[1];
  if (/\.github\.io$/.test(h) && p) return { repo: h.split(".")[0] + "/" + p };
  return { repo: "VMSE1/python" };
})();
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function ghUrl(path) { return "https://github.com/" + CFG.repo + (path || ""); }
function layout(active, title) {
  var items = [["index.html", "Задания"], ["quiz.html", "Тест"], ["projects.html", "Проекты"], ["journal.html", "Журнал"]];
  var nav = items.map(function (x) { return '<a href="' + x[0] + '"' + (x[0] === active ? ' class="on"' : "") + ">" + x[1] + "</a>"; }).join("");
  document.body.insertAdjacentHTML("afterbegin",
    '<header class="top"><div class="wrap"><a class="logo" href="index.html"><img src="img/pitosha_happy.png" alt="">python_course</a><nav>' + nav +
    '<a href="' + ghUrl() + '" target="_blank" rel="noopener">GitHub ↗</a></nav></div></header>');
  document.body.insertAdjacentHTML("beforeend",
    '<footer><div class="wrap">Python-курс · бесплатный и открытый · <a href="' + ghUrl() + '" target="_blank" rel="noopener">исходники</a> · <a href="teacher.html">для учителя</a></div></footer>');
  if (title) document.title = title + " · Python-курс";
}
function copyText(text, btn) {
  function done() { if (btn) { var t = btn.textContent; btn.textContent = "Скопировано ✓"; setTimeout(function () { btn.textContent = t; }, 1500); } }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() { var a = document.createElement("textarea"); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (e) {} a.remove(); done(); }
}
function sections(body) {
  var out = {}; String(body || "").split(/^### /m).slice(1).forEach(function (ch) {
    var i = ch.indexOf("\n"); out[ch.slice(0, i).trim()] = ch.slice(i + 1).trim();
  }); return out;
}
function fetchIssues(label, cb, fail) {
  var all = [], page = 1;
  (function next() {
    fetch("https://api.github.com/repos/" + CFG.repo + "/issues?state=all&per_page=100&page=" + page + "&labels=" + encodeURIComponent(label))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (a) { all = all.concat(a.filter(function (x) { return !x.pull_request; })); if (a.length === 100 && page < 5) { page++; next(); } else cb(all); })
      .catch(function (e) { fail(e); });
  })();
}
