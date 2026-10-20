/* Общие функции сайта */
var CFG = (function () {
  var h = location.hostname, p = location.pathname.split("/")[1];
  if (/\.github\.io$/.test(h) && p) return { repo: h.split(".")[0] + "/" + p };
  return { repo: "VMSE1/python" };
})();
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function md(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }
function ghUrl(path) { return "https://github.com/" + CFG.repo + (path || ""); }

/* Пиксельные иконки: карта символов -> палитра, рисуется SVG с чёткими квадратами */
var PAL = { K: "#1a0f4d", W: "#ffffff", G: "#c0c0c0", D: "#808080", Y: "#ffe44d", O: "#c9a000", B: "#3a1aa0", L: "#4aa3ff", R: "#d03030", P: "#7a1a8a", N: "#2a9a2a", T: "#2f7777", C: "#fffbdc" };
var PIX = {
  pc: ["................", "..KKKKKKKKKKKK..", "..KGGGGGGGGGGK..", "..KGKKKKKKKKGK..", "..KGKLLLLLLKGK..", "..KGKLWWLLLKGK..", "..KGKLLLWWLKGK..", "..KGKLLLLLLKGK..", "..KGKKKKKKKKGK..", "..KGGGGGGGNGGK..", "..KKKKKKKKKKKK..", "......KGGK......", "...KKKKGGKKKK...", "..KGGGGGGGGGGK..", "..KKKKKKKKKKKK..", "................"],
  folder: ["................", "..KKKKK.........", ".KYYYYYK........", ".KYYYYYKKKKKKK..", ".KYWWWWWWWWWWYK.", ".KYWYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KOOOOOOOOOOOOK.", ".KKKKKKKKKKKKKK.", "................", "................", "................"],
  book: ["................", "...KKKKKKKKKK...", "..KPPPPPPPPPPK..", "..KPPPPYYYYPPK..", "..KPPPYYPPYYPK..", "..KPPPPPPPYYPK..", "..KPPPPPYYYPPK..", "..KPPPPPYYPPPK..", "..KPPPPPPPPPPK..", "..KPPPPPYYPPPK..", "..KPPPPPPPPPPK..", "..KWWWWWWWWWWK..", "..KWGWGWGWGWGK..", "..KKKKKKKKKKKK..", "................", "................"],
  disk: ["................", ".KKKKKKKKKKKKK..", ".KBBGGGGGGGBBK..", ".KBBGGGGGGGBBK..", ".KBBGGGGGGGBBK..", ".KBBBBBBBBBBBK..", ".KBBBBBBBBBBBK..", ".KBWWWWWWWWWBK..", ".KBWWKKKKKKWBK..", ".KBWWWWWWWWWBK..", ".KBWWKKKKKKWBK..", ".KBWWWWWWWWWBK..", ".KBBBBBBBBBBBK..", ".KKKKKKKKKKKKK..", "................", "................"],
  key: ["................", ".....KKKK.......", "....KYYYYK......", "...KYYKKYYK.....", "...KYYKKYYK.....", "....KYYYYK......", ".....KYYK.......", ".....KYK........", ".....KYYK.......", ".....KYK........", ".....KYYYK......", ".....KYK........", ".....KKK........", "................", "................", "................"],
  help: ["................", "...KKKKKKKKKK...", "..KBBBBBBBBBBK..", ".KBBBBWWWWBBBBK.", ".KBBBWWBBWWBBBK.", ".KBBBBBBBWWBBBK.", ".KBBBBBBWWBBBBK.", ".KBBBBBWWBBBBBK.", ".KBBBBBWWBBBBBK.", ".KBBBBBBBBBBBBK.", ".KBBBBBWWBBBBBK.", ".KBBBBBWWBBBBBK.", "..KBBBBBBBBBBK..", "...KKKKKKKKKK...", "................", "................"],
  doc: ["................", "..KKKKKKKKK.....", "..KWWWWWWKK.....", "..KWWWWWWKWK....", "..KWBBBBWKKKK...", "..KWWWWWWWWWK...", "..KWBBBBBBBWK...", "..KWWWWWWWWWK...", "..KWBBBBBBBWK...", "..KWWWWWWWWWK...", "..KWBBBBBWWWK...", "..KWWWWWWWWWK...", "..KKKKKKKKKKK...", "................", "................", "................"],
  check: ["................", "............KK..", "...........KWK..", "..........KWK...", ".........KWK....", ".KK.....KWK.....", ".KWK...KWK......", "..KWK.KWK.......", "...KWKWK........", "....KWK.........", ".....K..........", "................", "................", "................", "................", "................"],
  video: ["................", ".KKKKKKKKKKKKKK.", ".KBBBBBBBBBBBBK.", ".KBBYBBBBBBBBBK.", ".KBBYYBBBBBBBBK.", ".KBBYYYBBBBBBBK.", ".KBBYYYYBBBBBBK.", ".KBBYYYBBBBBBBK.", ".KBBYYBBBBBBBBK.", ".KBBYBBBBBBBBBK.", ".KBBBBBBBBBBBBK.", ".KKKKKKKKKKKKKK.", "......KKKK......", ".....KKKKKK.....", "................", "................"],
  game: ["................", "................", "..KKKKKKKKKKKK..", ".KGGGGGGGGGGGGK.", ".KGGGBGGGGGGYGK.", ".KGGBBBGGGGGGYK.", ".KGGGBGGGGYGGGK.", ".KGGGGGGGGGGGGK.", "..KGGGGGGGGGGK..", "...KKKKKKKKKK...", "................", "................", "................", "................", "................", "................"],
  win: ["................", ".KKKKKKKKKKKKKK.", ".KBBBBBBBBBBBBK.", ".KBWBBBBBBBBBBK.", ".KGGGGGGGGGGGGK.", ".KGWWWWWWWWWWGK.", ".KGWWWWWWWWWWGK.", ".KGWWWWWWWWWWGK.", ".KGWWWWWWWWWWGK.", ".KGGGGGGGGGGGGK.", ".KKKKKKKKKKKKKK.", "................", "................", "................", "................", "................"]
};
function pix(name, cls) {
  var m = PIX[name]; if (!m) return ""; var r = "";
  for (var y = 0; y < 16; y++) { var row = (m[y] || ""), x = 0; while (x < 16) { var c = row.charAt(x); if (!c || c === ".") { x++; continue; } var s = x; while (row.charAt(x) === c && x < 16) x++; r += '<rect x="' + s + '" y="' + y + '" width="' + (x - s) + '" height="1" fill="' + PAL[c] + '"/>'; } }
  return '<svg class="pix ' + (cls || "") + '" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">' + r + "</svg>";
}
var LESSON_ICONS = ["doc", "folder", "book", "disk", "pc"];
function lessonIcon(n) { return pix(LESSON_ICONS[(n - 1) % 5]); }
var ARROW_SVG = '<svg viewBox="0 0 8 8" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M0 3h5V1h1v1h1v1h1v2H7v1H6v1H5V5H0z"/></svg>';

function applyTheme() {}
function getToken() {
  try {
    var s = sessionStorage.getItem("tk"); if (s) return s;
    var at = +localStorage.getItem("tkAt") || 0;
    if (localStorage.getItem("tk") && Date.now() - at > 7 * 864e5) { localStorage.removeItem("tk"); localStorage.removeItem("tkAt"); localStorage.removeItem("teacher"); return ""; }
    return localStorage.getItem("tk") || "";
  } catch (e) { return ""; }
}
/* защита от показа сайта во фрейме на чужой странице (clickjacking) */
try { if (window.top !== window.self) { document.documentElement.style.display = "none"; window.top.location = window.self.location; } } catch (e) { document.documentElement.style.display = "none"; }
function isTeacher() { try { return !!localStorage.getItem("teacher"); } catch (e) { return false; } }
var PAGES = {
  "tasks.html": ["Задания", "pc"], "theory.html": ["Теория", "folder"], "quiz.html": ["Квизы", "book"],
  "projects.html": ["Проекты ребят", "disk"], "cloud.html": ["Облако слов", "win"], "slides.html": ["Презентации", "doc"], "video.html": ["Видеоразборы", "video"], "games.html": ["Игры", "game"], "teacher.html": ["Кабинет учителя", "key"]
};
function layout(active, title) {
  var desk = active === "desk", pg = PAGES[active] || ["Окно", "win"];
  var teacher = isTeacher();
  document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="guide.css">');
  if (!desk) {
    var main = document.querySelector("main.wrap");
    if (main) {
      var ttl = "C:\\Python\\" + (title || pg[0]);
      main.innerHTML = '<div class="tbar">' + pix(pg[1]) + '<span class="ti">' + esc(ttl) + '</span>' +
        '<a class="wb" id="wBack" href="index.html" title="Назад">&#9664;<span> Назад</span></a>' +
        '<a class="wb" href="index.html" title="Закрыть окно и вернуться на рабочий стол">&#10005;<span> Закрыть</span></a></div><div class="in">' + main.innerHTML + "</div>";
      document.getElementById("wBack").onclick = function (e) {
        var ok = false; try { ok = history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin; } catch (x) {}
        if (ok) { e.preventDefault(); history.back(); }
      };
    }
  }
  var items = [["tasks.html", "Задания", "pc"], ["theory.html", "Теория", "folder"], ["quiz.html", "Квизы", "book"], ["projects.html", "Проекты ребят", "disk"], ["cloud.html", "Облако слов", "win"], ["slides.html", "Презентации", "doc"], ["video.html", "Видеоразборы", "video"], ["games.html", "Игры", "game"]];
  items.push(["teacher.html", teacher ? "Кабинет учителя" : "Вход для учителя", "key"]);
  var menu = items.map(function (x) { return '<li><a href="' + x[0] + '">' + pix(x[2]) + x[1] + "</a></li>"; }).join("") +
    '<hr><li><a href="#" id="guideBtn">' + pix("help") + 'Как это работает</a></li>' +
    '<li><a href="index.html">' + pix("win") + 'Рабочий стол</a></li>' +
    '<li><a href="' + ghUrl() + '" target="_blank" rel="noopener">' + pix("doc") + 'Исходники (GitHub)</a></li>';
  document.body.insertAdjacentHTML("beforeend",
    '<div class="smenu" id="smenu"><div class="side">PYTHON</div><ul>' + menu + '</ul></div>' +
    '<div class="taskbar"><button class="start" id="startBtn" aria-expanded="false" aria-controls="smenu">' + pix("win") + 'Пуск</button>' +
    (desk ? "" : '<a class="tbtn" href="' + (location.pathname.split("/").pop() || "index.html") + location.search + '">' + pix(pg[1]) + esc(title || pg[0]) + "</a>") +
    '<div class="clock" id="clock"></div></div>');
  var sm = document.getElementById("smenu"), sb = document.getElementById("startBtn");
  function setMenu(on) { sm.classList.toggle("on", on); sb.setAttribute("aria-expanded", on ? "true" : "false"); }
  sb.onclick = function (e) { e.stopPropagation(); setMenu(!sm.classList.contains("on")); };
  document.addEventListener("click", function (e) { if (!sm.contains(e.target)) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  function tick() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    document.getElementById("clock").innerHTML = "<div><b>" + p(d.getHours()) + ":" + p(d.getMinutes()) + "</b><small>" + p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() + "</small></div>"; }
  tick(); setInterval(tick, 20000);
  var gs = document.createElement("script"); gs.src = "guide.js";
  gs.onload = function () { if (/[?&]guide=1/.test(location.search)) window.openGuide(0); if (window.__guideAuto) window.openGuide(0); };
  document.body.appendChild(gs);
  document.getElementById("guideBtn").onclick = function (e) { e.preventDefault(); setMenu(false); if (window.openGuide) window.openGuide(0); };
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
