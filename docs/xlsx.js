/* Чтение выгрузки журнала (.xlsx) прямо в браузере учителя, без библиотек и без отправки файла куда-либо.
   xlsx это zip-архив с xml внутри: достаём таблицы, ищем колонку с ФИО («Студент», «ФИО», «Фамилия») и собираем список.
   На сервер потом уходит только список ФИО, сам файл никуда не уходит. */
(function () {
  function u16(b, i) { return b[i] | (b[i + 1] << 8); }
  function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
  function inflate(data) {
    if (typeof DecompressionStream !== "function") return Promise.reject(new Error("Браузер слишком старый: открой страницу в свежем Chrome, Edge или Firefox."));
    var ds = new DecompressionStream("deflate-raw");
    return new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  /* zip: читаем оглавление в конце файла, потом нужные файлы по их смещениям */
  function unzip(buf) {
    var b = new Uint8Array(buf), e = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
    if (e < 0) return Promise.reject(new Error("Это не файл .xlsx (или он повреждён). Сохрани журнал как «Книга Excel (.xlsx)»."));
    var n = u16(b, e + 10), p = u32(b, e + 16), files = {};
    for (var k = 0; k < n && u32(b, p) === 0x02014b50; k++) {
      var meth = u16(b, p + 10), csz = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), lo = u32(b, p + 42);
      var name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
      var ds = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
      files[name] = { meth: meth, data: b.subarray(ds, ds + csz) };
      p += 46 + nl + xl + cl;
    }
    return files;
  }
  function text(files, name) {
    var f = files[name];
    if (!f) return Promise.resolve("");
    var go = f.meth === 0 ? Promise.resolve(f.data) : f.meth === 8 ? inflate(f.data) : Promise.reject(new Error("Неизвестное сжатие в файле."));
    return go.then(function (u) { return new TextDecoder().decode(u); });
  }
  function xml(s) { return new DOMParser().parseFromString(s, "application/xml"); }
  function tags(node, t) { return node.getElementsByTagNameNS("*", t); }
  function colNum(ref) { var m = /^([A-Z]+)/.exec(ref || ""), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
  /* Возвращает [{name, rows: [[ячейка, ...], ...]}] для каждого листа */
  function read(buf) {
    var files;
    try { files = unzip(buf); } catch (e) { return Promise.reject(e); }
    if (files.then) return files;
    var names = Object.keys(files).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort(function (a, b) { return parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10); });
    if (!names.length) return Promise.reject(new Error("В файле не нашлось листов с таблицей."));
    return Promise.all([text(files, "xl/sharedStrings.xml"), text(files, "xl/workbook.xml")].concat(names.map(function (n) { return text(files, n); }))).then(function (all) {
      var ss = [], titles = [];
      if (all[0]) Array.prototype.forEach.call(tags(xml(all[0]), "si"), function (si) { ss.push(Array.prototype.map.call(tags(si, "t"), function (t) { return t.textContent; }).join("")); });
      if (all[1]) Array.prototype.forEach.call(tags(xml(all[1]), "sheet"), function (s) { titles.push(s.getAttribute("name") || ""); });
      return all.slice(2).map(function (s, si) {
        var rows = [];
        Array.prototype.forEach.call(tags(xml(s), "row"), function (r) {
          var row = [];
          Array.prototype.forEach.call(tags(r, "c"), function (c) {
            var t = c.getAttribute("t"), v = tags(c, "v")[0], val = "";
            if (t === "s" && v) val = ss[+v.textContent] || "";
            else if (t === "inlineStr") val = Array.prototype.map.call(tags(c, "t"), function (x) { return x.textContent; }).join("");
            else if (v) val = v.textContent;
            var ci = colNum(c.getAttribute("r")); row[ci < 0 ? row.length : ci] = val;
          });
          rows.push(row);
        });
        return { name: titles[si] || "Лист " + (si + 1), rows: rows };
      });
    });
  }
  var NAME_RE = /^[А-ЯЁA-Z][а-яёa-z'\-]+(?:\s+[А-ЯЁA-Z][а-яёa-z'\-]+){1,3}$/;
  var HEAD_RE = /студент|фио|ф\.и\.о|фамили|ученик|обучающ/i;
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  /* Ищет в листах колонку с ФИО: сначала по заголовку, иначе ту, где больше всего «Фамилия Имя». */
  function students(sheets) {
    var best = [];
    sheets.forEach(function (sh) {
      var rows = sh.rows, col = -1, start = 0;
      for (var r = 0; r < Math.min(rows.length, 15) && col < 0; r++) for (var c = 0; c < (rows[r] || []).length; c++) if (HEAD_RE.test(clean(rows[r][c]))) { col = c; start = r + 1; break; }
      var cols = col >= 0 ? [col] : [];
      if (col < 0) { var w = 0; rows.forEach(function (r) { w = Math.max(w, r.length); }); for (var i = 0; i < w; i++) cols.push(i); }
      cols.forEach(function (ci) {
        var out = [], seen = {};
        for (var r = start; r < rows.length; r++) { var v = clean((rows[r] || [])[ci]); if (NAME_RE.test(v) && !seen[v]) { seen[v] = 1; out.push(v); } }
        if (out.length > best.length) best = out;
      });
    });
    return best;
  }
  /* Группа из названия файла или листа: «ИИ-136», «9-А» и т.п. */
  function group(fileName, sheets) {
    var src = [String(fileName || "")].concat((sheets || []).map(function (s) { return s.name; }));
    for (var i = 0; i < src.length; i++) { var m = /([А-ЯЁA-Z]{1,5}-\d{2,4})(?!\d)/.exec(src[i]); if (m) return m[1]; }
    return "";
  }
  /* Список из текста: по одному ученику в строке (вставка из журнала, CSV). Номер в начале строки отбрасывается. */
  function fromText(t) {
    var out = [], seen = {};
    String(t || "").split(/\r?\n/).forEach(function (l) {
      l.split(/[;\t]/).forEach(function (c) { var v = clean(c.replace(/^"|"$/g, "")).replace(/^\d+[.)]?\s+/, ""); if (NAME_RE.test(v) && !seen[v]) { seen[v] = 1; out.push(v); } });
    });
    return out;
  }
  window.Xlsx = { read: read, students: students, group: group, fromText: fromText };
})();
