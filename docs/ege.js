/* Раздел «ЕГЭ по информатике на Python» (ege.html). Пока скрыт: открывается только учителю (isTeacher()).
   Данные: data/ege.js (собирает tools/ege.py из subjects/ege/topics.json). Прогресс только в localStorage "egep", на сервер не уходит. */
(function () {
  layout("ege.html", "ЕГЭ");
  var box = document.getElementById("app");
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function md(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
  function load() { try { var v = JSON.parse(localStorage.getItem("egep") || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
  function mark(id) { var p = load(); p[id] = 1; try { localStorage.setItem("egep", JSON.stringify(p)); } catch (e) {} }

  if (!isTeacher() || !window.EGE) {
    box.innerHTML = '<div class="howto"><span><b>Раздел готовится.</b> Скоро здесь появится подготовка к ЕГЭ по информатике на Python.</span></div>';
    return;
  }

  var topics = EGE.topics, done = load();
  var total = topics.reduce(function (a, t) { return a + t.tasks.length; }, 0);
  var h = '<div class="howto"><span><b>ЕГЭ по информатике на Python.</b> Раздел скрыт от учеников, виден только учителю. ' + md(EGE.intro) + '</span></div>' +
    '<h2 class="lh">Темы</h2><div class="plates">';
  topics.forEach(function (t) {
    var n = t.tasks.filter(function (k) { return done[k.id]; }).length;
    h += '<details class="ltask' + (n === t.tasks.length ? " dn" : "") + '" id="n' + esc(t.n) + '"><summary class="lth"><span class="ltn">№' + esc(t.n) + '</span><h3>' + esc(t.title) + '</h3><span class="ltk">' + n + ' из ' + t.tasks.length + '</span></summary><div class="ltb">' +
      '<p>' + md(t.what) + '</p><h4>Как решать</h4><ol class="steps">' + t.theory.map(function (x) { return '<li>' + md(x) + '</li>'; }).join("") + '</ol>' +
      '<h4>Шаблон</h4><pre class="code">' + esc(t.template) + '</pre>' +
      t.tasks.map(function (k) {
        return '<div class="ltask' + (done[k.id] ? " dn" : "") + '" data-id="' + esc(k.id) + '"><div class="lth"><span class="ltn">' + esc(k.id.replace("ege", "")) + '</span><h3>' + esc(k.title) + '</h3></div><div class="ltb">' +
          '<p>' + md(k.text) + '</p><details class="hintb"><summary>Подсказка</summary><p>' + md(k.hint) + '</p></details>' +
          '<textarea class="sqlin" spellcheck="false" rows="8">' + esc(k.starter) + '</textarea>' +
          '<p><button type="button" class="btn go">Проверить</button></p><div class="res"></div></div></div>';
      }).join("") + '</div></details>';
  });
  h += '</div><h2 class="lh">Источники</h2><ul>' + EGE.sources.map(function (s) { return '<li><a href="' + esc(s.url) + '" rel="noopener noreferrer" target="_blank">' + esc(s.title) + '</a></li>'; }).join("") + '</ul>' +
    '<p class="m">Заданий: ' + total + '. Номера и форматы сверяй с актуальной демоверсией ФИПИ.</p>';
  box.innerHTML = h;

  var byId = {}; topics.forEach(function (t) { t.tasks.forEach(function (k) { byId[k.id] = k; }); });
  box.querySelectorAll(".ltask[data-id]").forEach(function (el) {
    var k = byId[el.dataset.id], ta = el.querySelector("textarea"), btn = el.querySelector(".go"), res = el.querySelector(".res");
    ta.addEventListener("keydown", function (e) { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); var s = ta.selectionStart; ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 4; } });
    btn.onclick = function () {
      btn.disabled = true; res.className = "res on wait"; res.innerHTML = '<div class="rh">Проверяю…</div>';
      BrowserCheck.run(k, ta.value).then(function (r) {
        btn.disabled = false;
        if (r.todo) { res.className = "res on fail"; res.innerHTML = '<div class="rh">Пока тут только заготовка. Напиши решение.</div>'; return; }
        if (r.ok) { res.className = "res on pass"; res.innerHTML = '<div class="rh">Все тесты пройдены</div>'; mark(k.id); el.classList.add("dn"); }
        else { res.className = "res on fail"; res.innerHTML = '<div class="rh">Пока не так</div><ul>' + (r.messages || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul>' + (r.sample ? "<pre>" + esc(String(r.sample).slice(0, 400)) + "</pre>" : ""); }
      });
    };
  });
  if (location.hash) { var d = document.querySelector(location.hash.replace(/[^#\w-]/g, "")); if (d && d.open === false) d.open = true; }
})();
