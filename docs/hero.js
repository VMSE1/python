/* Пиксельный персонаж сайта: учитель (экран «Респект») и аватар ученика (профиль).
   Hero.draw(ctx, look, ox, oy, u): рисует спрайт 24×27 клеток, клетка = u пикселей.
   look: {skin 0-3, hair 0-5 (цвет), style 0-3 (причёска), shirt 0-5, glasses 0-1, tie 0-3}. Те же границы проверяет сервер (LOOK_MAX в app.py). */
(function () {
  var MAX = { skin: 3, hair: 5, style: 3, shirt: 5, glasses: 1, tie: 3 };
  var DEF = { skin: 0, hair: 0, style: 0, shirt: 0, glasses: 0, tie: 0 };
  var SKIN = [["#f6c99a", "#d79f6f"], ["#e0ac7a", "#bd8456"], ["#b97f50", "#96603a"], ["#7a4e2d", "#5c3a20"]];
  var HAIR = ["#6b3d12", "#1a1a1a", "#e8c34a", "#b23a1e", "#d8d8d8", "#4a2a8a"];
  var SHIRT = ["#ffffff", "#4aa3ff", "#2a9a2a", "#d03030", "#ffe44d", "#7a1a8a"];
  var TIE = [null, "#d03030", "#3a1aa0", "#ffe44d"];         // 0: без галстука
  var NAMES = { skin: "Кожа", hair: "Цвет волос", style: "Причёска", shirt: "Рубашка", glasses: "Очки", tie: "Галстук" };
  var STYLE_NAMES = ["Короткая", "Длинная", "Ёжик", "Кепка"];
  /* H волосы, S кожа, s тень кожи, W рубашка, R галстук, B брюки, K контур, L глаза/стёкла, Z кепка */
  var BASE = [
    "........................",
    ".........KKKKKKKK.......",
    "........KHHHHHHHHK......",
    "........KHHHHHHHHK......",
    "........KHSSSSSSHK......",
    "........KSSSSSSSSK......",
    "........KSKLKSKLKSK.....",
    "........KSKKKSKKKSK.....",
    "........KSSSSSSSSK......",
    "........KSSSMMSSSK......",
    ".........KSSSSSSK.......",
    "..........KKSSKK........",
    "......KKKKKWWSSWWKKKK...",
    ".....KWWWWWWRRWWWWWWK...",
    "....KWWWWWWWRRWWWWWWWK..",
    "....KWWGWWWWRRWWWWGWWK..",
    "....KWWWGWWWRRWWWGWWWK..",
    "....KWWWWGWWRRWWGWWWWK..",
    "....KWWWWWWWRRWWWWWWWK..",
    "....KSKWWWWWWWWWWWWKSK..",
    "....KSKWWWWWWWWWWWWKSK..",
    ".....KKWWWWWWWWWWWWKK...",
    "......KKBBBBBBBBBBKK....",
    ".......KBBBBBBBBBBK.....",
    ".......KBBBBKKBBBBK.....",
    ".......KBBBBKKBBBBK.....",
    ".......KKKKKKKKKKKK.....",
  ];
  function clean(l) {
    var o = {}; l = l || {};
    for (var k in MAX) { var v = parseInt(l[k], 10); o[k] = isNaN(v) ? DEF[k] : Math.max(0, Math.min(MAX[k], v)); }
    return o;
  }
  function rows(look) {
    var L = clean(look), r = BASE.map(function (s) { return s.split(""); });
    function put(y, x, ch) { if (r[y] && x >= 0 && x < r[y].length) r[y][x] = ch; }
    if (!L.glasses) { for (var gx = 9; gx <= 17; gx++) { put(6, gx, "S"); put(7, gx, "S"); } put(6, 11, "K"); put(6, 15, "K"); put(7, 11, "K"); put(7, 15, "K"); }
    if (L.style === 1) { for (var y = 4; y <= 10; y++) { put(y, 8, "K"); put(y, 7, "K"); put(y, 8, "H"); } for (var y2 = 4; y2 <= 10; y2++) { put(y2, 17, "H"); put(y2, 18, "K"); } put(4, 9, "H"); put(4, 16, "H"); }
    if (L.style === 2) { put(1, 10, "K"); put(0, 10, "K"); put(0, 13, "K"); put(1, 13, "K"); put(0, 15, "K"); put(1, 15, "K"); put(1, 11, "H"); put(1, 12, "H"); put(1, 14, "H"); put(2, 9, "H"); }
    if (L.style === 3) { for (var x = 8; x <= 17; x++) { put(1, x, "K"); put(2, x, "Z"); put(3, x, "Z"); } put(2, 8, "K"); put(3, 8, "K"); put(2, 17, "K"); put(3, 17, "K"); for (var x2 = 17; x2 <= 21; x2++) put(3, x2, x2 === 21 ? "K" : "Z"); for (var x3 = 17; x3 <= 21; x3++) put(4, x3, "K"); put(1, 17, "K"); put(1, 8, "K"); }
    if (!TIE[L.tie]) { for (var yy = 13; yy <= 18; yy++) { put(yy, 12, "W"); put(yy, 13, "W"); } }
    return r;
  }
  function draw(c, look, ox, oy, u) {
    var L = clean(look), r = rows(L), sk = SKIN[L.skin];
    var P = { K: "#1a0f4d", H: HAIR[L.hair], S: sk[0], s: sk[1], M: "#c0392b", W: SHIRT[L.shirt], G: L.shirt === 0 ? "#c0c0c0" : "rgba(0,0,0,.18)", R: TIE[L.tie] || SHIRT[L.shirt], B: "#3a1aa0", L: "#4aa3ff", Z: "#d03030" };
    for (var j = 0; j < r.length; j++) for (var i = 0; i < r[j].length; i++) {
      var ch = r[j][i]; if (ch === "." || !P[ch]) continue;
      c.fillStyle = P[ch]; c.fillRect(ox + i * u, oy + j * u, u, u);
    }
  }
  window.Hero = { draw: draw, clean: clean, max: MAX, def: DEF, names: NAMES, styleNames: STYLE_NAMES, w: 24, h: 27, teacher: { skin: 0, hair: 0, style: 0, shirt: 0, glasses: 1, tie: 1 },
    swatch: { skin: SKIN.map(function (a) { return a[0]; }), hair: HAIR, shirt: SHIRT, tie: ["#ffffff"].concat(TIE.slice(1)) } };
})();
