/* Первое окно сайта: без входа дальше не пустит. Логин, пароль и почта (для восстановления пароля). GitHub не нужен.
   Если сервер не отвечает, показывается кнопка «Продолжить без входа», чтобы сайт не оказался закрыт из-за чужой поломки. */
(function () {
  if (document.getElementById("gate")) return;
  var mode = "up", step = 1, recNick = "", offline = false;
  var css = '#gate{position:fixed;inset:0;z-index:2147481000;background:#008080;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}' +
    '#gate .gw{width:min(520px,100%);margin:auto;background:#c0c0c0;border:0;box-shadow:inset -2px -2px 0 #404040,inset 2px 2px 0 #fff,inset -4px -4px 0 #808080,8px 8px 0 rgba(0,0,0,.55);padding:4px}' +
    '#gate .gt{background:#000080;color:#fff;font:400 12px/1.4 "Press Start 2P",monospace;padding:10px 12px}' +
    '#gate .gb{background:#fff;padding:18px 18px 20px;margin:4px 0 0;color:#000;font:500 16px/1.5 "IBM Plex Mono",monospace}' +
    '#gate h2{font:400 clamp(14px,3.4vw,18px)/1.5 "Press Start 2P",monospace;margin:0 0 8px;color:#000080}' +
    '#gate .sg{display:flex;margin:12px 0}#gate .sg button{flex:1;font:400 11px/1.4 "Press Start 2P",monospace;padding:12px 6px;min-height:48px;border:3px solid #000;background:#eee;cursor:pointer}' +
    '#gate .sg button+button{border-left:0}#gate .sg button.on{background:#000080;color:#fff}' +
    '#gate label{display:block;font:400 11px/1.6 "Press Start 2P",monospace;margin:12px 0 6px;color:#000080}#gate input{box-sizing:border-box;width:100%;font:500 18px "IBM Plex Mono",monospace;padding:12px;border:3px solid #000;min-height:48px;border-radius:0;background:#fff;color:#000}' +
    '#gate input:focus-visible,#gate button:focus-visible,#gate a:focus-visible{outline:3px dashed #c01a2f;outline-offset:2px}' +
    '#gate .go{width:100%;margin-top:16px;font:400 13px/1.4 "Press Start 2P",monospace;padding:16px;min-height:52px;background:#ffe14d;border:3px solid #000;box-shadow:4px 4px 0 #000;cursor:pointer;color:#000}' +
    '#gate .go:disabled{opacity:.6}#gate .er{color:#c01a2f;font-weight:700;min-height:1.5em;margin-top:10px}#gate .ok{color:#1b7a2e;font-weight:700;margin-top:10px}#gate .m{color:#555;font-size:14px}' +
    '#gate .lk{background:none;border:0;color:#000080;text-decoration:underline;font:inherit;cursor:pointer;padding:10px 0;min-height:44px}#gate .opt{font:500 13px "IBM Plex Mono",monospace;color:#777}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var el = document.createElement("div"); el.id = "gate"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Вход на сайт");
  document.body.appendChild(el); document.documentElement.style.overflow = "hidden";
  function $(i) { return el.querySelector("#" + i); }
  function fld(id, label, type, ac, extra) { return '<label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || "text") + '" autocomplete="' + (ac || "off") + '" autocapitalize="off" spellcheck="false"' + (extra || "") + '>'; }
  function frame(inner) { el.innerHTML = '<div class="gw"><div class="gt">PYTHON · Вход</div><div class="gb">' + inner + '</div></div>'; }
  function offBtn() { return offline ? '<p class="m">Сервер сейчас не отвечает.</p><button type="button" class="lk" id="skip">Продолжить без входа</button>' : ""; }
  function bindOff() { var b = $("skip"); if (b) b.onclick = close; }
  function close() { el.remove(); st.remove(); document.documentElement.style.overflow = ""; }
  function ok() { try { localStorage.setItem("pickSubj", "1"); } catch (e) {} location.reload(); } /* после входа сайт покажет выбор предмета */
  /* после слишком многих неверных паролей сервер просит подождать: показываем обратный отсчёт и держим кнопку выключенной */
  function cool(b, sec, label) {
    var t = setInterval(function () { sec--; if (!document.body.contains(b)) { clearInterval(t); return; } if (sec <= 0) { clearInterval(t); b.disabled = false; b.textContent = label; var e = $("ger"); if (e) e.textContent = ""; } else b.textContent = "Подожди " + sec + " с"; }, 1000);
    b.disabled = true; b.textContent = "Подожди " + sec + " с";
  }
  function view() {
    if (mode === "rec") return recView();
    var up = mode === "up";
    frame('<h2>' + (up ? 'Привет! Создай профиль' : 'С возвращением') + '</h2><p class="m">' + (up ? 'Придумай логин и пароль, укажи почту. Почта нужна, чтобы вернуть доступ, если забудешь пароль.' : 'Введи свой логин и пароль.') + '</p>' +
      '<div class="sg" role="tablist"><button type="button" id="tUp" class="' + (up ? "on" : "") + '">Новый</button><button type="button" id="tIn" class="' + (!up ? "on" : "") + '">Уже есть</button></div>' +
      '<form id="gf" novalidate>' + fld("gn", "Логин (3–20 символов)", "text", "username") + fld("gp", "Пароль (от 6 символов)", "password", up ? "new-password" : "current-password") +
      (up ? fld("ge", "Почта", "email", "email", ' inputmode="email"') + fld("gfio", 'Фамилия и имя <span class="opt">(по желанию)</span>', "text", "name") + fld("gg", 'Группа <span class="opt">(по желанию)</span>', "text") : "") +
      '<label style="display:flex;gap:10px;align-items:center;font:500 15px/1.4 \'IBM Plex Mono\',monospace;color:#000;margin-top:14px"><input type="checkbox" id="gs" style="width:22px;height:22px;min-height:0"> Показать пароль</label>' +
      '<div class="er" id="ger" role="alert"></div><button class="go" type="submit" id="ggo">' + (up ? "Начать" : "Войти") + '</button></form>' +
      '<button type="button" class="lk" id="gfg">Забыл пароль?</button>' + offBtn());
    $("tUp").onclick = function () { mode = "up"; view(); }; $("tIn").onclick = function () { mode = "in"; view(); }; $("gfg").onclick = function () { mode = "rec"; step = 1; view(); };
    $("gs").onchange = function () { $("gp").type = $("gs").checked ? "text" : "password"; }; bindOff();
    $("gf").onsubmit = function (e) {
      e.preventDefault(); var n = $("gn").value.trim(), p = $("gp").value, er = $("ger"); er.textContent = "";
      if (!n || !p) { er.textContent = "Впиши логин и пароль."; return; }
      var o = { nick: n, password: p };
      if (up) { o.email = $("ge").value.trim(); if (!o.email) { er.textContent = "Впиши почту."; $("ge").focus(); return; } o.quick = true; o.need_email = true; o.fio = $("gfio").value; o.group = $("gg").value; }
      var b = $("ggo"); b.disabled = true; b.textContent = "Подожди…";
      Net[up ? "register" : "login"](o).then(function (j) {
        if (j.ok) { ok(); return; }
        er.textContent = j.error || "Не получилось. Попробуй ещё раз."; b.disabled = false; b.textContent = up ? "Начать" : "Войти";
        if (j.wait > 0) cool(b, j.wait, up ? "Начать" : "Войти");
      }).catch(function (x) { offline = true; er.textContent = x.message; b.disabled = false; b.textContent = up ? "Начать" : "Войти"; var h = $("gfg"); if (h && !$("skip")) h.insertAdjacentHTML("afterend", offBtn()); bindOff(); });
    };
    setTimeout(function () { var f = $("gn"); if (f) f.focus(); }, 50);
  }
  function recView() {
    if (step === 1) {
      frame('<h2>Забыл пароль</h2><p class="m">Впиши логин или почту. Мы отправим код на почту. Если письмо не придёт, назови логин учителю: он продиктует код.</p>' +
        '<form id="gf" novalidate>' + fld("gl", "Логин или почта", "text", "username") + '<div class="er" id="ger" role="alert"></div><button class="go" type="submit" id="ggo">Получить код</button></form>' +
        '<button type="button" class="lk" id="gbk">Назад</button><button type="button" class="lk" id="ghv" style="margin-left:12px">У меня уже есть код</button>' + offBtn());
      $("gbk").onclick = function () { mode = "in"; view(); }; $("ghv").onclick = function () { step = 2; view(); }; bindOff();
      $("gf").onsubmit = function (e) {
        e.preventDefault(); var v = $("gl").value.trim(), er = $("ger"); er.textContent = ""; if (!v) { er.textContent = "Впиши логин или почту."; return; }
        var b = $("ggo"); b.disabled = true; b.textContent = "Подожди…";
        Net.req("POST", "/api/recover", { login: v }).then(function (j) {
          b.disabled = false; b.textContent = "Получить код"; if (!j.ok) { er.textContent = j.error || "Не получилось."; return; }
          recNick = /@/.test(v) ? "" : v; step = 2; view(); var m = $("gmsg"); if (m) m.textContent = j.msg || "";
        }).catch(function (x) { offline = true; er.textContent = x.message; b.disabled = false; b.textContent = "Получить код"; });
      };
      setTimeout(function () { var f = $("gl"); if (f) f.focus(); }, 50); return;
    }
    frame('<h2>Новый пароль</h2><p class="ok" id="gmsg"></p><p class="m">Впиши логин, шестизначный код и придумай новый пароль.</p>' +
      '<form id="gf" novalidate>' + fld("gn", "Логин", "text", "username") + fld("gc", "Код из письма", "text", "one-time-code", ' inputmode="numeric" maxlength="6"') + fld("gp", "Новый пароль (от 6 символов)", "password", "new-password") +
      '<div class="er" id="ger" role="alert"></div><button class="go" type="submit" id="ggo">Сохранить и войти</button></form><button type="button" class="lk" id="gbk">Назад</button>' + offBtn());
    $("gn").value = recNick; $("gbk").onclick = function () { step = 1; view(); }; bindOff();
    $("gf").onsubmit = function (e) {
      e.preventDefault(); var er = $("ger"); er.textContent = ""; var n = $("gn").value.trim(), c = $("gc").value.trim(), p = $("gp").value;
      if (!n || !c || !p) { er.textContent = "Заполни все поля."; return; }
      var b = $("ggo"); b.disabled = true; b.textContent = "Подожди…";
      Net.req("POST", "/api/recover/confirm", { nick: n, code: c, password: p }).then(function (j) {
        if (j.ok) { try { Net.saveSession(j); } catch (x) {} ok(); return; }
        er.textContent = j.error || "Не получилось."; b.disabled = false; b.textContent = "Сохранить и войти";
      }).catch(function (x) { er.textContent = x.message; b.disabled = false; b.textContent = "Сохранить и войти"; });
    };
  }
  view();
  /* сервер жив? если нет, через 4 секунды предлагаем продолжить без входа */
  var ctl = typeof AbortController === "function" ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
  fetch(Net.base + "/api/ping", { signal: ctl ? ctl.signal : undefined, cache: "no-store" }).then(function (r) { clearTimeout(to); if (!r.ok) throw 0; }).catch(function () { offline = true; if (document.getElementById("gate") && !$("skip")) view(); });
})();
