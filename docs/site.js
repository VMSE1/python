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
  skull: ["................","....KKKKKKKK....","...KWWWWWWWWK...","..KWWWWWWWWWWK..","..KWWWWWWWWWWK..","..KWKKKWWKKKWK..","..KWKKKWWKKKWK..","..KWWKKWWKKWWK..","...KWWWKKWWWK...","....KWWWWWWK....","....KWKWKWKK....","....KWKWKWK.....",".....KKKKKK.....","................","................","................"],
  user: ["................",".....KKKKKK.....","....KYYYYYYK....","....KYKYYKYK....","....KYYYYYYK....",".....KYYYYK.....","...KKKBBBBKKK...","..KBBBBBBBBBBK..",".KBBBBBBBBBBBBK.",".KBBBBBBBBBBBBK.",".KBBBBBBBBBBBBK.",".KKKKKKKKKKKKKK.","................","................","................","................"],
  bolt: ["................",".......KKKK.....","......KYYYK.....",".....KYYYK......","....KYYYK.......","...KYYYYYYK.....","....KKKYYK......","......KYYK......",".....KYYK.......",".....KYK........","....KYK.........","....KK..........","................","................","................","................"],
  pc: ["................", "..KKKKKKKKKKKK..", "..KGGGGGGGGGGK..", "..KGKKKKKKKKGK..", "..KGKLLLLLLKGK..", "..KGKLWWLLLKGK..", "..KGKLLLWWLKGK..", "..KGKLLLLLLKGK..", "..KGKKKKKKKKGK..", "..KGGGGGGGNGGK..", "..KKKKKKKKKKKK..", "......KGGK......", "...KKKKGGKKKK...", "..KGGGGGGGGGGK..", "..KKKKKKKKKKKK..", "................"],
  folder: ["................", "..KKKKK.........", ".KYYYYYK........", ".KYYYYYKKKKKKK..", ".KYWWWWWWWWWWYK.", ".KYWYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KYYYYYYYYYYYYK.", ".KOOOOOOOOOOOOK.", ".KKKKKKKKKKKKKK.", "................", "................", "................"],
  book: ["................", "...KKKKKKKKKK...", "..KPPPPPPPPPPK..", "..KPPPPYYYYPPK..", "..KPPPYYPPYYPK..", "..KPPPPPPPYYPK..", "..KPPPPPYYYPPK..", "..KPPPPPYYPPPK..", "..KPPPPPPPPPPK..", "..KPPPPPYYPPPK..", "..KPPPPPPPPPPK..", "..KWWWWWWWWWWK..", "..KWGWGWGWGWGK..", "..KKKKKKKKKKKK..", "................", "................"],
  disk: ["................", ".KKKKKKKKKKKKK..", ".KBBGGGGGGGBBK..", ".KBBGGGGGGGBBK..", ".KBBGGGGGGGBBK..", ".KBBBBBBBBBBBK..", ".KBBBBBBBBBBBK..", ".KBWWWWWWWWWBK..", ".KBWWKKKKKKWBK..", ".KBWWWWWWWWWBK..", ".KBWWKKKKKKWBK..", ".KBWWWWWWWWWBK..", ".KBBBBBBBBBBBK..", ".KKKKKKKKKKKKK..", "................", "................"],
  key: ["................", ".....KKKK.......", "....KYYYYK......", "...KYYKKYYK.....", "...KYYKKYYK.....", "....KYYYYK......", ".....KYYK.......", ".....KYK........", ".....KYYK.......", ".....KYK........", ".....KYYYK......", ".....KYK........", ".....KKK........", "................", "................", "................"],
  help: ["................", "...KKKKKKKKKK...", "..KBBBBBBBBBBK..", ".KBBBBWWWWBBBBK.", ".KBBBWWBBWWBBBK.", ".KBBBBBBBWWBBBK.", ".KBBBBBBWWBBBBK.", ".KBBBBBWWBBBBBK.", ".KBBBBBWWBBBBBK.", ".KBBBBBBBBBBBBK.", ".KBBBBBWWBBBBBK.", ".KBBBBBWWBBBBBK.", "..KBBBBBBBBBBK..", "...KKKKKKKKKK...", "................", "................"],
  doc: ["................", "..KKKKKKKKK.....", "..KWWWWWWKK.....", "..KWWWWWWKWK....", "..KWBBBBWKKKK...", "..KWWWWWWWWWK...", "..KWBBBBBBBWK...", "..KWWWWWWWWWK...", "..KWBBBBBBBWK...", "..KWWWWWWWWWK...", "..KWBBBBBWWWK...", "..KWWWWWWWWWK...", "..KKKKKKKKKKK...", "................", "................", "................"],
  check: ["................", "............KK..", "...........KWK..", "..........KWK...", ".........KWK....", ".KK.....KWK.....", ".KWK...KWK......", "..KWK.KWK.......", "...KWKWK........", "....KWK.........", ".....K..........", "................", "................", "................", "................", "................"],
  video: ["................", ".KKKKKKKKKKKKKK.", ".KBBBBBBBBBBBBK.", ".KBBYBBBBBBBBBK.", ".KBBYYBBBBBBBBK.", ".KBBYYYBBBBBBBK.", ".KBBYYYYBBBBBBK.", ".KBBYYYBBBBBBBK.", ".KBBYYBBBBBBBBK.", ".KBBYBBBBBBBBBK.", ".KBBBBBBBBBBBBK.", ".KKKKKKKKKKKKKK.", "......KKKK......", ".....KKKKKK.....", "................", "................"],
  books: ["................", "..KKKKKKKKKKKK..", "..KRRRRRRRRRRK..", "..KRWWWWWWWWRK..", "..KKKKKKKKKKKK..", ".KKKKKKKKKKKK...", ".KLLLLLLLLLLK...", ".KLWWWWWWWWLK...", ".KKKKKKKKKKKK...", "...KKKKKKKKKKKK.", "...KNNNNNNNNNNK.", "...KNWWWWWWWWNK.", "...KKKKKKKKKKKK.", "................", "................", "................"],
  cube: ["................", "......KKKK......", "....KKLLLLKK....", "..KKLLLLLLLLKK..", ".KLLLLLLLLLLLLK.", ".KBBLLLLLLLLYYK.", ".KBBBBLLLLYYYYK.", ".KBBBBBBYYYYYYK.", ".KBBBBBBYYYYYYK.", ".KBBBBBBYYYYYYK.", ".KBBBBBBYYYYYYK.", "..KKBBBBYYYYKK..", "....KKBBYYKK....", "......KKKK......", "................", "................"],
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
/* Игры (аркада) открывает учитель кнопкой: сервер сообщает apps.games в /api/play, браузер запоминает в appsGames. Без сервера или у учителя аркада всегда открыта. */
function appsOpen() {
  try { if (localStorage.getItem("teacher") || sessionStorage.getItem("tkey")) return true; } catch (e) {}
  var v = ""; try { v = localStorage.getItem("appsGames") || ""; } catch (e) {}
  return v ? v === "1" : !window.API_BASE;
}
function isTeacher() { try { return !!localStorage.getItem("teacher"); } catch (e) { return false; } }
var PAGES = {
  "tasks.html": ["Задания", "pc"], "theory.html": ["Теория", "folder"], "quiz.html": ["Квизы", "book"],
  "projects.html": ["Проекты ребят", "disk"], "cloud.html": ["Облако слов", "win"], "slides.html": ["Презентации", "doc"], "video.html": ["Видеоразборы", "video"], "leaders.html": ["Таблица лидеров", "bolt"], "spy.html": ["Шпион", "user"], "teacher.html": ["Кабинет учителя", "key"], "ege.html": ["ЕГЭ Python", "doc"], "account.html": ["Мой профиль", "user"], "students.html": ["Ученики на сервере", "user"], "live.html": ["Онлайн-игра", "bolt"], "run.html": ["Убеги от скелета", "skull"], "race.html": ["Гонка по Python", "bolt"],
  "learn.html": ["Предметы", "books"], "arcade.html": ["Аркада", "skull"]
};
function layout(active, title) {
  var desk = active === "desk", pg = PAGES[active] || ["Окно", "win"];
  var teacher = isTeacher();
  document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="guide.css">');
  if (!desk) {
    var main = document.querySelector("main.wrap");
    if (main) {
      var ttl = "C:\\" + (window.WIN_ROOT || "Python") + "\\" + (title || pg[0]);
      main.innerHTML = '<div class="tbar">' + pix(pg[1]) + '<span class="ti">' + esc(ttl) + '</span>' +
        '<a class="wb" id="wBack" href="index.html" title="Назад">&#9664;<span> Назад</span></a>' +
        '<a class="wb" href="index.html" title="Закрыть окно и вернуться на рабочий стол">&#10005;<span> Закрыть</span></a></div><div class="in">' + main.innerHTML + "</div>";
      document.getElementById("wBack").onclick = function (e) {
        var ok = false; try { ok = history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin; } catch (x) {}
        if (ok) { e.preventDefault(); history.back(); }
      };
    }
  }
  var items = [["learn.html", "Предметы", "books"], ["tasks.html", "Задания", "pc"], ["theory.html", "Теория", "folder"], ["quiz.html", "Квизы", "book"], ["projects.html", "Проекты ребят", "disk"], ["cloud.html", "Облако слов", "win"], ["slides.html", "Презентации", "doc"], ["video.html", "Видеоразборы", "video"], ["live.html", "Онлайн-игра", "bolt"], ["race.html", "Гонка по Python", "bolt"], ["arcade.html", "Аркада", "skull"], ["leaders.html", "Таблица лидеров", "bolt"], ["spy.html", "Шпион", "user"], ["account.html", "Мой профиль", "user"]];
  /* ученикам вход для учителя не показываем: учитель открывает teacher.html по адресу, после входа пункты появляются */
  if (teacher) { items.push(["teacher.html", "Кабинет учителя", "key"]); items.push(["students.html", "Ученики на сервере", "user"]); items.push(["ege.html", "ЕГЭ Python (черновик)", "doc"]); }
  function menuHtml() { return items.filter(function (x) { return x[0] !== "arcade.html" || appsOpen(); }).map(function (x) { return '<li><a href="' + x[0] + '">' + pix(x[2]) + x[1] + "</a></li>"; }).join(""); }
  var tail = '<hr><li><a href="#" id="guideBtn">' + pix("help") + 'Как это работает</a></li>' +
    '<li><a href="index.html">' + pix("win") + 'Рабочий стол</a></li>';
  var menu = menuHtml() + tail;
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
  function bindGuide() { document.getElementById("guideBtn").onclick = function (e) { e.preventDefault(); setMenu(false); if (window.openGuide) window.openGuide(0); }; }
  bindGuide();
  window.__menuRefresh = function () { var ul = document.querySelector("#smenu ul"); if (ul) { ul.innerHTML = menuHtml() + tail; bindGuide(); } };
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

/* Объявление на всех страницах: docs/notice.json {"id","at","sec","title","text"}.
   Красный экран показывается всем, кто открыл или обновил сайт в промежуток [at, at+sec] (до 10 минут).
   Закрыть нельзя: обновление страницы показывает его снова; пустой файл {} ничего не показывает. */
(function () {
  var shown = "";
  var SKULL = ["................","....XXXXXXXX....","...XXXXXXXXXX...","..XXXXXXXXXXXX..","..XXXXXXXXXXXX..","..XXEEEXXEEEXX..","..XEEEEXXEEEEX..","..XEEEEXXEEEEX..","..XXEEXXXXEEXX..","...XXXXNNXXXX...","....XXXNNXXX....","....XXXXXXXX....",".....XTXTXTX....",".....XTXTXTX....","......XXXXXX....","................"];
  function skull() {
    var r = "", C = { X: "#e9e2d0", E: "#16060a", N: "#16060a", T: "#bdb39a" };
    SKULL.forEach(function (row, y) { for (var x = 0; x < 16; x++) { var c = row[x]; if (c !== ".") r += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + C[c] + '"/>'; } });
    return '<svg id="nsk" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" style="width:min(46vw,260px);height:auto;filter:drop-shadow(0 0 18px rgba(0,0,0,.7));animation:nshake .12s infinite alternate">' + r +
      '<g id="npu"><rect x="4" y="6" width="2" height="2" fill="#ff2a2a"/><rect x="10" y="6" width="2" height="2" fill="#ff2a2a"/></g></svg>';
  }
  var UL = [
    { t: "Выведи на экран результат выражения 15 + 27 + 8.", h: "Пример: print(2 + 3) выведет 5.", cases: [{ stdin: [], must: ["50"] }] },
    { t: "Выведи на экран фразу: Сайт спасён", h: "Текст пишут в кавычках: print(\"текст\")", cases: [{ stdin: [], must: ["Сайт спасён"] }] },
    { t: "Спроси имя, потом возраст (целое число). Выведи: <имя>, через 5 лет тебе <возраст + 5>. Например: Аня, через 5 лет тебе 17", h: "name = input(); age = int(input()); print(f\"{name}, через 5 лет тебе {age + 5}\")", cases: [{ stdin: ["Аня", "12"], must: ["Аня, через 5 лет тебе 17"] }, { stdin: ["Борис", "30"], must: ["Борис, через 5 лет тебе 35"] }] }
  ];
  function unlockUI(host, n, finish) {
    var key = "nus_" + n.id, solved = 0; try { solved = Math.min(3, +localStorage.getItem(key) || 0); } catch (e) {}
    var inp = "width:100%;box-sizing:border-box;font:500 17px/1.5 'IBM Plex Mono',monospace;background:#0f0f2a;color:#e8f0ff;border:3px solid #fff;padding:12px;min-height:130px;resize:vertical";
    host.innerHTML = '<div style="font:400 clamp(11px,2.4vw,14px)/1.6 \'Press Start 2P\',monospace;margin-bottom:8px" id="nuh"></div><div style="font:600 clamp(16px,2.8vw,20px)/1.5 \'IBM Plex Mono\',monospace;margin-bottom:8px;text-align:left" id="nut"></div>' +
      '<textarea id="nuc" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Код на Python" style="' + inp + '"></textarea>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px;align-items:center"><button type="button" id="nub" style="font:600 18px \'IBM Plex Mono\',monospace;padding:12px 24px;border:3px solid #fff;background:#fff;color:#a8101f;cursor:pointer;min-height:48px">Проверить</button><span id="nur" role="status" style="font:600 16px \'IBM Plex Mono\',monospace;text-align:left"></span></div>';
    var ta = host.querySelector("#nuc"), btn = host.querySelector("#nub"), res = host.querySelector("#nur"), tries = 0;
    function show() { host.querySelector("#nuh").textContent = "Задача " + (solved + 1) + " из 3"; host.querySelector("#nut").textContent = UL[solved].t; ta.value = ""; res.textContent = ""; tries = 0; ta.focus(); }
    function load(cb) { if (window.BrowserCheck) { cb(); return; } var sc = document.createElement("script"); sc.src = "runner/check.js"; sc.onload = cb; sc.onerror = function () { res.textContent = "Не удалось загрузить проверку. Подожди окончания времени."; }; document.head.appendChild(sc); }
    load(function () { try { window.BrowserCheck.warm(); } catch (e) {} });
    btn.onclick = function () {
      var code = ta.value; if (!code.trim()) { res.textContent = "Напиши код."; return; }
      btn.disabled = true; res.textContent = "Проверяю… (в первый раз до 10 секунд)";
      load(function () {
        window.BrowserCheck.run({ starter: "", cases: UL[solved].cases, funcs: [] }, code).then(function (r) {
          btn.disabled = false;
          if (r.ok) {
            solved++; try { localStorage.setItem(key, String(solved)); } catch (e) {}
            if (solved >= 3) { res.textContent = "Готово! Сайт разблокирован."; setTimeout(finish, 600); return; }
            res.textContent = ""; show(); host.querySelector("#nuh").textContent += " (верно, идём дальше)";
          } else {
            tries++; var m = (r.messages || []).slice(0, 2).join(" ");
            res.textContent = "Пока не так. " + m + (tries >= 2 ? " Подсказка: " + UL[solved].h : "");
          }
        });
      });
    };
    show();
  }
  function run(n) {
    var t = Date.parse(n.at), now = Date.now(), sec = Math.min(600, Math.max(3, +n.sec || 8));
    if (!n.id || !(t > 0) || now < t || now >= t + sec * 1000 || shown === n.id) return;
    if (n.dance) {
      try { if (sessionStorage.getItem("danceSeen") === n.id) return; sessionStorage.setItem("danceSeen", n.id); } catch (e) {}
      shown = n.id;
      var dn = function () { window.Egg.dance({ text: n.danceText || n.text, ms: t + sec * 1000 - Date.now() }); };
      if (window.Egg) dn(); else { var sd = document.createElement("script"); sd.src = "egg.js"; sd.onload = dn; document.head.appendChild(sd); }
      return;
    }
    if (n.game) {
      try { if (sessionStorage.getItem("gameSeen") === n.id) return; sessionStorage.setItem("gameSeen", n.id); } catch (e) {}
      shown = n.id;
      var go = function () { window.Egg.start({ intro: n.intro || "Учитель запустил игру для всех." }); };
      if (window.Egg) go(); else { var sc = document.createElement("script"); sc.src = "egg.js"; sc.onload = go; document.head.appendChild(sc); }
      return;
    }
    if (n.unlock) { try { if (localStorage.getItem("nu_" + n.id) === "1") return; } catch (e) {} }
    shown = n.id;
    var end = t + sec * 1000, el = document.createElement("div");
    el.setAttribute("role", "alertdialog"); el.setAttribute("aria-live", "assertive"); el.id = "notice"; el.tabIndex = -1;
    el.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 50% 40%,#a8101f 0%,#4a0710 70%,#1a0206 100%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:18px;padding:20px;text-align:center;overflow:auto;cursor:not-allowed";
    var head = "font:400 clamp(20px,6vw,52px)/1.4 'Press Start 2P',monospace;text-shadow:3px 3px 0 #000;animation:nblink 1s steps(2) infinite", sub = "font:600 clamp(16px,3.4vw,28px)/1.5 'IBM Plex Mono',monospace;text-shadow:2px 2px 0 #000";
    el.innerHTML = '<style>@keyframes nshake{from{transform:translate(-2px,0)}to{transform:translate(2px,1px)}}@keyframes nblink{50%{opacity:.55}}@media (prefers-reduced-motion:reduce){#nsk,#notice div{animation:none!important}}#notice.un #nsk{width:min(26vw,110px)!important}</style>' +
      '<div style="margin:auto 0;display:grid;gap:16px;justify-items:center;width:min(100%,720px)">' + skull() + '<div style="' + head + '">' + esc(n.title || "Ошибка") + '</div><div style="' + sub + '">' + esc(n.text || "") + '</div>' +
      '<div style="font:500 clamp(14px,2.4vw,19px)/1.6 \'IBM Plex Mono\',monospace;opacity:.9">' + (n.unlock ? 'Страницу нельзя закрыть или обновить.<br>Чтобы разблокировать сайт, реши 3 задачи на Python или подожди: <b id="ncd" style="font-size:1.3em">0:00</b></div><div id="nun" style="width:100%"></div>' : 'Страницу нельзя закрыть или обновить.<br>Подожди, доступ вернётся сам через <b id="ncd" style="font-size:1.3em">0:00</b></div>') + '</div>';
    var prevO = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden";
    if (n.unlock) el.className = "un";
    document.body.appendChild(el); if (!n.unlock) el.focus();
    var tick, mo, last = 0;
    function left() { return end - Date.now(); }
    function fmt() { var l = Math.max(0, Math.ceil(left() / 1000)), c = el.querySelector("#ncd"); if (c) c.textContent = Math.floor(l / 60) + ":" + ("0" + (l % 60)).slice(-2); }
    function done() { clearInterval(tick); if (mo) mo.disconnect(); document.removeEventListener("keydown", key, true); document.removeEventListener("pointermove", look); document.documentElement.style.overflow = prevO; el.remove(); }
    function key(e) { if (e.key === "Tab" || e.key === "Escape") e.preventDefault(); }
    function look(e) { var p = el.querySelector("#npu"); if (!p) return; var dx = Math.max(-1, Math.min(1, (e.clientX / innerWidth - .5) * 3)), dy = Math.max(-.6, Math.min(.6, (e.clientY / innerHeight - .5) * 2)); p.setAttribute("transform", "translate(" + dx.toFixed(2) + " " + dy.toFixed(2) + ")"); }
    document.addEventListener("keydown", key, true); document.addEventListener("pointermove", look);
    /* если кто-то удалил или спрятал окно из консоли, оно возвращается */
    tick = setInterval(function () {
      if (left() <= 0) { shown = n.id + "-end"; done(); return; }
      if (!document.body.contains(el)) document.body.appendChild(el);
      if (el.style.display === "none" || el.style.visibility === "hidden" || el.style.opacity === "0") { el.style.display = "flex"; el.style.visibility = "visible"; el.style.opacity = "1"; }
      fmt();
    }, 250);
    mo = new MutationObserver(function () { if (!document.body.contains(el)) document.body.appendChild(el); });
    mo.observe(document.body, { childList: true });
    fmt();
    if (n.unlock) unlockUI(el.querySelector("#nun"), n, function () { try { localStorage.setItem("nu_" + n.id, "1"); } catch (e) {} shown = n.id + "-end"; done(); });
  }
  function poll() {
    try { fetch("notice.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) { if (n) run(n); }).catch(function () {}); } catch (e) {}
  }
  if (typeof document !== "undefined") { setTimeout(poll, 150); setInterval(poll, 5000); }
})();

/* Игра для всех: учитель нажимает кнопку в кабинете, сервер переходит в режим «игра», и у всех, кто сейчас на сайте,
   на 5 секунд появляется экран «Давайте поиграем!», а потом открывается гонка (race.html). Опрос раз в 4 секунды, запрос крошечный. */
(function () {
  if (typeof document === "undefined" || location.protocol === "file:") return;
  var path = location.pathname.split("/").pop() || "index.html";
  if (/^(race|boss|spy|teacher|students)\.html$/.test(path)) return;
  try { if (sessionStorage.getItem("tkey")) return; } catch (e) {}
  var busy = false, started = false;
  function api() { return String(window.API_BASE || "").replace(/\/+$/, ""); }
  var gameName = "race";
  function goRace() { try { sessionStorage.setItem("playBack", location.href); } catch (e) {} location.href = gameName === "boss" ? "boss.html" : gameName === "spy" ? "spy.html" : "race.html"; }
  function intro() {
    var run = function () { window.Egg.play({ ms: 5000, onClose: goRace }); };
    if (window.Egg && window.Egg.play) run(); else { var sc = document.createElement("script"); sc.src = "egg.js"; sc.onload = run; sc.onerror = goRace; document.head.appendChild(sc); }
  }
  var luckyOpen = false;
  function lucky(j) {
    if (luckyOpen || !j.lucky || document.getElementById("notice") || document.getElementById("lk")) return;
    luckyOpen = true;
    var run = function () { var go = function () { window.Lucky.open(); }; if (window.Lucky) go(); else { var l = document.createElement("script"); l.src = "lucky.js"; l.onload = go; l.onerror = function () { luckyOpen = false; }; document.head.appendChild(l); } };
    if (window.Egg) run(); else { var e = document.createElement("script"); e.src = "egg.js"; e.onload = run; e.onerror = function () { luckyOpen = false; }; document.head.appendChild(e); }
    var wt = setInterval(function () { if (!document.getElementById("lk") && window.Lucky) { clearInterval(wt); setTimeout(function () { luckyOpen = false; }, 60000); } }, 2000);
  }
  function scare(sc) {
    var seen = ""; try { seen = sessionStorage.getItem("scareSeen") || ""; } catch (e) {}
    if (!sc || seen === String(sc.id)) return; try { sessionStorage.setItem("scareSeen", String(sc.id)); } catch (e) {}
    var go = function () { window.Scare.show(sc.kind === "thanks" || sc.kind === "respect" ? sc.kind : "skull"); };
    var needS = function () { if (window.Scare) go(); else { var s2 = document.createElement("script"); s2.src = "scare.js"; s2.onload = go; document.head.appendChild(s2); } };
    if (window.Egg) needS(); else { var s3 = document.createElement("script"); s3.src = "egg.js"; s3.onload = needS; document.head.appendChild(s3); }
  }
  function appsSync(a) {
    var now = a.games ? "1" : "0", old = ""; try { old = localStorage.getItem("appsGames") || ""; } catch (e) {}
    if (old === now) return; try { localStorage.setItem("appsGames", now); } catch (e) {}
    var pg = location.pathname.split("/").pop() || "index.html";
    if (window.__menuRefresh) window.__menuRefresh(); if (window.renderDesk) window.renderDesk();
    if (now === "1" && pg === "arcade.html" && document.getElementById("arcClosed")) { location.reload(); return; }
    if (now === "0" && pg === "arcade.html" && !appsOpen()) { location.href = "index.html"; return; }
    if (now === "1" && old !== "" && !document.getElementById("appsToast")) {
      var t = document.createElement("div"); t.id = "appsToast"; t.setAttribute("role", "status");
      t.style.cssText = "position:fixed;right:12px;bottom:56px;z-index:9000;max-width:min(92vw,360px);background:#ffffe1;border:3px solid #000;box-shadow:5px 5px 0 #000;padding:12px 14px;font:500 15px/1.35 'IBM Plex Mono',monospace;color:#000;cursor:pointer";
      t.innerHTML = "<b>🎮 Учитель открыл игры!</b><br>Иконка «Аркада» на рабочем столе и в меню «Пуск».<br><a href=\"arcade.html\" style=\"color:#3a1aa0\">Открыть аркаду</a>";
      t.onclick = function (e) { if (e.target.tagName !== "A") t.remove(); }; document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.remove(); }, 12000);
    }
  }
  function react(j) {
    if (j && j.ok && j.apps) appsSync(j.apps);
    if (j && j.ok && j.scare) scare(j.scare);
    if (j && j.ok) lucky(j);
    if (!j || !j.ok || !j.id || j.phase === "idle" || j.phase === "end" || document.getElementById("notice")) return;
    var seen = ""; try { seen = sessionStorage.getItem("playSeen") || ""; } catch (e) {}
    if (seen === String(j.id)) return;
    try { sessionStorage.setItem("playSeen", String(j.id)); } catch (e) {}
    started = true; gameName = j.game === "boss" ? "boss" : j.game === "spy" ? "spy" : "race";
    if (j.phase === "run" || (gameName === "spy" && j.phase !== "intro" && j.phase !== "lobby")) goRace(); else intro();
  }
  function poll() {
    if (busy || started || luckyOpen || document.hidden || !api()) return; busy = true;
    var ctl = typeof AbortController === "function" ? new AbortController() : null, to = ctl && setTimeout(function () { ctl.abort(); }, 6000);
    var hd = {}; try { var ac = JSON.parse(localStorage.getItem("acct") || "null"); if (ac && ac.token) hd.Authorization = "Bearer " + ac.token; } catch (e) {}
    fetch(api() + "/api/play", { cache: "no-store", headers: hd, signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.ok ? r.json() : null; }).then(react).catch(function () {}).finally(function () { busy = false; if (to) clearTimeout(to); });
  }
  function boot() { setInterval(poll, 4000); setTimeout(poll, 600); document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); }); }
  if (window.API_BASE !== undefined) boot();
  else { var cs = document.createElement("script"); cs.src = "config.js"; cs.onload = boot; document.head.appendChild(cs); }
})();

/* Первое окно регистрации: пока ученик не вошёл, дальше сайт не пускает (кроме кабинета учителя). Само окно лежит в gate.js. */
(function () {
  if (typeof document === "undefined" || location.protocol === "file:") return;
  var path = location.pathname.split("/").pop() || "index.html";
  if (/^(teacher|students|account)\.html$/.test(path) || (path === "boss.html" && /[?&]board=1/.test(location.search))) return;
  function need(src, cb) { var s = document.createElement("script"); s.src = src; s.onload = cb; s.onerror = function () {}; document.head.appendChild(s); }
  function go() {
    if (!window.Net || !Net.on || Net.user()) return;
    try { if (sessionStorage.getItem("tkey")) return; } catch (e) {}
    /* окно входа включаем, только если сервер новой версии (v2): со старым сервером ученики не смогут зарегистрироваться */
    var ctl = typeof AbortController === "function" ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    fetch(Net.base + "/api/ping", { cache: "no-store", signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.json(); }).then(function (j) { clearTimeout(to); if (j && j.v >= 2) need("gate.js"); }).catch(function () { clearTimeout(to); });
  }
  function boot() {
    if (window.API_BASE === undefined) return need("config.js", boot);
    if (!window.Net) return need("net.js", go);
    go();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); }); else setTimeout(boot, 0);
})();

/* Секреты. Находятся по подсказкам в заданиях и после решённых задач. Оценок за них нет.
   Слова печатаются на клавиатуре не в поле ввода (работают и с русской раскладкой: смотрим на клавишу, а не на букву):
     hop: платформер «Пикс-прыгун», zap: «Разбей баги», skull: «Убеги от скелета»,
     boom, ghost, gold, fact: маленькие сюрпризы. Стрелки ↓↓↑↑ →←→← A B: тренировка «Скелет и бочки». Семь нажатий на часы: «Скелет и бочки» с подсказками. */
(function () {
  if (typeof document === "undefined") return;
  var WORDS = { hop: "hop", zap: "zap", skull: "skull", boom: "confetti", ghost: "walker", gold: "coin", fact: "fact" };
  var KON = ["ArrowDown", "ArrowDown", "ArrowUp", "ArrowUp", "ArrowRight", "ArrowLeft", "ArrowRight", "ArrowLeft", "a", "b"], kbuf = [], word = "", clicks = [], loading = false;
  function need(src, cb, fail) { var sc = document.createElement("script"); sc.src = src; sc.onload = cb; sc.onerror = fail || function () {}; document.head.appendChild(sc); }
  function withLucky(cb) {
    if (loading) return; loading = true; var done = function () { loading = false; cb(); }, fail = function () { loading = false; };
    var needL = function () { if (window.Lucky) done(); else need("lucky.js", done, fail); };
    if (window.Egg) needL(); else need("egg.js", needL, fail);
  }
  /* секретная мини-игра в окне поверх страницы: Esc или кнопка закрывают */
  var GAMES = { hop: ["hop.js", "Hop", "Пикс-прыгун"], zap: ["zap.js", "Zap", "Разбей баги"] };
  function openGame(id) {
    if (document.getElementById("sg") || loading) return; var G = GAMES[id]; if (!G) return; loading = true;
    function run() {
      loading = false; var ov = document.createElement("div"); ov.id = "sg"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", G[2]);
      ov.style.cssText = "position:fixed;inset:0;z-index:2147482000;background:rgba(10,5,40,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;gap:8px;overflow:auto";
      ov.innerHTML = '<div style="width:min(960px,100%);display:flex;justify-content:space-between;align-items:center;color:#fff;font:400 12px/1.4 \'Press Start 2P\',monospace"><span>' + G[2] + '</span><button type="button" id="sgx" style="font:400 12px \'Press Start 2P\',monospace;min-height:40px;padding:8px 12px;background:#c0c0c0;border:3px solid #000;cursor:pointer">Закрыть</button></div><div id="sgh" style="width:min(960px,100%)"></div>';
      document.body.appendChild(ov); document.documentElement.style.overflow = "hidden";
      var game = window[G[1]].mount(ov.querySelector("#sgh"), {});
      function close() { try { game.destroy(); } catch (e) {} ov.remove(); document.documentElement.style.overflow = ""; document.removeEventListener("keydown", esc, true); }
      function esc(e) { if (e.key === "Escape" && game.root && game.root.getAttribute("data-state") !== "play") { e.preventDefault(); close(); } }
      document.addEventListener("keydown", esc, true); ov.querySelector("#sgx").onclick = close;
      ov.querySelector("#sgx").focus(); window.__sg = game;
    }
    var css = document.getElementById("sgcss"); if (!css) { css = document.createElement("link"); css.id = "sgcss"; css.rel = "stylesheet"; css.href = "learn.css"; document.head.appendChild(css); }
    if (window[G[1]]) run(); else need(G[0], run, function () { loading = false; });
  }
  document.addEventListener("keydown", function (e) {
    var tg = e.target && e.target.tagName; if (tg === "TEXTAREA" || tg === "INPUT" || tg === "SELECT" || (e.target && e.target.isContentEditable) || document.getElementById("notice") || document.getElementById("lk") || document.getElementById("sg") || document.getElementById("egg")) { kbuf = []; word = ""; return; }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(Shift|CapsLock|Control|Alt|Meta|AltGraph)$/.test(e.key)) return;
    var m = /^Key([A-Z])$/.exec(e.code || ""), d = /^Digit(\d)$/.exec(e.code || ""), ch = m ? m[1].toLowerCase() : d ? d[1] : "";
    var k = e.key.length === 1 ? (ch || e.key.toLowerCase()) : e.key;
    kbuf.push(k); if (kbuf.length > KON.length) kbuf.shift();
    if (kbuf.join() === KON.join()) { kbuf = []; withLucky(function () { window.Lucky.practice(); }); return; }
    if (!ch) { word = ""; return; }
    word = (word + ch).slice(-6);
    for (var w in WORDS) if (word.slice(-w.length) === w) {
      word = ""; var t = WORDS[w];
      if (t === "hop" || t === "zap") openGame(t);
      else if (t === "skull") { var go = function () { window.Egg.start(); }; if (window.Egg) go(); else need("egg.js", go); }
      else if (window.Surprise) Surprise.maybe(1, t);
      return;
    }
  });
  document.addEventListener("click", function (e) {
    var c = e.target && e.target.closest && e.target.closest(".clock"); if (!c) return;
    var now = Date.now(); clicks = clicks.filter(function (t) { return now - t < 4000; }); clicks.push(now);
    if (clicks.length >= 7) { clicks = []; withLucky(function () { window.Lucky.fun(); }); }
  });
  var HINTS = ["Секрет для внимательных: набери на клавиатуре слово hop (не в поле ввода). Герой любит прыгать.",
    "Набери zap по буквам не в поле ввода. Баги это кирпичи.",
    "Старый секрет геймеров: ↓ ↓ ↑ ↑ → ← → ← A B. Нажимай по очереди не в поле ввода.",
    "Часы в правом нижнем углу не любят, когда на них нажимают семь раз подряд быстро.",
    "Слова boom, ghost, gold и fact по буквам: каждое показывает своё. Печатай не в поле ввода, раскладка не важна.",
    "Слово skull открывает старую игру со скелетом. Попробуй!",
    "После решённых заданий иногда появляются сюрпризы: конфетти, прохожий скелет, золотой череп. Решай больше, и повезёт."];
  /* случайный сюрприз после выполненного задания: не чаще раза в полторы минуты, примерно в каждом третьем случае */
  var lastS = 0;
  window.Surprise = {
    maybe: function (p, force) {
      try {
        var now = Date.now();
        if (document.getElementById("notice") || document.getElementById("egg") || document.getElementById("lk") || document.getElementById("scare") || document.getElementById("sg")) return false;
        if (!force && (now - lastS < 90000 || Math.random() > (p == null ? 0.34 : p))) return false;
        lastS = now;
        var run = function () { window.SurpriseRun(typeof force === "string" ? force : undefined); };
        if (window.SurpriseRun) run(); else need("surprise.js", run);
        return true;
      } catch (e) { return false; }
    }
  };
  /* после решённого задания иногда показываем одну подсказку (примерно в каждом третьем случае) */
  window.EggHint = function (el) {
    try { if (!el || Math.random() > 0.34) return; var n = +(localStorage.getItem("hintN") || 0); localStorage.setItem("hintN", String(n + 1));
      var d = document.createElement("div"); d.className = "m"; d.style.cssText = "font-size:13px;opacity:.75;margin-top:10px;border-top:1px dashed #999;padding-top:8px"; d.textContent = "🦴 " + HINTS[n % HINTS.length]; el.appendChild(d); } catch (e) {}
  };
  window.__secrets = { open: openGame };
})();

/* Выбор предмета (Python, SQL, Blender, нейросети): окно появляется после входа или регистрации и у тех, кто вошёл, но ещё не выбирал.
   Само окно лежит в subjects.js. askSubject() открывает его вручную. */
window.askSubject = function () {
  if (window.__noPick) return; /* автотесты старых сценариев */
  function go() { if (window.Subject) Subject.pick(); }
  if (window.Subject) go(); else { var s = document.createElement("script"); s.src = "subjects.js"; s.onload = go; document.head.appendChild(s); }
};
(function () {
  if (typeof document === "undefined") return;
  var path = location.pathname.split("/").pop() || "index.html";
  if (/^(teacher|students|race|boss)\.html$/.test(path)) return;
  function boot() {
    var flag = "", subj = "", acct = null;
    try { flag = localStorage.getItem("pickSubj") || ""; subj = localStorage.getItem("subject") || ""; acct = JSON.parse(localStorage.getItem("acct") || "null"); } catch (e) { return; }
    try { if (sessionStorage.getItem("tkey")) return; } catch (e) {}
    if (flag || (acct && acct.token && !subj)) setTimeout(function () { if (!document.getElementById("gate") && !document.getElementById("notice")) window.askSubject(); }, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
