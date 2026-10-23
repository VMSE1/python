/* Запуск SQL в браузере. SqlRun.run({seed, sql, verify, expect, ordered, names}).then(function(r){...})
   r = {ok, error} или {ok:true, res:{cols, rows, more, changed}, pass, msg} */
var SqlRun = (function () {
  var worker = null, isReady = false, readyCbs = [], seq = 0, pending = {};
  function fail(text) { Object.keys(pending).forEach(function (k) { var p = pending[k]; delete pending[k]; clearTimeout(p.t); p.res({ ok: false, error: text }); }); }
  function start() {
    isReady = false;
    worker = new Worker("runner/sqlworker.js", { type: "module" });
    worker.onmessage = function (e) {
      var m = e.data;
      if (m.type === "ready") { isReady = true; readyCbs.splice(0).forEach(function (f) { f(); }); }
      else if (m.type === "result" && pending[m.id]) { var p = pending[m.id]; delete pending[m.id]; clearTimeout(p.t); p.res(m.result); }
    };
    worker.onerror = function () { fail("Тренажёр не загрузился. Обнови страницу."); worker = null; isReady = false; };
  }
  function ready(cb) { if (!worker) start(); if (isReady) cb(); else readyCbs.push(cb); }
  return {
    warm: function () { if (!worker) start(); },
    isReady: function () { return isReady; },
    run: function (o) {
      if (String(o.sql || "").length > 5000) return Promise.resolve({ ok: false, error: "Запрос слишком длинный." });
      return new Promise(function (resolve) {
        ready(function () {
          var id = ++seq;
          pending[id] = { res: resolve, t: setTimeout(function () { delete pending[id]; worker.terminate(); worker = null; isReady = false; resolve({ ok: false, error: "Запрос выполнялся больше 8 секунд и был остановлен." }); }, 8000) };
          worker.postMessage({ id: id, msg: JSON.stringify(o) });
        });
      });
    }
  };
})();
