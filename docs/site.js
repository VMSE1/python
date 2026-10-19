/* Общие функции сайта */
var CFG = (function () {
  var h = location.hostname, p = location.pathname.split("/")[1];
  if (/\.github\.io$/.test(h) && p) return { repo: h.split(".")[0] + "/" + p };
  return { repo: "VMSE1/python" };
})();
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function md(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }
function ghUrl(path) { return "https://github.com/" + CFG.repo + (path || ""); }

/* Иконки: один набор, одна толщина линии */
var ICON = {
  logo: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--accent)"/><path d="M12 11l-5 5 5 5M20 11l5 5-5 5M17.5 9l-3 14" stroke="var(--accent-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  l1: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="9" width="46" height="38" rx="7"/><path d="M5 19h46M15 29l7 5-7 5M27 39h12"/></svg>',
  l2: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="28" cy="10" r="5"/><circle cx="12" cy="46" r="5"/><circle cx="44" cy="46" r="5"/><path d="M28 15v10M28 25L12 41M28 25l16 16"/></svg>',
  l3: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--amber)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M44 20a17 17 0 00-30-3M12 36a17 17 0 0030 3"/><path d="M44 9v11H33M12 47V36h11"/></svg>',
  l4: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 8c-6 0-8 3-8 8v5c0 4-2 7-6 7 4 0 6 3 6 7v5c0 5 2 8 8 8M36 8c6 0 8 3 8 8v5c0 4 2 7 6 7-4 0-6 3-6 7v5c0 5-2 8-8 8"/><path d="M23 24h10M23 32h6"/></svg>',
  l5: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M28 6l17 6v13c0 11-7 19-17 23C18 44 11 36 11 25V12z"/><path d="M20 28l6 6 11-12"/></svg>'
};
function lessonIcon(n) { return ICON["l" + ((n - 1) % 5 + 1)]; }

function applyTheme(t) {
  if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
}
(function () { try { var t = localStorage.getItem("theme"); if (t) applyTheme(t); } catch (e) {} })();

function getToken() { try { return sessionStorage.getItem("tk") || localStorage.getItem("tk") || ""; } catch (e) { return ""; } }
function isTeacher() { try { return !!localStorage.getItem("teacher"); } catch (e) { return false; } }
function layout(active, title) {
  var items = [["index.html", "Задания"], ["theory.html", "Теория"], ["quiz.html", "Тест"], ["projects.html", "Проекты"]];
  if (isTeacher()) items.push(["teacher.html", "Кабинет"]);
  var nav = items.map(function (x) { return '<a href="' + x[0] + '"' + (x[0] === active ? ' class="on"' : "") + ">" + x[1] + "</a>"; }).join("");
  document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="guide.css">');
  document.body.insertAdjacentHTML("afterbegin",
    '<header class="top"><div class="wrap"><a class="logo" href="index.html">' + ICON.logo + 'Python-курс</a><nav>' + nav +
    '<button id="guideBtn">Как это работает</button><a href="' + ghUrl() + '" target="_blank" rel="noopener">GitHub</a><button id="themeBtn" title="Тема: светлая / тёмная" aria-label="Сменить тему">' + ICON.sun + '</button></nav></div></header>');
  var gs = document.createElement("script"); gs.src = "guide.js";
  gs.onload = function () { if (/[?&]guide=1/.test(location.search)) window.openGuide(0); if (window.__guideAuto) window.openGuide(0); };
  document.body.appendChild(gs);
  document.getElementById("guideBtn").onclick = function () { if (window.openGuide) window.openGuide(0); };
  document.getElementById("themeBtn").onclick = function () {
    var cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    var next = cur === "light" ? "dark" : "light"; applyTheme(next); try { localStorage.setItem("theme", next); } catch (e) {}
  };
  document.body.insertAdjacentHTML("beforeend",
    '<footer><div class="wrap">Python-курс · бесплатный и открытый · <a href="' + ghUrl() + '" target="_blank" rel="noopener">исходники</a></div></footer>');
  if (title) document.title = title + " · Python-курс";
}
function copyText(text, btn) {
  function done() { if (btn) { var t = btn.textContent; btn.textContent = "Скопировано"; setTimeout(function () { btn.textContent = t; }, 1500); } }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() { var a = document.createElement("textarea"); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (e) {} a.remove(); done(); }
}
function plate(p) {
  return '<div class="plate' + (p.k === "warn" ? " warn" : "") + '">' + (p.k === "warn" ? '<span class="tag">Осторожно</span>' : "") +
    "<h3>" + esc(p.t) + "</h3><p>" + md(p.x) + "</p>" + (p.c ? "<pre>" + esc(p.c) + "</pre>" : "") + "</div>";
}
function sections(body) {
  var out = {}; String(body || "").split(/^### /m).slice(1).forEach(function (ch) {
    var i = ch.indexOf("\n"); out[ch.slice(0, i).trim()] = ch.slice(i + 1).trim();
  }); return out;
}
function fetchIssues(label, cb, fail) {
  var all = [], page = 1;
  (function next() {
    var h = { Accept: "application/vnd.github+json" }, tk = getToken(); if (tk) h.Authorization = "Bearer " + tk;
    fetch("https://api.github.com/repos/" + CFG.repo + "/issues?state=all&per_page=100&page=" + page + "&labels=" + encodeURIComponent(label), { headers: h })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (a) { all = all.concat(a.filter(function (x) { return !x.pull_request; })); if (a.length === 100 && page < 5) { page++; next(); } else cb(all); })
      .catch(function (e) { fail(e); });
  })();
}
