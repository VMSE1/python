/* Связь с сервером курса: профиль, синхронизация прогресса, живые комнаты */
var Net = (function () {
  var BASE = (window.API_BASE || "").replace(/\/+$/, "");
  function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : d; } catch (e) { return d; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function user() { var a = ls("acct", null); return a && a.token ? a : null; }
  function req(method, path, body, extra) {
    if (!BASE) return Promise.reject(new Error("Сервер не подключён"));
    var h = { "Content-Type": "application/json" }, u = user(); if (u) h.Authorization = "Bearer " + u.token;
    for (var k in (extra || {})) h[k] = extra[k];
    var ctl = typeof AbortController === "function" ? new AbortController() : null, to = ctl && setTimeout(function () { ctl.abort(); }, 12000);
    return fetch(BASE + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; });
    }).catch(function (e) { throw new Error(e && e.name === "AbortError" ? "Сервер долго не отвечает" : "Нет связи с сервером. Проверь интернет."); }).finally(function () { if (to) clearTimeout(to); });
  }
  /* результат игры в таблицу лидеров (только вошедшим; ошибки молча игнорируем) */
  function score(game, value) { if (!user() || !BASE) return; try { req("POST", "/api/score", { game: game, score: value }).catch(function () {}); } catch (e) {} }
  function subject() { try { return localStorage.getItem("subject") || ""; } catch (e) { return ""; } }
  function local() { var o = { passed: ls("passed", {}), done: ls("done", {}), played: ls("played", {}), streak: ls("streak", {}), subj: ls("subjp", {}) }, s = subject(); if (s) o.subject = s; return o; }
  function apply(p) {
    if (!p || typeof p !== "object") return;
    ["passed", "done", "played"].forEach(function (k) {
      var l = ls(k, {}), s = p[k] && typeof p[k] === "object" ? p[k] : {}, ch = false;
      for (var i in s) if (s[i] && !l[i]) { l[i] = 1; ch = true; }
      if (ch) lset(k, l);
    });
    /* другие предметы: отметки "sql:1.2" хранятся локально в subjp, на сервере в subj */
    var ql = ls("subjp", {}), qs = p.subj && typeof p.subj === "object" ? p.subj : {}, qc = false;
    for (var q in qs) if (qs[q] && !ql[q]) { ql[q] = 1; qc = true; }
    if (qc) lset("subjp", ql);
    if (p.subject && !subject()) { try { localStorage.setItem("subject", String(p.subject)); } catch (e) {} }
    var sl = ls("streak", {}), ss = p.streak || {};
    if (ss.last && String(ss.last) >= String(sl.last || "")) lset("streak", { last: ss.last, n: ss.n | 0, best: Math.max(ss.best | 0, sl.best | 0), days: Array.isArray(ss.days) ? ss.days : (sl.days || []) });
  }
  /* прогресс принадлежит одному аккаунту: при смене аккаунта и выходе чужие выполненные задания стираем */
  var PKEYS = ["passed", "done", "played", "streak", "hintN", "skull", "subjp", "subject"];
  function wipe() { try { PKEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }
  function owner() { try { var o = localStorage.getItem("powner"); if (o) return o; var a = ls("acct", null); return a && a.nick ? a.nick : ""; } catch (e) { return ""; } }
  function saveUser(j) { var prev = owner(); if (prev && String(prev).toLowerCase() !== String(j.nick).toLowerCase()) wipe(); try { localStorage.setItem("powner", j.nick); } catch (e) {} lset("acct", { token: j.token, nick: j.nick, fio: j.fio, group: j.group }); try { localStorage.setItem("nick", j.nick); localStorage.setItem("fio", j.fio); localStorage.setItem("group", j.group); } catch (e) {} apply(j.progress); }
  var timer = null;
  function sync() {
    if (!user()) return Promise.resolve(null);
    return req("PUT", "/api/progress", { progress: local() }).then(function (j) {
      if (j.status === 401) { try { localStorage.removeItem("acct"); } catch (e) {} return null; }
      if (j.ok) apply(j.progress); return j;
    }).catch(function () { return null; });
  }
  function push() { if (!user()) return; clearTimeout(timer); timer = setTimeout(sync, 1500); }
  function wsUrl() { return BASE.replace(/^http/, "ws") + "/ws"; }
  var api = {
    on: !!BASE, base: BASE, user: user, req: req, score: score, sync: sync, push: push, local: local, wsUrl: wsUrl,
    saveSession: function (j) { saveUser(j); sync(); },
    register: function (o) { return req("POST", "/api/register", o).then(function (j) { if (j.ok) { saveUser(j); sync(); } return j; }); },
    login: function (o) { return req("POST", "/api/login", o).then(function (j) { if (j.ok) { saveUser(j); sync(); } return j; }); },
    logout: function () { var p = user() ? req("POST", "/api/logout").catch(function () {}) : Promise.resolve(); wipe(); try { localStorage.removeItem("acct"); localStorage.removeItem("powner"); } catch (e) {} return p; },
    tkey: function (v) { try { if (v != null) sessionStorage.setItem("tkey", v); return sessionStorage.getItem("tkey") || ""; } catch (e) { return v || ""; } }
  };
  if (BASE && user()) { var last = 0; try { last = +sessionStorage.getItem("nsync") || 0; } catch (e) {} if (Date.now() - last > 60000) { try { sessionStorage.setItem("nsync", Date.now()); } catch (e) {} setTimeout(sync, 800); } }
  try { Object.freeze(api); } catch (e) {}
  return api;
})();
try { Object.defineProperty(window, "Net", { writable: false, configurable: false }); } catch (e) {}
