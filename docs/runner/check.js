/* Запуск проверки в браузере. Использование: BrowserCheck.run(task, code).then(function(res){...}) */
var BrowserCheck = (function () {
  var worker = null, isReady = false, readyCbs = [], seq = 0, pending = {};
  function start() {
    isReady = false;
    worker = new Worker("runner/worker.js", { type: "module" });
    worker.onmessage = function (e) {
      var m = e.data;
      if (m.type === "ready") { isReady = true; readyCbs.splice(0).forEach(function (f) { f(); }); }
      else if (m.type === "result" && pending[m.id]) { var p = pending[m.id]; delete pending[m.id]; clearTimeout(p.t); p.res(m.result); }
    };
    worker.onerror = function () { Object.keys(pending).forEach(function (k) { var p = pending[k]; delete pending[k]; clearTimeout(p.t); p.res({ ok: false, messages: ["Проверка в браузере недоступна. Используй кнопку «Отправить»."], sample: "", unavailable: true }); }); };
  }
  function sameText(a, b) {
    function n(s) { return String(s).replace(/\r\n/g, "\n").trim().split("\n").map(function (l) { return l.replace(/\s+$/, ""); }).join("\n"); }
    return n(a) === n(b);
  }
  return {
    warm: function () { if (!worker) start(); },
    isReady: function () { return isReady; },
    ready: function (cb) { if (!worker) start(); if (isReady) cb(); else readyCbs.push(cb); },
    run: function (task, code) {
      if (task.starter != null && sameText(code, task.starter)) return Promise.resolve({ ok: false, todo: true, messages: [], sample: "" });
      return new Promise(function (resolve) {
        BrowserCheck.ready(function () {
          var id = ++seq, spec = JSON.stringify({ cases: task.cases || [], funcs: task.funcs || [] });
          pending[id] = { res: resolve, t: setTimeout(function () {
            delete pending[id]; worker.terminate(); worker = null; isReady = false;
            resolve({ ok: false, messages: ["Программа не завершилась за 8 секунд. Возможно, бесконечный цикл или лишний input()."], sample: "" });
          }, 8000) };
          worker.postMessage({ id: id, spec: spec, code: code });
        });
      });
    }
  };
})();
