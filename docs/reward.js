/* «Что дальше» после пройденного задания: следующий шаг, серия дней, мини-игра в награду.
   Всё хранится в браузере (localStorage), GitHub не нужен. */
var Streak = (function () {
  function key(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function load() { try { var v = JSON.parse(localStorage.getItem("streak") || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem("streak", JSON.stringify(o)); } catch (e) {} }
  function prev(k) { var p = k.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() - 1); return key(d); }
  /* now: для тестов можно подставить дату */
  function touch(now) {
    var today = key(now || new Date()), o = load(), days = o.days || [];
    if (days.indexOf(today) < 0) days.push(today);
    days = days.slice(-60);
    if (o.last === today) { o.days = days; save(o); return o.n; }
    o.n = o.last === prev(today) ? (o.n || 0) + 1 : 1;
    o.last = today; o.best = Math.max(o.best || 0, o.n); o.days = days; save(o); return o.n;
  }
  /* сколько дней подряд сейчас (если вчера не заходил, серия уже сгорела) */
  function get(now) {
    var today = key(now || new Date()), o = load();
    var n = o.last === today || o.last === prev(today) ? (o.n || 0) : 0;
    return { n: n, best: o.best || 0, today: o.last === today, days: o.days || [] };
  }
  function week(now) {
    var d = new Date(now || new Date()), g = get(now), out = [];
    for (var i = 6; i >= 0; i--) { var x = new Date(d); x.setDate(x.getDate() - i); out.push({ k: key(x), on: g.days.indexOf(key(x)) >= 0, today: i === 0 }); }
    return out;
  }
  function plural(n) { var m = n % 100, k = n % 10; return n + " " + (m > 10 && m < 15 ? "дней" : k === 1 ? "день" : k > 1 && k < 5 ? "дня" : "дней"); }
  return { touch: touch, get: get, week: week, plural: plural, _key: key };
})();

var Reward = (function () {
  function load(k) { try { var v = JSON.parse(localStorage.getItem(k) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
  function nextTask(t) {
    var p = load("passed"), d = load("done"), i = TASKS.indexOf(t);
    var open = function (x) { return !p[x.id] && !d[x.id]; };
    return TASKS.slice(i + 1).filter(open)[0] || TASKS.filter(open)[0] || null;
  }
  function lessonState(t) {
    var p = load("passed"), d = load("done"), a = TASKS.filter(function (x) { return x.lesson === t.lesson; });
    return { all: a.length, ok: a.filter(function (x) { return p[x.id] || d[x.id]; }).length };
  }
  function played(id) { return !!load("played")[id]; }
  function markPlayed(id) { var o = load("played"); o[id] = 1; try { localStorage.setItem("played", JSON.stringify(o)); } catch (e) {} }
  function html(t) {
    var nx = nextTask(t), ls = lessonState(t), st = Streak.get(), wk = Streak.week(), g = Games.byId(Games.random());
    var lessonDone = ls.ok === ls.all, did = played(t.id);
    var streakTxt = st.n <= 1 ? "Серия началась. Приходи завтра, чтобы продолжить." : "Серия: " + Streak.plural(st.n) + " подряд.";
    var go = nx ? '<a class="btn big go" id="nx-go" href="task.html?id=' + esc(nx.id) + '">Продолжить: ' + esc(nx.id) + " " + esc(nx.title) + "</a>" : '<a class="btn big go" id="nx-go" href="projects.html">Покажи работу в «Проектах»</a>';
    var play = did ? '<div class="nx-done" id="nx-played">Игра за это задание уже сыграна. Награда одна на задание.</div>'
      : '<button class="btn big alt" type="button" id="nx-play" data-play="' + g.id + '">Сыграть один раз: ' + esc(g.name) + "</button>";
    return '<div class="nextbox" id="nextbox"><h3>' + (lessonDone ? "Урок " + t.lesson + " пройден!" : "Задание " + esc(t.id) + " пройдено!") + "</h3>" +
      '<div class="nx-choice"><span class="m">Что дальше?</span><div class="nx-btns">' + go + play + "</div></div>" +
      '<div class="nx-grid"><div class="nx-c"><span class="m">Урок ' + t.lesson + ": " + ls.ok + " из " + ls.all + '</span><div class="nx-bar">' + Array.apply(null, Array(ls.all)).map(function (_, i) { return '<i class="' + (i < ls.ok ? "on" : "") + '"></i>'; }).join("") + "</div></div>" +
      '<div class="nx-c"><b class="nx-n" id="nx-streak">' + streakTxt + '</b><div class="nx-wk" aria-label="Последние 7 дней">' + wk.map(function (d) { return '<i class="' + (d.on ? "on" : "") + (d.today ? " today" : "") + '"></i>'; }).join("") + "</div>" +
      (st.best > 1 ? '<div class="m">Рекорд: ' + Streak.plural(st.best) + "</div>" : "") + "</div></div></div>";
  }
  function show(host, t) {
    host.innerHTML = html(t);
    var b = host.querySelector("[data-play]");
    if (b) b.onclick = function () { markPlayed(t.id); Games.modal(b.getAttribute("data-play"), function () { show(host, t); }); };
  }
  return { html: html, show: show, nextTask: nextTask, played: played };
})();
