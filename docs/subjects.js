/* Предметы курса и выбор предмета. Subject.LIST, Subject.get(), Subject.set(id), Subject.pick({onPick}) — окно выбора.
   Прогресс по другим предметам: localStorage "subjp" = {"sql:1.2": 1, ...}; синхронизируется с сервером через Net (ключ subj). */
var Subject = (function () {
  var LIST = [
    { id: "python", title: "Python", sub: "программирование с нуля", icon: "pc", href: "index.html", root: "Python" },
    { id: "sql", title: "SQL и базы данных", sub: "запросы прямо в браузере", icon: "disk", href: "learn.html?s=sql", root: "SQL" },
    { id: "blender", title: "Blender и 3D", sub: "моделирование и горячие клавиши", icon: "cube", href: "learn.html?s=blender", root: "Blender" },
    { id: "ai", title: "Нейросети", sub: "азы и теория ИИ", icon: "bolt", href: "learn.html?s=ai", root: "AI" }
  ];
  function byId(id) { return LIST.filter(function (s) { return s.id === id; })[0] || null; }
  function get() { try { var v = localStorage.getItem("subject") || ""; return byId(v) ? v : ""; } catch (e) { return ""; } }
  function set(id) { if (!byId(id)) return; try { localStorage.setItem("subject", id); localStorage.removeItem("pickSubj"); } catch (e) {} try { if (window.Net && Net.push) Net.push(); } catch (e) {} }
  function prog() { try { var v = JSON.parse(localStorage.getItem("subjp") || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
  function mark(key) { var p = prog(); if (p[key]) return false; p[key] = 1; try { localStorage.setItem("subjp", JSON.stringify(p)); } catch (e) {} try { if (window.Net && Net.push) Net.push(); } catch (e) {} return true; }
  function has(key) { return !!prog()[key]; }
  function close() { var el = document.getElementById("spick"); if (el) el.remove(); var st = document.getElementById("spickCss"); if (st) st.remove(); document.documentElement.style.overflow = ""; }
  function pick(opt) {
    opt = opt || {};
    if (document.getElementById("spick")) return;
    var css = '#spick{position:fixed;inset:0;z-index:2147481500;background:rgba(0,64,64,.92);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}' +
      '#spick .gw{width:min(640px,100%);margin:auto;background:#c0c0c0;box-shadow:inset -2px -2px 0 #404040,inset 2px 2px 0 #fff,inset -4px -4px 0 #808080,8px 8px 0 rgba(0,0,0,.55);padding:4px}' +
      '#spick .gt{background:#000080;color:#fff;font:400 12px/1.4 "Press Start 2P",monospace;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px}' +
      '#spick .gt button{font:400 11px "Press Start 2P",monospace;background:#c0c0c0;border:2px solid #000;min-width:36px;min-height:32px;cursor:pointer}' +
      '#spick .gb{background:#fff;padding:18px;margin-top:4px;color:#000;font:500 16px/1.5 "IBM Plex Mono",monospace}' +
      '#spick h2{font:400 clamp(13px,3.2vw,17px)/1.5 "Press Start 2P",monospace;margin:0 0 6px;color:#000080}' +
      '#spick .sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:14px}' +
      '#spick .sb{display:flex;gap:12px;align-items:center;text-align:left;padding:14px;min-height:72px;border:3px solid #000;background:#fffbdc;box-shadow:4px 4px 0 #000;cursor:pointer;font:inherit;color:#000}' +
      '#spick .sb.on{background:#ffe44d}#spick .sb .pix{width:40px;height:40px;flex:none}#spick .sb b{display:block;font:400 11px/1.5 "Press Start 2P",monospace;color:#000080}#spick .sb small{display:block;color:#555;font-size:14px}' +
      '#spick .sb:focus-visible{outline:3px dashed #c01a2f;outline-offset:3px}@media(hover:hover){#spick .sb:hover{background:#fff59a}}';
    var st = document.createElement("style"); st.id = "spickCss"; st.textContent = css; document.head.appendChild(st);
    var cur = get(), el = document.createElement("div"); el.id = "spick"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Выбор предмета");
    el.innerHTML = '<div class="gw"><div class="gt"><span>Выбор предмета</span>' + (cur ? '<button type="button" id="spx" aria-label="Закрыть">✕</button>' : "") + '</div><div class="gb">' +
      '<h2>' + (opt.title || "Что будем учить?") + '</h2><p style="margin:0;color:#555">Выбери предмет. Поменять можно в любой момент: значок «Предметы» на рабочем столе.</p>' +
      '<div class="sg">' + LIST.map(function (s) { return '<button type="button" class="sb' + (s.id === cur ? " on" : "") + '" data-s="' + s.id + '">' + (window.pix ? pix(s.icon) : "") + '<span><b>' + esc(s.title) + '</b><small>' + esc(s.sub) + '</small></span></button>'; }).join("") + '</div></div></div>';
    document.body.appendChild(el); document.documentElement.style.overflow = "hidden";
    el.querySelectorAll(".sb").forEach(function (b) {
      b.onclick = function () {
        var s = byId(b.dataset.s); set(s.id); close();
        if (opt.onPick) { opt.onPick(s); return; }
        var here = location.pathname.split("/").pop() || "index.html";
        var onIt = s.id === "python" ? /^(index\.html)?$/.test(here) : here === "learn.html" && new URLSearchParams(location.search).get("s") === s.id;
        if (onIt) location.reload(); else location.href = s.href;
      };
    });
    var x = el.querySelector("#spx"); if (x) x.onclick = function () { try { localStorage.removeItem("pickSubj"); } catch (e) {} close(); };
    setTimeout(function () { var f = el.querySelector(".sb.on") || el.querySelector(".sb"); if (f) f.focus(); }, 30);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  return { LIST: LIST, byId: byId, get: get, set: set, pick: pick, close: close, prog: prog, mark: mark, has: has };
})();
