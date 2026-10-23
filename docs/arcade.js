/* Страница «Аркада»: «Пернатый бой» и «Подземелье багов». Игра открывается во весь блок страницы, «Закрыть игру» её выключает. */
(function () {
  layout("arcade.html", "Аркада");
  /* вопросы для дверей: по предмету, который сейчас выбран; для Python — общий банк викторины */
  function questions() {
    var sid = Subject.get(), out = [];
    if (sid && sid !== "python" && window.SUBJECTS && SUBJECTS[sid]) SUBJECTS[sid].lessons.forEach(function (l) { l.tasks.forEach(function (t) { if (t.type === "quiz") out.push({ q: t.q.replace(/`/g, ""), code: t.code, o: t.o.map(function (x) { return String(x).replace(/`/g, ""); }), a: t.a, why: (t.why || "").replace(/`/g, "") }); }); });
    if (!out.length && window.QUESTIONS) out = QUESTIONS.map(function (q) { return { q: q.q, code: q.code, o: q.o, a: q.a, why: q.why }; });
    return out;
  }
  var G = [
    { id: "chick", name: "Пернатый бой", icon: "bolt", text: "Аркада: цыплята с яйцемётами против ботов. Выбери цвет и шапку, держи прыжок, чтобы планировать, собирай кукурузу и золотые яйца.", mod: function () { return Chick; } },
    { id: "dungeon", name: "Подземелье багов", icon: "skull", text: "Шутер от первого лица в духе игр 90-х. Три уровня, жуки-баги и двери-терминалы, которые открывает правильный ответ.", mod: function () { return Dungeon; } }
  ];
  var arc = document.getElementById("arc"), stage = document.getElementById("stage"), sth = document.getElementById("sth"), cur = null;
  function cards() {
    arc.innerHTML = G.map(function (g) { return '<div class="card arcard">' + pix(g.icon) + '<h2>' + esc(g.name) + '</h2><p>' + esc(g.text) + '</p><p class="m">Твой рекорд: <b>' + g.mod().best() + '</b></p><button class="btn big go" type="button" data-g="' + g.id + '">Играть</button></div>'; }).join("");
    arc.querySelectorAll("[data-g]").forEach(function (b) { b.onclick = function () { open(b.dataset.g); }; });
  }
  function open(id) {
    var g = G.filter(function (x) { return x.id === id; })[0]; if (!g) return;
    if (cur) cur.destroy();
    arc.hidden = true; stage.hidden = false; document.getElementById("stt").textContent = g.name;
    cur = g.mod().mount(sth, { questions: questions() }); window.__game = cur; /* для автотестов */
    try { history.replaceState(null, "", "?g=" + id); } catch (e) {}
    stage.scrollIntoView({ block: "start" });
  }
  document.getElementById("stx").onclick = function () { if (cur) cur.destroy(); cur = null; stage.hidden = true; arc.hidden = false; cards(); try { history.replaceState(null, "", "arcade.html"); } catch (e) {} };
  cards();
  var q = new URLSearchParams(location.search).get("g"); if (q) open(q);
})();
