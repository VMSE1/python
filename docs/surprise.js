/* Случайные сюрпризы после выполненного задания (пасхалки). Подгружается из site.js только когда сюрприз выпал.
   Вызов: SurpriseRun() случайный, SurpriseRun("confetti") конкретный. Без звука, закрываются касанием, не мешают работе.
   При включённом «уменьшении движения» выпадают только спокойные: факт, монетка, бонус. */
(function () {
  var FACTS = [
    "Python назван не в честь змеи, а в честь комик-группы «Монти Пайтон».",
    "В Python можно умножать строки: \"ха\" * 3 даёт \"хахаха\".",
    "import this показывает «Дзен Python»: 19 правил, как писать красивый код.",
    "Первую версию Python Гвидо ван Россум придумал на рождественских каникулах 1989 года.",
    "В Python нет слова «switch», зато с версии 3.10 есть match.",
    "Отступы в Python не украшение: они часть синтаксиса.",
    "Баг назвали багом (жуком), когда в реле компьютера нашли настоящую моль.",
    "print(0.1 + 0.2) выдаёт 0.30000000000000004. Дело в том, как компьютер хранит дроби.",
    "Слово «лямбда» в Python делает маленькие безымянные функции: lambda x: x * 2.",
    "Python любят в науке и ИИ: на нём написано большинство нейросетей.",
    "Список можно перевернуть срезом: a[::-1].",
    "В Python всё объект: даже число 5 и даже функция.",
    "Можно поменять местами две переменные без третьей: a, b = b, a.",
    "Модуль antigravity открывает страницу с комиксом. Попробуй import antigravity.",
    "Программисты считают с нуля: первый элемент списка имеет номер 0.",
    "Комментарии начинаются с #. Хороший комментарий объясняет «почему», а не «что».",
    "Ошибка в программе, которая не падает, а считает не то, самая коварная.",
    "Слово bool назвали в честь математика Джорджа Буля: он придумал логику «да/нет».",
    "Python сам следит за памятью: удалять переменные руками почти никогда не нужно.",
    "Первая в мире программистка Ада Лавлейс писала программы ещё до появления компьютеров."
  ];
  var PHRASES = ["Так держать!", "Решено!", "Ты молодец!", "Код работает!", "Ещё одна готова!", "Скелет гордится!", "Отличная работа!"];
  var CODES = ["Секрет: набери 2 2 6 7 (не в поле ввода) и увидишь игру про скелета.", "Секрет: ↑ ↑ ↓ ↓ ← → ← → B A открывает тренировку с бочками.", "Секрет: пять быстрых нажатий на часы в углу открывают игру с бочками."];
  var calm = false; try { calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function box(css) { var d = document.createElement("div"); d.className = "surprise"; d.style.cssText = css; document.body.appendChild(d); return d; }
  function gone(d, ms) { setTimeout(function () { if (d.parentNode) d.remove(); }, ms); d.addEventListener("click", function (e) { if (e.target.tagName !== "BUTTON") d.remove(); }); }
  function needEgg(fn) {
    if (window.Egg) return fn();
    var s = document.createElement("script"); s.src = "egg.js"; s.onload = fn; document.head.appendChild(s);
  }
  var TOAST = "position:fixed;right:12px;bottom:56px;z-index:9000;max-width:min(92vw,360px);background:#ffffe1;border:3px solid #000;box-shadow:5px 5px 0 #000;padding:12px 14px;font:500 15px/1.35 'IBM Plex Mono',monospace;color:#000;cursor:pointer";

  var K = {
    fact: function () {
      var d = box(TOAST); d.setAttribute("role", "status");
      d.innerHTML = "<b>🦴 Знаешь ли ты?</b><br>" + FACTS[Math.floor(Math.random() * FACTS.length)]; gone(d, 9000);
    },
    confetti: function () {
      var cv = document.createElement("canvas"); cv.className = "surprise"; cv.width = innerWidth; cv.height = innerHeight;
      cv.style.cssText = "position:fixed;inset:0;z-index:9000;pointer-events:none"; document.body.appendChild(cv);
      var c = cv.getContext("2d"), SYM = ["★", "❤", "🦴", "♦"], COL = ["#ff4d6d", "#ffe14d", "#4dd2ff", "#7dff6a", "#c77dff"], P = [], t0 = performance.now();
      for (var i = 0; i < 70; i++) P.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .4, v: 120 + Math.random() * 180, s: 14 + Math.random() * 16, w: Math.random() * 6, k: SYM[i % 4], c: COL[i % 5] });
      (function fr(now) {
        var t = (now - t0) / 1000; c.clearRect(0, 0, cv.width, cv.height);
        P.forEach(function (p) { c.globalAlpha = Math.max(0, Math.min(1, 3.2 - t)); c.fillStyle = p.c; c.font = p.s + "px sans-serif"; c.fillText(p.k, p.x + Math.sin(t * 3 + p.w) * 18, p.y + p.v * t); });
        if (t < 3.2 && cv.parentNode) requestAnimationFrame(fr); else cv.remove();
      })(t0);
    },
    walker: function () {
      needEgg(function () {
        var E = window.Egg, cv = document.createElement("canvas"); cv.className = "surprise"; cv.width = 120; cv.height = 90;
        cv.style.cssText = "position:fixed;bottom:44px;left:-130px;z-index:9000;pointer-events:none;image-rendering:pixelated;width:120px;height:90px"; document.body.appendChild(cv);
        var c = cv.getContext("2d"), say = PHRASES[Math.floor(Math.random() * PHRASES.length)], t0 = performance.now(), W = innerWidth + 260;
        c.imageSmoothingEnabled = false;
        (function fr(now) {
          var t = (now - t0) / 1000, x = -130 + t / 5.5 * W; cv.style.left = x + "px"; c.clearRect(0, 0, 120, 90);
          var u = 3, bob = Math.round(Math.sin(t * 10) * 2); E.sprite(c, E.SKULL, 20, 4 + bob, u, { E: "#16060a", X: "#f3ecd8" });
          c.fillStyle = "#f3ecd8"; c.fillRect(38, 52 + bob, 6, 18); c.fillRect(28, 56 + bob, 26, 3); c.fillRect(28, 62 + bob, 26, 3);
          var l = Math.sin(t * 10) > 0 ? 4 : -4; c.fillRect(36 + l, 70 + bob, 5, 14); c.fillRect(42 - l, 70 + bob, 5, 14);
          c.fillStyle = "#000"; c.font = "9px 'Press Start 2P',monospace"; c.fillStyle = "#ffe14d"; c.fillRect(64, 6, 52, 20); c.fillStyle = "#000"; c.font = "8px sans-serif"; c.fillText(say.slice(0, 9), 67, 19);
          if (t < 5.5 && cv.parentNode) requestAnimationFrame(fr); else cv.remove();
        })(t0);
      });
    },
    bonus: function () {
      var d = box(TOAST); d.setAttribute("role", "dialog"); d.style.cursor = "default";
      d.innerHTML = "<b>🎁 Бонус за задание!</b><br>Сыграть в «Убеги от скелета»? Это секретная игра, оценок за неё нет.<div style=\"display:flex;gap:8px;margin-top:10px;flex-wrap:wrap\"><button type=\"button\" class=\"btn\" id=\"sbp\">Сыграть</button><button type=\"button\" class=\"btn ghost\" id=\"sbn\">Не сейчас</button></div>";
      d.querySelector("#sbn").onclick = function () { d.remove(); };
      d.querySelector("#sbp").onclick = function () { d.remove(); needEgg(function () { window.Egg.start(); }); }; gone(d, 14000);
    },
    coin: function () {
      var d = box("position:fixed;z-index:9000;left:" + (8 + Math.random() * 78) + "vw;top:" + (14 + Math.random() * 62) + "vh;font-size:40px;cursor:pointer;filter:drop-shadow(0 0 8px #ffe14d);user-select:none;transition:transform .2s");
      d.textContent = "💀"; d.setAttribute("role", "button"); d.setAttribute("aria-label", "Золотой череп: нажми");
      d.onclick = function () { d.remove(); var m = box(TOAST); m.innerHTML = "<b>💀 Нашёл золотой череп!</b><br>" + CODES[Math.floor(Math.random() * CODES.length)]; gone(m, 10000); };
      setTimeout(function () { if (d.parentNode) d.remove(); }, 7000);
    },
    rain: function () {
      var cv = document.createElement("canvas"); cv.className = "surprise"; cv.width = innerWidth; cv.height = innerHeight;
      cv.style.cssText = "position:fixed;inset:0;z-index:9000;pointer-events:none"; document.body.appendChild(cv);
      var c = cv.getContext("2d"), P = [], t0 = performance.now();
      for (var i = 0; i < 28; i++) P.push({ x: Math.random() * cv.width, d: Math.random() * 1.2, v: 160 + Math.random() * 140, s: 22 + Math.random() * 14 });
      (function fr(now) {
        var t = (now - t0) / 1000; c.clearRect(0, 0, cv.width, cv.height); c.globalAlpha = Math.max(0, Math.min(1, 3.4 - t));
        P.forEach(function (p) { var y = (t - p.d) * p.v - 30; if (y > -30) { c.font = p.s + "px sans-serif"; c.fillText("💀", p.x, y); } });
        if (t < 3.4 && cv.parentNode) requestAnimationFrame(fr); else cv.remove();
      })(t0);
    }
  };
  var CALM = ["fact", "coin", "bonus"], ALL = ["fact", "fact", "confetti", "confetti", "walker", "bonus", "coin", "rain"];
  window.SurpriseRun = function (kind) {
    try {
      var pool = calm ? CALM : ALL;
      kind = kind && K[kind] ? kind : pool[Math.floor(Math.random() * pool.length)];
      K[kind](); return kind;
    } catch (e) { return ""; }
  };
  window.SurpriseKinds = Object.keys(K);
})();
