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
  logo: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="9" fill="#ffd84a" stroke="#1c2340" stroke-width="2.4"/><path d="M12.5 11.5L8 16l4.5 4.5M19.5 11.5L24 16l-4.5 4.5M17.3 9.5l-2.6 13" stroke="#1c2340" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  l1: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="9" width="46" height="38" rx="8" fill="var(--st3)"/><path d="M5 20h46"/><path d="M15 31l7 5-7 5M27 41h12"/></svg>',
  l2: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M28 15v10M28 25L12 41M28 25l16 16"/><circle cx="28" cy="10" r="6" fill="var(--yellow)"/><circle cx="12" cy="46" r="6" fill="var(--st2)"/><circle cx="44" cy="46" r="6" fill="var(--st3)"/></svg>',
  l3: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="28" cy="28" r="20" fill="var(--st5)"/><path d="M39 21a13 13 0 00-22-2M17 35a13 13 0 0022 2"/><path d="M40 11v10H30M16 45V35h10"/></svg>',
  l4: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="44" height="44" rx="10" fill="var(--st4)"/><path d="M22 14c-5 0-6 2-6 6v3c0 3-2 5-5 5 3 0 5 2 5 5v3c0 4 1 6 6 6M34 14c5 0 6 2 6 6v3c0 3 2 5 5 5-3 0-5 2-5 5v3c0 4-1 6-6 6"/></svg>',
  l5: '<svg viewBox="0 0 56 56" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M28 5l18 6.5V26c0 11-7.5 19.5-18 24C17.500 45.500 10 37 10 26V11.500z" fill="var(--st1)"/><path d="M19 28l7 7 12-13"/></svg>'
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
    var cur = document.documentElement.getAttribute("data-theme") || "light";
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
