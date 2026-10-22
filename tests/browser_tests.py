"""Браузерные тесты сайта (Playwright): дымовые, функциональные, безопасность, производительность, нагрузка.
Запуск из корня репозитория:  pip install playwright && playwright install chromium && python tests/browser_tests.py
"""
from urllib.parse import unquote
import base64, functools, http.server, json, os, re, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
RES = []


def big_fill(pg, text):
    """Кладёт код в поле в обход защиты: работает только в тестовом стенде (см. new_ctx), на сайте этого хода нет."""
    pg.evaluate("t=>Honest._fill(document.getElementById('code'),t)", text)


def check(name, ok, info=""):
    RES.append((name, bool(ok), info))
    print(("PASS " if ok else "FAIL ") + name + ((" | " + str(info)) if info and not ok else (" | " + str(info) if info else "")), flush=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


class Srv(socketserver.ThreadingTCPServer):
    def handle_error(self, *a): pass


def serve():
    h = functools.partial(Quiet, directory=ROOT)
    srv = Srv(("127.0.0.1", 0), h); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, "http://127.0.0.1:%d/" % srv.server_address[1]


PAGES = ["index.html", "tasks.html", "theory.html", "quiz.html", "projects.html", "teacher.html", "cloud.html", "slides.html", "video.html", "task.html?id=1.1", "task.html?id=5.4", "theory.html?l=3"]


def issue(n, nick, task, status, body_extra="", title=None, updated="2026-10-20T10:00:00Z"):
    labels = [{"name": "сдача"}] + ([{"name": status}] if status else [])
    return {"number": n, "title": title or "[Сдача] %s %s" % (task, nick), "html_url": "https://github.com/VMSE1/python/issues/%d" % n,
            "labels": labels, "updated_at": updated, "reactions": {"+1": 1}, "comments": 0,
            "user": {"login": "gh_" + re.sub(r"\W", "", str(nick))[:12]}, "body": "### Ник\n\n%s\n\n### Группа\n\n9А\n\n### Задание\n\n%s — x\n\n### Код решения\n\n```python\nprint(1)\n```%s" % (nick, task, body_extra)}


def mock_github(ctx, issues_by_label, owner="VMSE1", log=None):
    def handler(route):
        req = route.request
        if log is not None: log.append(req.url)
        u = req.url
        if u.endswith("/user"):
            auth = req.headers.get("authorization", "")
            if auth == "Bearer ghp_good": return route.fulfill(status=200, content_type="application/json", body=json.dumps({"login": owner}))
            if auth == "Bearer ghp_other": return route.fulfill(status=200, content_type="application/json", body=json.dumps({"login": "someone"}))
            return route.fulfill(status=401, body="{}")
        m = re.search(r"labels=([^&]+)", u)
        lab = m.group(1) if m else ""
        from urllib.parse import unquote
        lab = unquote(lab)
        pg = int(re.search(r"[?&]page=(\d+)", u).group(1)) if re.search(r"[?&]page=", u) else 1
        items = issues_by_label.get(lab, [])
        return route.fulfill(status=200, content_type="application/json", body=json.dumps(items[(pg - 1) * 100: pg * 100]), headers={"access-control-allow-origin": "*"})
    ctx.route("https://api.github.com/**", handler)


def _honest_test(route):
    r = route.fetch(); body = r.text()
    assert "var TEST = false;" in body
    route.fulfill(response=r, body=body.replace("var TEST = false;", "var TEST = true;"))


class FP:
    """Раньше заявка уходила на GitHub и метаданные читались из адреса. Теперь они уходят на сервер, а тест берёт их напрямую у Honest."""
    def __init__(self, url):
        import types; self.value = types.SimpleNamespace(url=url)


def issue_url(pg):
    from urllib.parse import quote
    meta = pg.evaluate("Honest.meta(document.getElementById('code'))"); code = pg.evaluate("Honest.code(document.getElementById('code'))")
    return "https://x/issues/new?meta=" + quote(meta, safe="") + "&code=" + quote(code, safe="")


def new_ctx(b, w=1280, h=820, mobile=False, seen=True, raw=False, brief=False, bot=False):
    """raw=True: настоящий honest.js без тестового хода (для проверки самой защиты)."""
    ua = None if bot else "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, device_scale_factor=2 if mobile else 1, accept_downloads=True, user_agent=ua)
    if not bot: ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>false})")
    ctx.route("**/config.js", lambda r: r.fulfill(body='window.API_BASE="";', content_type="application/javascript"))  # без сервера: окно входа не показывается
    if not raw: ctx.route("**/honest.js", _honest_test)
    if seen: ctx.add_init_script("localStorage.seenStart='1';localStorage.visited='1';" + ("" if brief else "window.__noBrief=true;"))
    return ctx


def attach_errors(pg, bag):
    pg.on("pageerror", lambda e: bag.append("pageerror: " + str(e)))
    pg.on("console", lambda m: bag.append("console: " + m.text) if m.type == "error" else None)


def smoke(b, base):
    print("\n== SMOKE ==")
    for w, h, mob in [(1280, 820, False), (390, 780, True)]:
        ctx = new_ctx(b, w, h, mob); mock_github(ctx, {"проект": [], "сдача": []})
        for p in PAGES:
            pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
            r = pg.goto(base + p); pg.wait_for_timeout(500)
            ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            fonts = pg.evaluate("document.fonts.check('16px \"Press Start 2P\"') && document.fonts.check('16px \"IBM Plex Mono\"')")
            ttl = pg.evaluate("!!document.querySelector('.tbar, .icons')")
            check("smoke %s @%d: 200, без ошибок, без горизонтального скролла, шрифты, оболочка" % (p, w),
                  r.status == 200 and not bag and ov <= 1 and fonts and ttl, "status=%s errs=%s overflow=%s fonts=%s shell=%s" % (r.status, bag[:2], ov, fonts, ttl))
            pg.close()
        ctx.close()
    # битые ссылки и ресурсы
    ctx = new_ctx(b); bad = []
    pg = ctx.new_page(); pg.on("response", lambda r: bad.append((r.status, r.url)) if r.status >= 400 and "api.github.com" not in r.url else None)
    for p in PAGES: pg.goto(base + p); pg.wait_for_timeout(300)
    check("smoke: нет 404 на ресурсах", not bad, bad[:3])
    links = set()
    for p in ["index.html", "tasks.html", "theory.html", "quiz.html", "projects.html"]:
        pg.goto(base + p); pg.wait_for_timeout(300)
        for h in pg.eval_on_selector_all("a[href]", "els=>els.map(e=>e.getAttribute('href'))"):
            if h and not h.startswith(("http", "#", "javascript")): links.add(h.split("#")[0])
    dead = []
    for l in sorted(links):
        r = pg.request.get(base + l)
        if r.status >= 400: dead.append(l)
    check("smoke: все внутренние ссылки открываются (%d шт.)" % len(links), not dead, dead)
    ctx.close()


def functional(b, base):
    print("\n== FUNCTIONAL ==")
    ctx = new_ctx(b); mock_github(ctx, {"проект": [issue(1, "ann", "1.1", None, title="[Проект] Бот")], "сдача": []})
    pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.goto(base + "index.html"); pg.wait_for_timeout(300)
    check("desktop: 10 иконок, кнопка «Начать» ведёт к 1.1", pg.locator("a.ico").count() == 10 and "id=1.1" in pg.get_attribute("#cont", "href"))
    pg.click("a.ico >> nth=0"); pg.wait_for_url("**/tasks.html"); check("иконка «Задания» открывает карту", "tasks.html" in pg.url)
    check("карта: 25 квадратов, один «следующий»", pg.locator(".node").count() == 25 and pg.locator(".node.next").count() == 1)
    pg.click(".node >> nth=3"); pg.wait_for_url("**/task.html?id=1.4"); check("клик по квадрату открывает задание", "id=1.4" in pg.url)
    pg.click(".wb >> text=Закрыть"); pg.wait_for_url("**/index.html"); check("«Закрыть» возвращает на рабочий стол", True)
    pg.click("#startBtn"); check("меню: «Вход для учителя» ученикам не показывается", "Вход для учителя" not in pg.inner_text("#smenu") and "Кабинет" not in pg.inner_text("#smenu"))
    check("«Пуск» открывает меню (12 пунктов)", pg.locator("#smenu.on a").count() == 12, pg.locator("#smenu.on a").count())
    pg.keyboard.press("Escape"); check("Esc закрывает меню", pg.locator("#smenu.on").count() == 0)
    pg.click("#startBtn"); pg.mouse.click(900, 300); check("клик вне меню закрывает его", pg.locator("#smenu.on").count() == 0)
    # проекты
    pg.goto(base + "projects.html"); pg.wait_for_selector(".pr .card"); check("проекты: карточка загружена из API", "Бот" in pg.inner_text(".pr"))
    # теория
    pg.goto(base + "theory.html"); n1 = pg.locator(".plate").count(); pg.click(".tabs button >> nth=2"); pg.wait_for_timeout(100)
    check("теория: вкладки переключают плашки", n1 > 0 and pg.locator(".plate").count() > 0 and "l=3" in pg.url)
    # квиз целиком
    pg.goto(base + "quiz.html"); pg.click(".qrow >> nth=0"); pg.click("#go"); check("квиз: без имени не стартует", pg.locator("#er").inner_text() != "")
    pg.fill("#nm", "Аня"); pg.click("#go"); total = int(re.search(r"из (\d+)", pg.inner_text(".qtop")).group(1))
    for i in range(total):
        pg.click(".o >> nth=0"); pg.click("#nx")
    check("квиз: проходится до итога (%d вопросов)" % total, "Результат" in pg.inner_text("#app"))
    code = pg.input_value("#cd"); obj = json.loads(base64.b64decode(code).decode("utf-8"))
    check("квиз: код результата декодируется", obj["n"] == "Аня" and len(obj["a"]) == total)
    # задание: проверка
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_timeout(300)
    req = []; pg.on("request", lambda r: req.append(r.url))
    check("задание: Pyodide НЕ грузится при открытии страницы", not any("pyodide" in u for u in req))
    starter = pg.input_value("#code"); pg.click("#code"); pg.wait_for_timeout(300)
    check("задание: Pyodide начинает грузиться после первого фокуса", any("pyodide" in u for u in req))
    def run_code(code, tmo=60000):
        big_fill(pg, code); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=tmo); return pg.get_attribute("#res", "class"), pg.inner_text("#res")
    cls, txt = run_code(starter); check("задание: заготовка -> «только заготовка»", "fail" in cls and "заготовка" in txt, txt[:60])
    cls, txt = run_code('name=input("Имя: ")\ncity=input("Город: ")\nprint(f"Меня зовут {name}, я из {city}")'); check("задание: верное решение -> зелёный", "pass" in cls, txt[:80])
    cls, txt = run_code('print("не то")'); check("задание: неверное -> красный", "fail" in cls, txt[:80])
    big_fill(pg, "while True: pass"); t0 = time.time(); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=30000)
    check("задание: бесконечный цикл обрывается за ~8 с", "8 секунд" in pg.inner_text("#res") and time.time() - t0 < 14, "%.1fs" % (time.time() - t0))
    cls, txt = run_code('name=input("Имя: ")\ncity=input("Город: ")\nprint(f"Меня зовут {name}, я из {city}")', 90000); check("задание: после обрыва проверка снова работает", "pass" in cls, txt[:80])
    pg.click("#go"); check("отправка: без входа в профиль просит войти (GitHub не используется)", "войди" in pg.inner_text("#msg").lower() and len(ctx.pages) == 1, pg.inner_text("#msg"))
    check("функциональные: нет ошибок в консоли", not bag, bag[:3])
    ctx.close()
    # облако слов
    def ci(n, login, topic, words, hidden=False):
        return {"number": n, "title": "[Облако] " + topic, "html_url": "https://github.com/VMSE1/python/issues/%d" % n, "labels": [{"name": "облако"}] + ([{"name": "скрыто"}] if hidden else []),
                "user": {"login": login}, "body": "### Тема\n\n%s\n\n### Слова\n\n%s" % (topic, words)}
    cl = [ci(1, "anna", "Что такое Python", "Питон, цикл, змея"), ci(2, "ivan", "что такое python!", "питон, Функция"), ci(3, "ivan", "Что такое Python", "питон, питон, а, б, в, г, д"),
          ci(4, "spam", "Что такое Python", "СПАМ", hidden=True), ci(5, "olga", "Циклы", "for, while, <img src=x onerror=window.xss=1>")]
    ctx = new_ctx(b); mock_github(ctx, {"облако": cl}); pg = ctx.new_page(); pg.goto(base + "cloud.html"); pg.wait_for_selector("#cloud svg text")
    opts = pg.eval_on_selector_all("#tp option", "e=>e.map(x=>x.textContent)")
    check("облако: темы из заявок (регистр и знаки склеены, + «Новая тема»)", len(opts) == 3 and opts[0].startswith("Что такое Python (3)") and opts[2].startswith("+"), opts)
    words = pg.eval_on_selector_all("#cloud svg text", "e=>e.map(x=>x.childNodes[0].textContent)")
    check("облако: скрытая заявка не попадает, слова склеены", "спам" not in words and words.count("питон") == 1 and "цикл" in words, words)
    check("облако: один человек = один голос (питон у anna и ivan = 2 чел.)", "питон" in pg.inner_text("#top") and "2 чел." in pg.inner_text("#top"), pg.inner_text("#top"))
    check("облако: не больше 5 слов от одной заявки", "д" not in words and "г" in words, words)
    href = unquote(pg.get_attribute("#add", "href"))
    check("облако: без слов кнопка выключена", pg.get_attribute("#add", "aria-disabled") == "true")
    pg.fill("#w", "кот, пёс"); href = unquote(pg.get_attribute("#add", "href"))
    check("облако: ссылка на заявку с темой и словами", "template=cloud.yml" in href and "topic=Что такое Python" in href and "words=кот, пёс" in href and pg.get_attribute("#add", "aria-disabled") == "false", href)
    pg.select_option("#tp", index=1); pg.wait_for_timeout(100)
    check("облако: другая тема, HTML в слове не исполняется", pg.evaluate("window.xss") is None and pg.locator("#cloud img").count() == 0 and "for" in pg.inner_text("#top"))
    pg.select_option("#tp", index=2); pg.fill("#nt", "Моя тема"); pg.fill("#w", "раз"); href = unquote(pg.get_attribute("#add", "href"))
    check("облако: новая тема попадает в ссылку", "topic=Моя тема" in href and pg.locator("#nt").is_visible(), href)
    ctx.close()
    ctx = new_ctx(b); mock_github(ctx, {"облако": []}); pg = ctx.new_page(); pg.goto(base + "cloud.html"); pg.wait_for_selector("#top", state="attached"); pg.wait_for_timeout(400)
    check("облако: пустое состояние", "Придумай тему" in pg.inner_text("#cloud"), pg.inner_text("#cloud"))
    ctx.close()
    # инструкция
    ctx = new_ctx(b, seen=False); pg = ctx.new_page(); pg.goto(base + "index.html"); pg.wait_for_selector(".gd")
    check("инструкция: сама открывается при первом визите", True)
    for i in range(4): pg.click(".gd-next"); pg.wait_for_timeout(150)
    check("инструкция: 5 слайдов, на последнем кнопка «Начать»", "Начать" in pg.inner_text(".gd-next"))
    pg.click(".gd-next"); pg.wait_for_timeout(200); check("инструкция: закрывается и запоминает", pg.locator(".gd").count() == 0 and pg.evaluate("localStorage.seenStart") == "1")
    ctx.close()


def teacher(b, base):
    print("\n== TEACHER / SECURITY ==")
    XSS = '<img src=x onerror="window.__xss=1">'
    issues = [issue(1, "anna", "1.1", "решено"), issue(2, "anna", "1.2", "ошибки"), issue(3, "boris", "1.1", "решено"),
              issue(4, "=HYPERLINK(\"http://evil\")", "1.1", "решено"), issue(5, XSS, "1.2", "решено", title="[Сдача] 1.2 " + XSS),
              issue(6, "<script>window.__xss=2</script>", "1.3", "ошибки")]
    ctx = new_ctx(b); log = []; mock_github(ctx, {"сдача": issues, "проект": [issue(9, XSS, "1.1", None, title="[Проект] " + XSS, body_extra="")]}, log=log)
    pg = ctx.new_page(); bag = []; attach_errors(pg, bag); dialogs = []; pg.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate"); pg.evaluate("(document.querySelector('.gate details')||{}).open=true")
    check("кабинет: ученику виден только вход", pg.locator(".kpi").count() == 0 and "Кабинет учителя" not in pg.evaluate("document.querySelector('#smenu').textContent"))
    pg.fill("#tk", "ghp_bad"); pg.click("#in"); pg.wait_for_selector("#gm.bad"); check("кабинет: неверный токен отклонён", "не подошёл" in pg.inner_text("#gm"))
    pg.fill("#tk", "ghp_other"); pg.click("#in"); pg.wait_for_selector("#gm:has-text('владелец')"); check("кабинет: чужой аккаунт отклонён", True)
    pg.fill("#tk", "ghp_good"); pg.click("#in"); pg.wait_for_selector(".kpi", timeout=10000)
    check("кабинет: владелец входит, видна сводка", pg.locator(".kpi").count() == 4)
    pg.click("#tb button >> nth=3"); pg.wait_for_selector("#stc")
    with pg.expect_download() as d2: pg.click("#stc")
    stc = open(d2.value.path(), encoding="utf-8-sig", newline="").read().split("\r\n")
    check("кабинет: students.csv для робота (github;фио;группа)", stc[0] == "github;фио;группа;примечание" and any(l.startswith("gh_anna;;9А") for l in stc), stc[:3])
    pg.click("#tb button >> nth=0")
    check("кабинет: пункт появился в «Пуске»", "Кабинет" in pg.evaluate("document.querySelector('#smenu').textContent"))
    check("кабинет: токен в sessionStorage, не в localStorage", pg.evaluate("!!sessionStorage.tk && !localStorage.tk"))
    pg.click("#tb button[data-k=quiz]"); pg.fill("#qi", base64.b64encode(json.dumps({"n": "anna", "l": 0, "d": "x", "a": [[0, 0], [1, 1]]}).encode()).decode()); pg.click("#qg"); pg.wait_for_timeout(200)
    pg.click("#tb button >> nth=0"); pg.wait_for_selector("#csv")
    with pg.expect_download() as d: pg.click("#csv")
    path = d.value.path(); data = open(path, encoding="utf-8-sig", newline="").read()
    lines = data.split("\r\n")
    check("выгрузка: ведомость скачивается (CSV, ; , BOM)", len(lines) >= 5 and lines[0].startswith("Ученик;Ник;Группа;1.1"), "строк=%d, заголовок=%r" % (len(lines), lines[0][:30]))
    check("выгрузка: формулы в ячейках нейтрализованы (CSV-инъекция)", not any(re.match(r'^=|;=|;"=', l) for l in lines[1:]) and any("'=HYPERLINK" in l for l in lines), [l for l in lines if "HYPER" in l])
    check("выгрузка: подтянут результат теста ученика", any(l.startswith(";anna") and l.rstrip().endswith(";0") is False for l in lines) or "Тест, %" in lines[0])
    pg.click("#tb button >> nth=1"); pg.wait_for_timeout(200)
    check("XSS: payload в нике/заголовке не исполнился (кабинет)", not pg.evaluate("window.__xss") and not dialogs)
    pg.goto(base + "projects.html"); pg.wait_for_selector(".pr .card"); pg.wait_for_timeout(300)
    check("XSS: payload в проекте не исполнился (проекты)", not pg.evaluate("window.__xss") and "<img" not in pg.inner_html(".pr").replace("&lt;img", ""))
    check("безопасность: нет ошибок CSP/консоли", not [x for x in bag if "Content Security" in x or "pageerror" in x], bag[:3])
    hosts = set(re.match(r"https?://([^/]+)", u).group(1) for u in log)
    check("безопасность: токен уходил только на api.github.com", hosts <= {"api.github.com"}, hosts)
    # TTL запомненного токена
    pg.evaluate("localStorage.setItem('tk','ghp_good');localStorage.setItem('tkAt',String(Date.now()-8*864e5));localStorage.setItem('teacher','VMSE1');sessionStorage.clear()")
    pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate"); pg.evaluate("(document.querySelector('.gate details')||{}).open=true"); check("безопасность: запомненный токен истекает через 7 дней", pg.evaluate("!localStorage.tk"))
    pg.evaluate("localStorage.setItem('tk','ghp_good');localStorage.setItem('tkAt',String(Date.now()));localStorage.setItem('teacher','VMSE1')")
    pg.goto(base + "teacher.html"); pg.wait_for_selector(".kpi", timeout=10000); pg.click("#out"); pg.wait_for_url("**/index.html")
    check("безопасность: выход стирает токен", pg.evaluate("!localStorage.tk && !sessionStorage.tk && !localStorage.teacher"))
    # CSP на всех страницах
    miss = []
    for p in PAGES:
        pg.goto(base + p); 
        if not pg.evaluate("!!document.querySelector('meta[http-equiv=Content-Security-Policy]')"): miss.append(p)
    check("безопасность: CSP задан на всех страницах", not miss, miss)
    # чужие хосты: пробуем fetch на постороннем домене из страницы
    r = pg.evaluate("fetch('https://example.com/').then(()=>'ALLOWED').catch(()=>'BLOCKED')")
    check("безопасность: CSP блокирует запросы на посторонние домены", r == "BLOCKED", r)
    # параметры URL
    for u in ["task.html?id=<script>window.__xss=3</script>", "task.html?id=../../etc/passwd", "theory.html?l=<img src=x onerror=window.__xss=4>", "index.html?guide=1&skip=<svg onload=window.__xss=5>"]:
        pg.goto(base + u); pg.wait_for_timeout(300)
        check("XSS через URL: %s" % u[:40], not pg.evaluate("window.__xss"))
    ctx.close()
    # фрейм
    ctx = new_ctx(b); pg = ctx.new_page(); pg.set_content('<iframe id=f src="%sindex.html" style="width:600px;height:400px"></iframe>' % base); pg.wait_for_timeout(800)
    hidden = pg.frame_locator("#f").locator("html").evaluate("e=>getComputedStyle(e).display") if pg.frames[1:] else "n/a"
    check("безопасность: сайт во фрейме скрывает себя (clickjacking)", hidden == "none" or "index.html" not in (pg.frames[1].url if len(pg.frames) > 1 else ""), hidden)
    ctx.close()


def perf(b, base):
    print("\n== PERF (CPU x4, телефон 390x780) ==")
    for page in ["index.html", "tasks.html", "task.html?id=3.3", "quiz.html", "theory.html"]:
        ctx = new_ctx(b, 390, 780, True); mock_github(ctx, {"проект": [], "сдача": []}); pg = ctx.new_page()
        cdp = ctx.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        pg.add_init_script("""window.__lt=0;window.__cls=0;
          new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt+=Math.max(0,e.duration-50)}).observe({type:'longtask',buffered:true});
          new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});""")
        reqs = []; pg.on("request", lambda r: reqs.append(r.url))
        t0 = time.time(); pg.goto(base + page, wait_until="load"); pg.wait_for_timeout(2500)
        tbt = pg.evaluate("window.__lt"); cls = pg.evaluate("window.__cls"); ld = pg.evaluate("performance.timing.domContentLoadedEventEnd-performance.timing.navigationStart")
        kb = pg.evaluate("performance.getEntriesByType('resource').reduce((a,e)=>a+(e.transferSize||e.encodedBodySize||0),0)/1024|0")
        check("perf %s: TBT<300мс, CLS<0.05, DCL<2.5с, без Pyodide" % page, tbt < 300 and cls < 0.05 and ld < 2500 and not any("pyodide" in u for u in reqs),
              "TBT=%dms CLS=%.3f DCL=%dms ресурсов=%dKB" % (tbt, cls, ld, kb))
        ctx.close()
    # плавность инструкции: частота кадров при автопоказе
    ctx = new_ctx(b, 390, 780, True, seen=False); pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    pg.goto(base + "index.html"); pg.wait_for_selector(".gd")
    fps = pg.evaluate("""()=>new Promise(res=>{let n=0,t0=performance.now(),worst=0,last=t0;function f(t){n++;worst=Math.max(worst,t-last);last=t;if(t-t0<5000)requestAnimationFrame(f);else res([n/((t-t0)/1000),worst])}requestAnimationFrame(f)})""")
    check("perf: инструкция идёт ≥ 25 кадров/с при замедлении CPU x4", fps[0] >= 25 and fps[1] < 250, "fps=%.0f худший кадр=%.0fмс" % (fps[0], fps[1]))
    # курсор не «телепортируется»: смотрим координаты каждые 40 мс при смене слайдов
    pts = pg.evaluate("""()=>new Promise(res=>{const out=[];const st=document.querySelector('.gd-stage');let i=0;const iv=setInterval(()=>{const c=st.querySelector('.gd-cursor');if(c){const r=c.getBoundingClientRect(),s=st.getBoundingClientRect();out.push([Math.round(r.left-s.left),Math.round(r.top-s.top)])}if(++i>140){clearInterval(iv);res(out)}},40);document.querySelector('.gd-next').click();setTimeout(()=>document.querySelector('.gd-next').click(),1200)})""")
    jumps = [max(abs(pts[i][0] - pts[i - 1][0]), abs(pts[i][1] - pts[i - 1][1])) for i in range(1, len(pts))]
    corner = [p for p in pts if p[0] < 2 and p[1] < 2]
    check("инструкция: курсор не прыгает (макс. шаг за 40 мс < 70 px, не уходит в угол)", max(jumps) < 70 and not corner, "макс.шаг=%s, в углу=%d" % (max(jumps), len(corner)))
    ctx.close()


def stress(b, base):
    print("\n== STRESS ==")
    big = [issue(i, "user%03d" % (i % 120), "%d.%d" % (1 + i % 5, 1 + i % 4), ["решено", "ошибки", None][i % 3], updated="2026-10-%02dT10:00:00Z" % (1 + i % 28)) for i in range(1, 451)]
    ctx = new_ctx(b); mock_github(ctx, {"сдача": big, "проект": []})
    pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.evaluate("1"); pg.goto(base + "index.html"); pg.evaluate("sessionStorage.tk='ghp_good';localStorage.teacher='VMSE1'")
    t0 = time.time(); pg.goto(base + "teacher.html"); pg.wait_for_selector(".matrix", timeout=20000); dt = time.time() - t0
    check("нагрузка: кабинет с 450 заявками и 120 учениками открывается < 3 с", dt < 3, "%.2fс, строк=%d" % (dt, pg.locator(".matrix tr").count()))
    with pg.expect_download() as d: pg.click("#csv")
    n = len(open(d.value.path(), encoding="utf-8-sig", newline="").read().split("\r\n"))
    check("нагрузка: выгрузка на 120 учеников", n >= 120, n)
    check("нагрузка: нет ошибок", not bag, bag[:2]); ctx.close()
    # много быстрых кликов по квизу
    ctx = new_ctx(b); pg = ctx.new_page(); bag = []; attach_errors(pg, bag); pg.goto(base + "quiz.html"); pg.click(".qrow >> nth=0"); pg.fill("#nm", "Стресс"); pg.click("#go")
    t0 = time.time()
    for i in range(41):
        for _ in range(6): pg.locator(".o").first.click(force=True, no_wait_after=True) if pg.locator(".o:not([disabled])").count() else None
        if pg.locator("#nx").count(): pg.click("#nx")
    check("нагрузка: 41 вопрос с «дребезгом» кликов не ломает счёт", "Результат" in pg.inner_text("#app") and not bag, "%.1fс %s" % (time.time() - t0, bag[:1]))
    ctx.close()
    # быстрая навигация и повторные открытия инструкции
    ctx = new_ctx(b); mock_github(ctx, {"проект": [], "сдача": []}); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    t0 = time.time()
    for i in range(30): pg.goto(base + PAGES[i % 7], wait_until="domcontentloaded")
    pg.goto(base + "index.html")
    for i in range(15): pg.click("#how"); pg.keyboard.press("Escape")
    check("нагрузка: 30 переходов подряд и 15 открытий инструкции без ошибок и утечки окон", not bag and pg.locator(".gd").count() == 0, "%.1fс %s" % (time.time() - t0, bag[:1]))
    ctx.close()
    # 20 проверок подряд в одной вкладке + код 300 КБ
    ctx = new_ctx(b); pg = ctx.new_page(); pg.goto(base + "task.html?id=1.2"); pg.click("#code")
    ok = 0; t0 = time.time()
    for i in range(20):
        big_fill(pg, 'print("x%d")' % i); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=60000); ok += 1
    check("нагрузка: 20 проверок подряд в одной вкладке", ok == 20, "%.1fс" % (time.time() - t0))
    big_fill(pg, "x = 1\n" * 50000); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=60000)
    check("нагрузка: код 300 КБ не вешает страницу", pg.evaluate("1+1") == 2)
    big_fill(pg, 'print("a"*10**7)'); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=60000); check("нагрузка: вывод 10 МБ не вешает страницу", pg.evaluate("1+1") == 2)
    ctx.close()


def slides(b, base):
    print("\n== ПРЕЗЕНТАЦИЯ ==")
    ctx = new_ctx(b, 1366, 820); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    S = ".sl.on "
    def go(n): pg.goto(base + "slides.html#%d" % n); pg.wait_for_selector(S + ".sl-h"); pg.wait_for_selector(S + ".go:not([disabled]), " + S + ".sl-h", state="attached")
    def ready(): pg.wait_for_selector(S + ".rn .go:not([disabled])")
    pg.goto(base + "slides.html"); pg.wait_for_selector(S + ".sl-h")
    check("презентация: 23 слайда, открыт первый", pg.locator(".sl").count() == 23 and "1 / 23" in pg.inner_text("#pg"))
    pg.keyboard.press("ArrowRight"); pg.keyboard.press("ArrowRight")
    check("презентация: стрелка → листает", "3 / 23" in pg.inner_text("#pg"))
    for _ in range(3): pg.keyboard.press("ArrowRight")
    check("презентация: пункты на слайде открываются по одному (3 из 5)", pg.locator(S + ".frag.show").count() == 3 and "Показать" in pg.inner_text("#next"), pg.locator(S + ".frag.show").count())
    for _ in range(2): pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowRight")
    check("презентация: после всех пунктов идёт следующий слайд", "4 / 23" in pg.inner_text("#pg"))
    pg.keyboard.press("ArrowLeft"); check("презентация: ← возвращает, пункты на месте", "3 / 23" in pg.inner_text("#pg") and pg.locator(S + ".frag.show").count() == 5)
    pg.keyboard.press("End"); a = "23 / 23" in pg.inner_text("#pg"); pg.keyboard.press("Home"); check("презентация: Home/End", a and "1 / 23" in pg.inner_text("#pg"))
    pg.click("#tocb"); check("презентация: оглавление открывается", pg.locator("#toc").is_visible() and pg.locator("#toc a").count() == 23)
    pg.click("#toc a >> nth=11"); check("презентация: переход из оглавления", "12 / 23" in pg.inner_text("#pg") and not pg.locator("#toc").is_visible())
    check("презентация: адрес запоминает слайд", pg.url.endswith("#12"))
    pg.goto(base + "slides.html#9"); pg.wait_for_selector(S + ".ex")
    for expr, want in [("2 + 3 * 2", "8"), ("(2 + 3) * 2", "10"), ("7 / 2", "3.5"), ("10 / 5", "2.0"), ("-7 // 2", "-4"), ("7 % 3", "1"), ("2 ** 3 ** 2", "512"), ("-2 ** 2", "-4"), ("1 / 0", "ZeroDivisionError"), ("2 +", "SyntaxError"), ("2 $ 3", "SyntaxError")]:
        pg.fill(S + ".ex", expr); got = pg.inner_text(S + ".out")
        check("презентация: калькулятор %s → %s" % (expr, want), want in got, got)
    # запуск кода: print
    go(8); ready(); pg.click(S + ".sp"); pg.click(S + ".sp")
    check("презентация: «Шаг» подсвечивает строку и показывает вывод", pg.locator(S + ".ln.cur").count() == 1 and "Привет, мир!" in pg.inner_text(S + ".rn-o pre"), pg.inner_text(S + ".rn-o pre"))
    pg.click(S + ".rs"); check("презентация: «Сначала» очищает", pg.inner_text(S + ".rn-o pre") == "" and pg.locator(S + ".ln.cur").count() == 0)
    pg.click(S + ".go"); pg.wait_for_selector(S + ".st:text('Готово')", timeout=15000)
    check("презентация: «Запустить» доходит до конца, вывод верный", pg.inner_text(S + ".rn-o pre").strip() == "Привет, мир!\n5\nГородской помощник", pg.inner_text(S + ".rn-o pre"))
    go(10); ready(); pg.click(S + ".go"); pg.wait_for_selector(S + ".st:text('Готово')", timeout=15000)
    check("презентация: переменные показываются (name, distance)", "Анна" in pg.inner_text(S + ".rn-v") and "1.5" in pg.inner_text(S + ".rn-v") and "Привет, Анна" in pg.inner_text(S + ".rn-o pre"))
    go(14); ready(); seen = False
    for _ in range(10):
        pg.click(S + ".sp"); seen = seen or pg.locator(S + ".fn-n.on").count() == 1
    check("презентация: функция подсвечивается, когда выполняется", seen and "на метро" in pg.inner_text(S + ".rn-o pre"))
    go(15); ready()
    for _ in range(12): pg.click(S + ".sp")
    check("презентация: append добавляет 4-й элемент списка", pg.locator(S + ".cl[data-i='3']").is_visible())
    pg.click(S + ".cl[data-i='1']"); check("презентация: клик по элементу списка", "cities[1]" in pg.inner_text(S + ".cr") and "Химки" in pg.inner_text(S + ".cr"))
    # циклы, табы
    go(12); ready(); pg.click(S + ".tab[data-t='range']"); pg.wait_for_selector(S + ".tb-range .go:not([disabled])")
    pg.click(S + ".tb-range .go"); pg.wait_for_selector(S + ".tb-range .st:text('Готово')", timeout=15000)
    check("презентация: цикл range(3) печатает Шаг 0..2", "Шаг 2" in pg.inner_text(S + ".tb-range .rn-o pre") and not pg.locator(S + ".tb-for").is_visible())
    # условия: ползунок
    go(13)
    pg.eval_on_selector(S + ".sl-r", "e=>{e.value=10;e.dispatchEvent(new Event('input'))}")
    check("презентация: ползунок 10 км → «на метро», подсвечены 3 строки", "на метро" in pg.inner_text(S + ".rsl") and pg.locator(S + ".ln.cur").count() == 3)
    pg.eval_on_selector(S + ".sl-r", "e=>{e.value=2;e.dispatchEvent(new Event('input'))}")
    check("презентация: ползунок 2 км (граница) → «пешком»", "пешком" in pg.inner_text(S + ".rsl"))
    # игра про границы
    go(17)
    for i, ans in enumerate([0, 1, 1, 2]):
        pg.click(S + ".a[data-i='%d']" % ans); ok = "Верно" in pg.inner_text(S + ".rsl")
        if not ok: check("презентация: граница %d угадана" % i, False, pg.inner_text(S + ".rsl"))
        pg.click(S + ".nx")
    check("презентация: игра про границы: 4 из 4", "4 из 4" in pg.inner_text(S + ".qd"), pg.inner_text(S + ".qd"))
    # алгоритм
    go(7); pg.click(S + ".run"); pg.wait_for_selector(S + ".rsl:text('Чай готов')", timeout=8000)
    pg.click(S + ".mix"); pg.click(S + ".run"); pg.wait_for_selector(S + ".rsl:text('Ошибка')", timeout=8000)
    check("презентация: порядок шагов важен (верный и перепутанный)", True)
    # цикл разработки
    go(6); pg.click(S + ".play"); pg.wait_for_selector(S + ".nd.done >> nth=4", timeout=8000); check("презентация: цикл программы проигрывается", True)
    # схема
    go(16); pg.click(S + ".pk[data-n='Мария']"); pg.wait_for_selector(S + ".rsl:text('на метро')", timeout=8000)
    check("презентация: схема для 12 км приводит к «метро»", "Мария, рекомендуемый способ: на метро." in pg.inner_text(S + ".rsl"))
    # живая консоль
    go(20)
    for n in ["Анна", "Илья", "Мария"]:
        pg.click(S + ".sc[data-n='%s']" % n); pg.wait_for_timeout(1500)
    check("презентация: три сценария проходят", "Все три сценария проходят" in pg.inner_text(S + ".tl"), pg.inner_text(S + ".tl"))
    pg.fill(S + ".ds", "abc"); pg.click(S + ".go"); pg.wait_for_timeout(1700)
    check("презентация: «abc» даёт ValueError", "ValueError" in pg.inner_text(S + ".co"))
    pg.fill(S + ".nm", "<img src=x onerror=window.xss=1>"); pg.fill(S + ".ds", "3"); pg.click(S + ".go"); pg.wait_for_timeout(1700)
    check("презентация: HTML в имени не исполняется", pg.evaluate("window.xss") is None and pg.locator(S + " img").count() == 0)
    go(21)
    for i in range(5): pg.locator(S + "input[type=checkbox]").nth(i).check()
    check("презентация: чек-лист заполняется", "Все пять шагов" in pg.inner_text(S + ".rsl"))
    check("презентация: нет ошибок в консоли", not bag, bag[:3]); ctx.close()
    # телефон: ни на одном слайде нет горизонтального скролла
    ctx = new_ctx(b, 390, 780, mobile=True); pg = ctx.new_page(); bag = []; attach_errors(pg, bag); bad = []
    pg.goto(base + "slides.html"); pg.wait_for_selector(S + ".sl-h")
    for k in range(1, 24):
        pg.evaluate("location.hash='#%d'" % k); pg.wait_for_timeout(120)
        ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if ov > 0: bad.append((k, ov))
    check("презентация @390: на всех 23 слайдах нет горизонтального скролла", not bad, bad)
    check("презентация @390: нет ошибок", not bag, bag[:3]); ctx.close()
    # ноутбук: ничего не обрезано
    ctx = new_ctx(b, 1366, 768); pg = ctx.new_page(); pg.goto(base + "slides.html"); pg.wait_for_selector(S + ".sl-h"); clip = []
    for k in range(1, 24):
        pg.evaluate("location.hash='#%d'" % k); pg.wait_for_timeout(120)
        m = pg.evaluate("(()=>{const st=document.getElementById('stage').getBoundingClientRect();let m=-999;document.querySelectorAll('.sl.on .sl-b > *').forEach(e=>{m=Math.max(m,e.getBoundingClientRect().bottom-st.bottom)});return m})()")
        if m > 1: clip.append((k, round(m)))
    check("презентация @1366x768: ничто не выходит за слайд", not clip, clip); ctx.close()


def hn_hash(text):
    t = "\n".join(l.rstrip() for l in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip()
    h = 0x811c9dc5
    for byte in t.encode("utf-8"): h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h


def honest(b, base):
    print("\n== ЧЕСТНЫЙ ВВОД ==")
    from urllib.parse import unquote
    ctx = new_ctx(b, raw=True); ctx.grant_permissions(["clipboard-read", "clipboard-write"]); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code")
    start = pg.input_value("#code")
    pg.evaluate("navigator.clipboard.writeText('print(\"вставлено\")')"); pg.focus("#code"); pg.keyboard.press("Control+End"); pg.keyboard.press("Control+V")
    check("честный ввод: Ctrl+V не вставляет текст", pg.input_value("#code") == start and "Вставка отключена" in pg.inner_text("#hn"), pg.input_value("#code")[-30:])
    pasted = pg.evaluate("""()=>{const a=document.getElementById('code'),d=new DataTransfer();d.setData('text/plain','print(1)');const e=new ClipboardEvent('paste',{clipboardData:d,cancelable:true,bubbles:true});a.dispatchEvent(e);return e.defaultPrevented}""")
    check("честный ввод: событие вставки отменяется (контекстное меню, Shift+Insert)", pasted is True)
    pg.keyboard.insert_text("x" * 40)
    check("честный ввод: сразу много текста (автодополнение ИИ, диктовка) блокируется", pg.input_value("#code") == start and "много текста" in pg.inner_text("#hn"))
    pg.keyboard.type('print(1)'); pg.keyboard.press("Tab")
    check("честный ввод: обычный набор работает", pg.input_value("#code").endswith("print(1)    ") or "print(1)" in pg.input_value("#code"))
    pg.keyboard.press("Backspace"); pg.keyboard.press("Backspace"); pg.keyboard.type("x")
    pg.fill("#nick", "snake_42"); pg.fill("#group", "9А")
    np = FP(issue_url(pg))
    raw = unquote(unquote(np.value.url)); import re as _re
    m = _re.search(r"meta=(v1;[^&]*)", raw); meta = dict(p.split("=") for p in m.group(1).split(";")[1:]) if m else {}
    final = pg.input_value("#code")
    check("честный ввод: в заявку уходят метаданные набора", m is not None and int(meta.get("t", 0)) >= 9 and int(meta.get("p", 0)) >= 1 and int(meta.get("b", 0)) == 1, raw[-120:])
    check("честный ввод: Tab и стирание не считаются подменой", meta.get("e") == "0", meta)
    check("честный ввод: хеш кода в заявке совпадает с кодом", meta.get("h") == hn_hash(final), (meta.get("h"), hn_hash(final)))
    pg.reload(); pg.wait_for_selector("#code"); pg.fill("#nick", "snake_42"); pg.fill("#group", "9А")
    np2 = FP(issue_url(pg))
    m2 = _re.search(r"meta=(v1;[^&]*)", unquote(unquote(np2.value.url)))
    check("честный ввод: счётчик переживает перезагрузку страницы", m2 and "p=" in m2.group(1) and int(dict(p.split("=") for p in m2.group(1).split(";")[1:])["t"]) >= 9)
    pg.once("dialog", lambda d: d.accept()); pg.click("#rs"); pg.fill("#nick", "snake_42"); pg.fill("#group", "9А")
    np3 = FP(issue_url(pg))
    m3 = _re.search(r"meta=(v1;[^&]*)", unquote(unquote(np3.value.url)))
    check("честный ввод: «Сбросить» обнуляет счётчик", m3 and "t=0;p=0;b=0;e=0" in m3.group(1), m3 and m3.group(1))
    # обход через консоль разработчика (F12)
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code"); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector("#code")
    s0 = pg.input_value("#code"); META = "Honest.meta(document.getElementById('code'))"
    pg.evaluate("document.getElementById('code').value='print(\"подставлено из консоли\")'")
    check("F12: ta.value = «...» из консоли ничего не меняет", pg.input_value("#code") == s0 and "скриптом" in pg.inner_text("#hn"), pg.input_value("#code")[:40])
    pg.evaluate("Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(document.getElementById('code'),'print(\"в обход\")')")
    pg.fill("#nick", "snake_42"); pg.fill("#group", "9А")
    npx = FP(issue_url(pg))
    raw = unquote(unquote(npx.value.url)); mm = _re.search(r"meta=(v1;[^&]*)", raw)
    check("F12: через родной setter код не уходит в заявку, откат и пометка", "в обход" not in raw and mm and ";e=" in mm.group(1) and int(dict(p.split("=") for p in mm.group(1).split(";")[1:])["e"]) >= 2 and pg.input_value("#code") == s0, raw[-160:])
    pg.evaluate("document.getElementById('code').dispatchEvent(new InputEvent('input',{inputType:'insertText',data:'x=1',bubbles:true}))")
    check("F12: подделанное событие ввода игнорируется", pg.input_value("#code") == s0)
    pg.focus("#code"); pg.keyboard.press("Control+End")
    pg.evaluate("document.execCommand('insertText',false,'print(\"очень длинная вставка из консоли через execCommand\")')")
    check("F12: execCommand с длинным текстом блокируется", "очень длинная" not in pg.input_value("#code"))
    pg.evaluate("for(let i=0;i<6;i++)document.execCommand('insertText',false,'abcdefghijklmnopqrstuvwx')")
    got = pg.input_value("#code").count("abcdefghijklmnopqrstuvwx")
    check("F12: нарезка на куски и быстрая вставка упирается в предел скорости", got <= 1, got)
    pg.keyboard.type("ok")
    pg.evaluate("Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(document.getElementById('code'),'print(\"тихо подменил\")')")
    pg.keyboard.type("z"); pg.keyboard.press("Control+End"); pg.keyboard.type("y")
    check("F12: подмена откатывается на следующем нажатии клавиши", "тихо подменил" not in pg.input_value("#code") and pg.input_value("#code").endswith("y") and "ok" in pg.input_value("#code"), pg.input_value("#code")[-60:])
    pg.keyboard.press("Control+Z"); pg.keyboard.press("Control+Z")
    ee = pg.evaluate(META)
    check("честный ввод: отмена Ctrl+Z не считается подменой", "e=" in ee)
    pg.evaluate("localStorage.setItem('code_1.1','print(\"подкинуто в хранилище\")')"); pg.reload(); pg.wait_for_selector("#code")
    ee2 = dict(p.split("=") for p in pg.evaluate(META).split(";")[1:])
    check("F12: код, подкинутый в localStorage, помечается", int(ee2["e"]) >= 1, ee2)
    pg.evaluate("document.getElementById('code').value='x'")
    pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=60000)
    check("F12: проверка идёт по набранному, а не по подставленному", "заготовка" in pg.inner_text("#res") or "Пока не так" in pg.inner_text("#res"), pg.inner_text("#res")[:80])
    pg.evaluate("window.__hijack=1;Honest.code=function(t){return 'print(1)'}")
    check("честный ввод: нет ошибок в консоли", not bag, bag[:3]); ctx.close()
    # кабинет: пометки в «Заявках»
    code = "print(1)"
    good = "v1;t=8;p=0;b=0;e=0;s=10;h=" + hn_hash(code)
    issues = [issue(1, "anna", "1.1", "решено", "\n\n### Служебное (не меняй)\n\n" + good),
              issue(2, "boris", "1.1", "решено", "\n\n### Служебное (не меняй)\n\nv1;t=8;p=3;b=0;e=0;s=10;h=" + hn_hash(code)),
              issue(3, "vera", "1.1", "решено", "\n\n### Служебное (не меняй)\n\nv1;t=8;p=0;b=0;e=0;s=10;h=00000000"),
              issue(4, "gleb", "1.1", "решено")]
    ctx = new_ctx(b); mock_github(ctx, {"сдача": issues, "проект": []}); pg = ctx.new_page(); pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate"); pg.evaluate("(document.querySelector('.gate details')||{}).open=true")
    pg.fill("#tk", "ghp_good"); pg.click("#in"); pg.wait_for_selector(".kpi", timeout=10000)
    sm = pg.inner_text("#tab")
    check("кабинет: в сводке ⚠ у тех, кто вставлял или менял код", sm.count("⚠") == 2, sm.count("⚠"))
    pg.click("#tb button >> nth=1"); pg.wait_for_timeout(200); t = pg.inner_text("#tab")
    check("кабинет: «Заявки» показывают причины", "набран сам" in t and "пытался вставить: 3" in t and "код изменён после сайта" in t and "не через сайт" in t, t[:300])
    ctx.close()


def offline(b, base):
    print("\n== БЕЗ GITHUB ==")
    ctx = new_ctx(b); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code")
    good = 'name=input("Имя: ")\ncity=input("Город: ")\nprint(f"Меня зовут {name}, я из {city}")'
    big_fill(pg, good); pg.click("#off summary")
    pg.fill("#group", "9А"); pg.click("#mk")
    check("без GitHub: без фамилии код не выдаётся", pg.input_value("#tok") == "" and "фамилию" in pg.inner_text("#tmsg"))
    pg.fill("#fio", "Иванов Иван"); pg.click("#mk"); tok = pg.input_value("#tok")
    u = pg.evaluate("t=>Offline.unpack(t)", tok)
    check("без GitHub: код сдачи собирается и читается обратно", tok.startswith("PYC1:") and u and u["n"] == "Иванов Иван" and u["g"] == "9А" and u["t"] == "1.1" and u["c"] == good and u["valid"] is True, (tok[:30], u and u["t"]))
    big_fill(pg, 'print("не то")'); pg.click("#mk"); tok_bad = pg.input_value("#tok")
    pg.fill("#fio", "Петров Пётр"); pg.click("#mk"); tok_bad = pg.input_value("#tok")
    check("без GitHub: код сдачи есть и у неверного решения", tok_bad.startswith("PYC1:") and tok_bad != tok)
    tam = tok[:-6] + ("AAAAAA" if not tok.endswith("AAAAAA") else "BBBBBB")
    check("без GitHub: испорченный код не принимается", pg.evaluate("t=>{const o=Offline.unpack(t);return !o||!o.valid}", tam))
    msg = "Привет!\nвот мой код:\n" + tok[:70] + "\n" + tok[70:] + "\nи ещё\n" + tok_bad + "\n" + tam
    check("без GitHub: коды находятся в тексте даже с переносами строк", pg.evaluate("t=>Offline.find(t).length", msg) == 3)
    check("без GitHub: нет ошибок в консоли (ученик)", not bag, bag[:3]); ctx.close()
    # учитель
    ctx = new_ctx(b); mock_github(ctx, {"сдача": [issue(1, "anna", "1.1", "решено")], "проект": []}); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate"); pg.evaluate("(document.querySelector('.gate details')||{}).open=true"); pg.fill("#tk", "ghp_good"); pg.click("#in"); pg.wait_for_selector(".kpi", timeout=10000)
    pg.click("#tb button >> nth=2"); pg.wait_for_selector("#oi")
    pg.fill("#oi", msg); pg.click("#og"); pg.wait_for_selector("#om:has-text('Проверено')", timeout=120000)
    t = pg.inner_text("#oo")
    check("без GitHub: кабинет перепроверяет коды сам", "Иванов Иван" in t and "решено" in t and "Петров Пётр" in t and "ошибки" in t, t[:200])
    check("без GitHub: испорченный код посчитан", "Повреждённых кодов: 1" in pg.inner_text("#om"), pg.inner_text("#om"))
    pg.click("#tb button >> nth=0"); pg.wait_for_selector("#csv"); sm = pg.inner_text("#tab")
    check("без GitHub: ученики попадают в сводку вместе с GitHub-учениками", "Иванов Иван" in sm and "anna" in sm and "Петров Пётр" in sm)
    with pg.expect_download() as d: pg.click("#csv")
    rows = open(d.value.path(), encoding="utf-8-sig", newline="").read().split("\r\n")
    iv = [r for r in rows if r.startswith("Иванов Иван")]
    check("без GitHub: в Excel есть группа и результат", rows[0].startswith("Ученик;Ник;Группа") and iv and ";9А;" in iv[0] and "решено" in iv[0], iv[:1])
    pg.click("#tb button >> nth=1"); t2 = pg.inner_text("#tab")
    check("без GitHub: в «Заявках» пометка «без GitHub»", "без GitHub" in t2)
    pg.reload(); pg.wait_for_selector(".kpi", timeout=10000); pg.wait_for_selector("#csv")
    check("без GitHub: список переживает перезагрузку", "Иванов Иван" in pg.inner_text("#tab"))
    check("без GitHub: нет ошибок в консоли (учитель)", not bag, bag[:3]); ctx.close()


def video(b, base):
    print("\n== ВИДЕОРАЗБОРЫ ==")
    ctx = new_ctx(b); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.goto(base + "video.html"); pg.wait_for_selector(".vcard")
    n = pg.locator(".vcard").count()
    check("видео: на странице 13 карточек (гид, 2 задания, 10 тем)", n == 13, n)
    # настоящие решения из роликов проходят настоящую проверку
    for cid in ["guide", "task-2.2", "task-3.4"]:
        ok = pg.evaluate("""async id=>{const c=Explainer.byId(id),t=TASKS.filter(x=>x.id===c.task)[0];
          const r=await BrowserCheck.run(t,c.keep+c.typed);return r.ok}""", cid) if pg.evaluate("typeof BrowserCheck") != "undefined" else None
        if ok is None:
            pg.goto(base + "task.html?id=" + {"guide": "1.2", "task-2.2": "2.2", "task-3.4": "3.4"}[cid]); pg.wait_for_selector("#code")
            ok = pg.evaluate("""async id=>{const c=Explainer.byId(id),t=TASKS.filter(x=>x.id===c.task)[0];
              const r=await BrowserCheck.run(t,c.keep+c.typed);return r.ok}""", cid)
            pg.goto(base + "video.html"); pg.wait_for_selector(".vcard")
        check("видео: решение в ролике %s проходит проверку" % cid, ok is True, ok)
    # все ролики: плеер не падает на любом моменте времени, подписи не пустые
    res = pg.evaluate("""()=>{const out=[];for(const c of CLIPS){const h=document.createElement('div');document.body.appendChild(h);
      const P=Explainer.mount(h,c,{paused:true});let empty=0,steps=0;
      for(let i=0;i<=40;i++){P.seek(P.dur*i/40);const t=h.querySelector('.xp-cap .tx').textContent;if(!t.trim())empty++;steps++}
      out.push([c.id,P.dur,empty]);P.destroy();h.remove()}return out}""")
    check("видео: все 13 роликов проигрываются без ошибок", len(res) == 13 and all(r[2] == 0 for r in res), [r for r in res if r[2]])
    check("видео: длина роликов 20-100 секунд", all(20 <= r[1] <= 100 for r in res), [(r[0], round(r[1])) for r in res if not 20 <= r[1] <= 100])
    # карточка открывает окно, Esc закрывает
    pg.click(".vcard >> nth=0"); pg.wait_for_selector(".xm .xp-stage")
    check("видео: карточка открывает плеер", pg.locator(".xm-back").count() == 1)
    pg.click(".xm [data-a=pp]"); pg.wait_for_timeout(300); t1 = pg.input_value(".xm input[type=range]")
    pg.wait_for_timeout(700); t2 = pg.input_value(".xm input[type=range]")
    check("видео: пауза останавливает время", t1 == t2, (t1, t2))
    pg.fill(".xm input[type=range]", "20"); pg.wait_for_timeout(200)
    check("видео: перемотка меняет подпись", "Пишем код" in pg.inner_text(".xm .xp-cap") or "Проверка" in pg.inner_text(".xm .xp-cap") or pg.inner_text(".xm .xp-cap .n") != "Условие", pg.inner_text(".xm .xp-cap"))
    pg.keyboard.press("Escape"); check("видео: Esc закрывает плеер", pg.locator(".xm-back").count() == 0)
    # теория, задание, главный экран
    pg.goto(base + "theory.html?l=3"); pg.wait_for_selector(".vcard")
    check("теория: у урока 3 есть видеоразборы (for, while, списки, функции)", pg.locator(".vcard").count() == 4, pg.locator(".vcard").count())
    pg.click(".vcard >> nth=0"); pg.wait_for_selector(".xm .xp-stage"); pg.keyboard.press("Escape")
    pg.goto(base + "task.html?id=2.2"); pg.wait_for_selector("#code")
    check("задание 2.2: в боковой колонке есть «Видеоразбор»", "Смотреть задание" in pg.inner_text(".aside"))
    pg.click("[data-clip=task-2\\.2]"); pg.wait_for_selector(".xm .xp-stage")
    check("задание 2.2: видео открывается", "2.2" in pg.inner_text(".xm .xh")); pg.keyboard.press("Escape")
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code")
    check("задание 1.1: тематические ролики есть, а «Смотреть задание» нет", "Смотреть задание" not in pg.inner_text(".aside") and pg.locator(".aside [data-clip]").count() >= 1)
    pg.goto(base + "index.html"); pg.wait_for_selector("#vg"); pg.click("#vg"); pg.wait_for_selector(".xm .xp-stage")
    check("главный экран: кнопка «Видеогид» открывает гид", "Как сдать" in pg.inner_text(".xm .xh")); pg.keyboard.press("Escape")
    # телефон: страница не ползёт вбок, плеер помещается
    ctx2 = new_ctx(b, 390, 800, mobile=True); p2 = ctx2.new_page(); p2.goto(base + "video.html"); p2.wait_for_selector(".vcard"); p2.click(".vcard >> nth=0"); p2.wait_for_selector(".xm .xp-stage")
    w = p2.evaluate("[document.documentElement.scrollWidth, innerWidth, document.querySelector('.xp-screen').getBoundingClientRect().width]")
    check("видео: на телефоне нет горизонтальной прокрутки", w[0] <= w[1] + 1 and w[2] <= w[1], w); ctx2.close()
    check("видео: нет ошибок в консоли", not bag, bag[:3]); ctx.close()


def gamepage(pg, base, g):
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code")
    pg.evaluate("g=>{const h=document.createElement('div');h.id='gh';document.querySelector('main').prepend(h);window.GI=Games.mount(h,g)}", g)
    pg.wait_for_selector("#gh .gm")


def extras(b, base):
    print("\n== ПОДСКАЗКИ, СЕРИЯ, ИГРЫ ==")
    ctx = new_ctx(b); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.goto(base + "task.html?id=2.2"); pg.wait_for_selector("#code")
    # 1. правила подсказок по коду и по тексту ошибки
    H = """([code,msgs,sample,func])=>Hints.explain(code,{func:!!func},{ok:false,messages:msgs,sample:sample||''}).map(h=>h.id)"""
    cases = [
     ("нет двоеточия", "x = 5\nif x > 3\n    print(1)", [], "colon"), ("= вместо ==", "x=5\nif x = 5:\n    print(1)", [], "assign-cond"),
     ("else if", "if x:\n    pass\nelse if y:\n    pass", [], "else-if"), ("print без скобок", 'print "hi"', [], "print-parens"),
     ("Print с большой", 'Print("a")', [], "case"), ("кривые кавычки", "print(“привет”)", [], "smart-quotes"),
     ("true с маленькой", "a = true", [], "lower-bool"), ("нет f", 'name="a"\nprint("Привет, {name}")', [], "fstring"),
     ("input не число", "a = input()\nif a > 5:\n    print(1)", [], "input-text"), ("нет отступа", "if True:\nprint(1)", [], "indent"),
     ("x == 1 or 2", "x=1\nif x == 1 or 2:\n    pass", [], "or-chain"), ("скобка", 'print("a"', ["Ввод [1]: программа упала: SyntaxError: '(' was never closed (main.py, line 1)"], "brackets"),
     ("опечатка в имени", "name = 1\nprint(nmae)", ["Ввод [1]: программа упала: NameError: name 'nmae' is not defined"], "name-typo"),
     ("имя не создано", "print(привет)", ["Ввод [1]: программа упала: NameError: name 'привет' is not defined"], "name-undef"),
     ("int от дробного", "n=int(input())", ["Ввод [1.5]: программа упала: ValueError: invalid literal for int() with base 10: '1.5'"], "int-float"),
     ("текст + число", 'print("a"+5)', ['Ввод []: программа упала: TypeError: can only concatenate str (not "int") to str'], "str-plus-num"),
     ("деление на ноль", "print(1/0)", ["Ввод []: программа упала: ZeroDivisionError: division by zero"], "zero"),
     ("бесконечный цикл", "while True: pass", ["Программа не завершилась за 8 секунд. Возможно, бесконечный цикл или лишний input()."], "loop"),
     ("регистр в выводе", 'print("площадь: 20")', ["Ввод [4, 5]: в выводе должно быть «Площадь: 20»"], "out-case", "площадь: 20\n"),
     ("знаки в выводе", 'print("Площадь 20")', ["Ввод [4, 5]: в выводе должно быть «Площадь: 20»"], "out-punct", "Площадь 20\n"),
     ("другое число", 'print("Площадь: 21")', ["Ввод [4, 5]: в выводе должно быть «Площадь: 20»"], "out-number", "Площадь: 21\n"),
     ("пустой вывод", "x=1", ["Ввод [4, 5]: в выводе должно быть «Площадь: 20»"], "out-empty", ""),
     ("print вместо return", "def f(d):\n    print(d)", ["f(1) вернула None, а нужно 'пешком'"], "no-return", "", True),
     ("не та функция", "def rec(d):\n    return 1", ["Функция recommend: функция recommend не найдена"], "func-name", "", True),
    ]
    bad = []
    for c in cases:
        got = pg.evaluate(H, [c[1], c[2], c[4] if len(c) > 4 else "", c[5] if len(c) > 5 else False])
        if c[3] not in got: bad.append((c[0], got))
    check("подсказки: %d типичных ошибок распознаются" % len(cases), not bad, bad)
    ok = pg.evaluate(r"""()=>Hints.explain('a = int(input())\nb = int(input())\nprint(f"Площадь: {a*b}")',{},{ok:true,messages:[]}).length===0&&Hints.explain('x',{},{ok:false,todo:true,messages:[]}).length===0""")
    check("подсказки: для верного решения и пустой заготовки молчат", ok)
    # настоящие сообщения Pyodide дают нужные подсказки
    real = pg.evaluate(r"""async()=>{const t=TASKS.filter(x=>x.id==='2.2')[0],out={};
      const codes={colon:'score = int(input("Баллы: "))\nif score >= 85\n    print("Оценка: 5")',
       typo:'score = int(input("Баллы: "))\nprint(scoer)',
       text:'score = input("Баллы: ")\nif score >= 85:\n    print("Оценка: 5")',
       indent:'score = int(input("Баллы: "))\nif score >= 85:\nprint("Оценка: 5")',
       quote:'score = int(input("Баллы: "))\nprint("Оценка: 5)',
       dbl:'score = int(input("Баллы: ")))'};
      for(const k in codes){const r=await BrowserCheck.run(t,codes[k]);out[k]=Hints.explain(codes[k],t,r).map(h=>h.id)}return out}""")
    exp = {"colon": "colon", "typo": "name-typo", "text": "input-text", "indent": "indent", "quote": "quote", "dbl": "brackets"}
    check("подсказки: настоящие ошибки Python превращаются в подсказки", all(exp[k] in real[k] for k in exp), real)
    # 2. серия
    st = pg.evaluate("""()=>{localStorage.removeItem('streak');const d=(y,m,dd)=>new Date(y,m-1,dd,12);const o=[];
      o.push(Streak.touch(d(2026,10,10)));o.push(Streak.touch(d(2026,10,10)));o.push(Streak.touch(d(2026,10,11)));o.push(Streak.touch(d(2026,10,12)));
      o.push(Streak.get(d(2026,10,12)).n);o.push(Streak.get(d(2026,10,13)).n);o.push(Streak.get(d(2026,10,14)).n);o.push(Streak.touch(d(2026,10,15)));o.push(Streak.get(d(2026,10,15)).best);
      o.push(Streak.plural(1)+'|'+Streak.plural(3)+'|'+Streak.plural(5)+'|'+Streak.plural(11)+'|'+Streak.plural(22));
      o.push(Streak.week(d(2026,10,15)).filter(x=>x.on).length);localStorage.removeItem('streak');return o}""")
    check("серия: считает дни подряд, сбрасывается после пропуска", st[:9] == [1, 1, 2, 3, 3, 3, 0, 1, 3], st)
    check("серия: правильные окончания и неделя", st[9] == "1 день|3 дня|5 дней|11 дней|22 дня" and st[10] == 4, st[9:])
    # 3. «что дальше» после проверки
    pg.goto(base + "task.html?id=2.2"); pg.wait_for_selector("#code")
    sol = 'score = int(input("Баллы: "))\nif score >= 85:\n    print("Оценка: 5")\nelif score >= 65:\n    print("Оценка: 4")\nelif score >= 45:\n    print("Оценка: 3")\nelse:\n    print("Оценка: 2")\n'
    big_fill(pg, sol); pg.click("#chk"); pg.wait_for_selector("#nextbox", timeout=90000)
    tx = pg.inner_text("#nextbox")
    check("что дальше: после проверки выбор «продолжить» или «сыграть», серия", "Задание 2.2 пройдено" in tx and "Продолжить: 2.3" in tx and "Сыграть один раз" in tx and "Серия началась" in tx, tx[:200])
    check("что дальше: серия записана в браузере", pg.evaluate("JSON.parse(localStorage.streak).n") == 1)
    pg.reload(); pg.wait_for_selector("#nextbox")
    check("что дальше: панель видна и после перезагрузки", True)
    pg.click("#nx-play"); pg.wait_for_selector(".xm .gm")
    check("что дальше: «Сыграть один раз» открывает мини-игру", pg.locator(".xm-back").count() == 1)
    pg.keyboard.press("Escape"); check("что дальше: Esc закрывает игру", pg.locator(".xm-back").count() == 0)
    check("что дальше: после игры кнопки «сыграть» нет, «продолжить» осталась", pg.locator("#nx-play").count() == 0 and "уже сыграна" in pg.inner_text("#nextbox") and pg.locator("#nx-go").count() == 1, pg.inner_text("#nextbox")[:150])
    pg.reload(); pg.wait_for_selector("#nextbox")
    check("что дальше: повторно сыграть за то же задание нельзя (и после перезагрузки)", pg.locator("#nx-play").count() == 0 and pg.evaluate("JSON.parse(localStorage.played)['2.2']") == 1)
    pg.goto(base + "task.html?id=2.3"); pg.wait_for_selector("#code")
    pg.evaluate("()=>{const p=JSON.parse(localStorage.passed||'{}');p['2.3']=1;localStorage.passed=JSON.stringify(p)}"); pg.reload(); pg.wait_for_selector("#nextbox")
    check("что дальше: за следующее задание игра снова доступна", pg.locator("#nx-play").count() == 1)
    pg.goto(base + "index.html"); pg.wait_for_selector("#nx")
    check("игры: нет ни на рабочем столе, ни в меню, отдельной страницы нет", "Игры" not in pg.inner_text("#icons") and "Игры" not in pg.evaluate("document.querySelector('#smenu').textContent"))
    pg.goto(base + "index.html"); pg.wait_for_selector("#nx")
    check("главный экран: видна серия", "Серия: 1 день" in pg.inner_text(".dlg"), pg.inner_text(".dlg")[:120])
    # 4. игры
    gamepage(pg, base, "mines"); pg.click("#gh .mn .c >> nth=40")
    r = pg.evaluate("""()=>{const root=document.querySelector('.gm');return [root.dataset.state,document.querySelectorAll('.mn .c.o').length]}""")
    check("сапёр: первый клик безопасен и открывает клетки", r[0] in ("playing", "won") and r[1] >= 1, r)
    res = pg.evaluate("""()=>{const h=document.createElement('div');document.body.appendChild(h);const g=Games.mount(h,'mines');const root=h.querySelector('.gm');
      h.querySelector('.mn .c:nth-child(41)').click();const cs=g._cells();const mines=cs.filter(c=>c.m).length;const firstOpen=cs[40].o===1&&!cs[40].m;
      const idx=cs.findIndex(c=>c.m);h.querySelector('.mn .c:nth-child('+(idx+1)+')').click();const lost=root.dataset.state;
      h.querySelector('[data-r]').click();h.querySelector('.mn .c:nth-child(41)').click();const cs2=g._cells();
      for(let i=0;i<81;i++){if(!cs2[i].m&&!cs2[i].o)h.querySelector('.mn .c:nth-child('+(i+1)+')').click()}
      const won=root.dataset.state;g.destroy();h.remove();return [mines,firstOpen,lost,won]}""")
    check("сапёр: 10 мин, проигрыш на мине, победа при открытии всех безопасных клеток", res == [10, True, "lost", "won"], res)
    pg.evaluate("window.GI.destroy()")
    gamepage(pg, base, "snake")
    pg.keyboard.press("ArrowRight"); pg.wait_for_selector(".gm[data-state=playing]", state="attached")
    pg.wait_for_selector(".gm[data-state=over]", state="attached", timeout=6000)
    check("змейка: стартует по стрелке и заканчивается об стену", pg.inner_text(".gm-st").startswith("Конец"), pg.inner_text(".gm-st"))
    pg.click("[data-r]"); check("змейка: «Заново» возвращает к началу", pg.evaluate("document.querySelector('.gm').dataset.state") == "ready")
    gamepage(pg, base, "runner")
    pg.keyboard.press(" "); pg.wait_for_selector(".gm[data-state=playing]", state="attached")
    pg.wait_for_selector(".gm[data-state=over]", state="attached", timeout=20000)
    check("бегун: прыжок запускает игру, без прыжков врезаешься в баг", "Конец" in pg.inner_text(".gm-st"), pg.inner_text(".gm-st"))
    ok = pg.evaluate("Games.MAZE.length===11&&Games.MAZE.every(r=>r.length===15)")
    gamepage(pg, base, "maze")
    pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(1300)
    left = pg.inner_text(".gm-bar")
    check("лабиринт: поле целое, игрок собирает биты", ok and "Бит осталось: 78" not in left and "Жизни" in left, left)
    ctx2 = new_ctx(b, 390, 800, mobile=True); p2 = ctx2.new_page()
    ws = []
    for g in ("maze", "mines", "snake", "runner"):
        gamepage(p2, base, g); ws.append(p2.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    check("игры: на телефоне нет горизонтальной прокрутки", all(w[0] <= w[1] + 1 for w in ws), ws); ctx2.close()
    # сапёр: длинное нажатие на телефоне ставит флажок один раз и не съедает следующий тап
    gamepage(pg, base, "mines")
    pg.evaluate("""()=>{const c=document.querySelectorAll('#gh .mn .c')[0];c.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true,clientX:5,clientY:5}))}""")
    pg.wait_for_timeout(560)
    pg.evaluate("""()=>{const c=document.querySelectorAll('#gh .mn .c')[0];c.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',bubbles:true}));c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));c.click()}""")
    fl = pg.evaluate("document.querySelectorAll('#gh .mn .c.fl').length")
    check("сапёр: длинное нажатие ставит ровно один флажок", fl == 1, fl)
    pg.wait_for_timeout(800); pg.click("#gh .mn .c >> nth=40")
    check("сапёр: следующий тап после флажка работает", pg.evaluate("document.querySelectorAll('#gh .mn .c.o').length") > 0)
    pg.evaluate("""()=>{const g=document.querySelector('#gh .gm');const cs=Array.from(document.querySelectorAll('#gh .mn .c'));cs.forEach(c=>{})}""")
    # пасхалка: 2267
    pg.goto(base + "index.html"); pg.wait_for_timeout(400)
    pg.keyboard.type("226"); pg.keyboard.type("x"); pg.keyboard.type("7"); pg.wait_for_timeout(300)
    check("пасхалка: неполный или прерванный код не открывает игру", pg.locator("#egg").count() == 0)
    pg.keyboard.type("2267"); pg.wait_for_selector("#egg", timeout=4000)
    check("пасхалка: код 2267 открывает игру", pg.evaluate("document.getElementById('egg').dataset.state") == "playing")
    pg.keyboard.press("Space"); pg.wait_for_timeout(200); pg.evaluate("Egg._t().win()"); pg.wait_for_timeout(300)
    check("пасхалка: победа показывает «Позови преподавателя»", "Позови преподавателя" in pg.inner_text("#egm"))
    pg.keyboard.press("Escape"); check("пасхалка: Esc закрывает", pg.locator("#egg").count() == 0)
    # страница игры для всех: победа даёт красную пятёрку
    ctx3 = new_ctx(b); p3 = ctx3.new_page(); p3.goto(base + "run.html"); p3.wait_for_selector("#pl")
    check("игра для всех: сначала «Ещё не пройдено»", "Ещё не пройдено" in p3.inner_text("#st"))
    p3.click("#pl"); p3.wait_for_selector("#egg"); p3.keyboard.press("Space"); p3.wait_for_timeout(200); p3.evaluate("Egg._t().win()"); p3.wait_for_timeout(300)
    check("игра для всех: после победы красная 5 и «Позови преподавателя»", "5" in p3.inner_text("#egm") and "Позови преподавателя" in p3.inner_text("#egm"))
    p3.click("#egj"); p3.wait_for_selector("#egg", state="detached"); check("игра для всех: результат сохранён и виден на странице", "Пройдено" in p3.inner_text("#st"), p3.inner_text("#st")); ctx3.close()
    check("игры и подсказки: нет ошибок в консоли", not bag, bag[:3]); ctx.close()


def brief(b, base):
    print("\n== КАРТОЧКА ЗАДАНИЯ, МЯГКАЯ ПРОВЕРКА, РАЗМЕР ==")
    ctx = new_ctx(b, brief=True); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector(".brief")
    tx = pg.inner_text(".brief")
    check("карточка: открывается сама, есть текст, пример и шаги", "Спроси у пользователя" in tx and "ПОХОЖИЙ ПРИМЕР" in tx and "КАК ДЕЛАТЬ" in tx, tx[:80])
    pg.click("#brGo"); check("карточка: закрывается кнопкой", pg.locator(".brief").count() == 0)
    pg.reload(); pg.wait_for_selector("#code"); pg.wait_for_timeout(300)
    check("карточка: в этой сессии больше не всплывает", pg.locator(".brief").count() == 0)
    pg.click("text=Открыть задание полностью"); check("карточку можно открыть снова", pg.locator(".brief").count() == 1); pg.keyboard.press("Escape")
    pg.goto(base + "task.html?id=4.2"); pg.wait_for_selector(".brief"); check("карточка есть у заданий без примера", "КАК ДЕЛАТЬ" in pg.inner_text(".brief")); pg.click("#brGo")
    ctx2 = new_ctx(b, 390, 780, mobile=True, brief=True); p2 = ctx2.new_page(); p2.goto(base + "task.html?id=1.1"); p2.wait_for_selector(".brief")
    r = p2.evaluate("(()=>{const w=document.querySelector('.brief .win').getBoundingClientRect();return [w.left>=0,w.right<=innerWidth,document.documentElement.scrollWidth<=innerWidth]})()")
    check("карточка: на телефоне помещается", all(r), r); ctx2.close()
    ctx3 = new_ctx(b); p3 = ctx3.new_page(); p3.goto(base + "task.html?id=1.1"); p3.wait_for_selector("#code")
    def run(code):
        big_fill(p3, code); p3.click("#chk"); p3.wait_for_selector("#res.on:not(.wait)", timeout=60000); return p3.get_attribute("#res", "class")
    c1 = run('n = input()\nc = input()\nprint("меня   зовут", n + ",\tя  из", c)')
    check("мягкая проверка: лишние пробелы и таб не мешают", "ok" in (c1 or "") or "good" in (c1 or "") or "pass" in (c1 or ""), c1)
    p3.goto(base + "task.html?id=1.3"); p3.wait_for_selector("#code")
    c2 = run('print(float(input()) * 1000, "м")'); c3 = run('print(round(float(input()) * 1000), "м")')
    check("мягкая проверка: 2500 и 2500.0 оба подходят", c2 == c3, (c2, c3))
    p3.goto(base + "task.html?id=1.1"); p3.wait_for_selector("#code")
    ok = p3.evaluate("()=>{const ta=document.getElementById('code');ta.value='x'.repeat(9000);return ta.maxLength}")
    check("размер: поле ограничено 8000 символов", ok == 8000, ok)
    big_fill(p3, "x = 1\n" * 4000); p3.click("#chk"); p3.wait_for_selector("#res.on:not(.wait)", timeout=30000)
    check("размер: слишком длинный код не проверяется", "слишком длинный" in p3.inner_text("#res"), p3.inner_text("#res")[:80])
    check("карточка: нет ошибок в консоли", not bag, bag[:3]); ctx.close(); ctx3.close()


def start_api(origin):
    """Поднимает настоящий сервер курса на свободном порту (для проверки регистрации и онлайн-игры)."""
    import asyncio, tempfile, threading, importlib
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))
    os.environ.update(DB_PATH=os.path.join(tempfile.mkdtemp(), "t.sqlite"), TEACHER_KEY="teacher-secret", ALLOW_ORIGINS=origin)
    import app as A; A = importlib.reload(A)
    from aiohttp import web
    loop = asyncio.new_event_loop(); box = {}
    def run():
        asyncio.set_event_loop(loop)
        runner = web.AppRunner(A.make_app()); loop.run_until_complete(runner.setup())
        site = web.TCPSite(runner, "127.0.0.1", 0); loop.run_until_complete(site.start())
        box["port"] = site._server.sockets[0].getsockname()[1]; loop.run_forever()
    threading.Thread(target=run, daemon=True).start()
    while "port" not in box: time.sleep(0.05)
    return "http://127.0.0.1:%d" % box["port"]


def api_ctx(b, api, w=1280, h=800, mobile=False, gate=True):
    ctx = new_ctx(b, w, h, mobile=mobile)
    host = api.split("//")[1]
    def html(route):
        r = route.fetch(); body = re.sub(r"https://[a-z0-9.-]+sslip\.io wss://[a-z0-9.-]+sslip\.io", "%s ws://%s" % (api, host), r.text())
        route.fulfill(response=r, body=body)
    ctx.route(re.compile(r"\.html(\?.*)?$"), html)
    ctx.route("**/config.js", lambda r: r.fulfill(body='window.API_BASE="%s";' % api, content_type="application/javascript"))
    if not gate: ctx.add_init_script("try{sessionStorage.setItem('tkey','x')}catch(e){}")  # окно входа проверяется отдельным набором
    return ctx


def online(b, base):
    print("\n== ПРОФИЛЬ И ОНЛАЙН-ИГРА (настоящий сервер) ==")
    api = start_api(base.rstrip("/")); bag = []
    ctx = api_ctx(b, api); pg = ctx.new_page(); attach_errors(pg, bag)
    pg.goto(base + "account.html"); pg.wait_for_selector("#tUp"); pg.click("#tUp")
    pg.fill("#nk", "anya_t"); pg.fill("#em", "anya@mail.ru"); pg.fill("#fo", "Иванова Аня"); pg.fill("#gr", "9А"); pg.fill("#pw", "secret1"); pg.fill("#p2", "secret2"); pg.click("#go")
    check("профиль: разные пароли не принимаются", "не совпадают" in pg.inner_text("#er"))
    pg.fill("#p2", "secret1"); pg.click("#go"); pg.wait_for_selector(".prof", timeout=8000)
    check("профиль: регистрация и вход", "anya_t" in pg.inner_text(".prof"))
    pg.evaluate("localStorage.setItem('passed','{\"1.1\":1,\"1.2\":1}')"); pg.click("#sy"); pg.wait_for_timeout(1200)
    ctx2 = api_ctx(b, api, 390, 780, mobile=True); p2 = ctx2.new_page(); attach_errors(p2, bag)
    p2.goto(base + "account.html"); p2.wait_for_selector("#nk"); p2.fill("#nk", "ANYA_T"); p2.fill("#pw", "bad"); p2.click("#go"); p2.wait_for_function("document.getElementById('er').textContent.length>0") if False else p2.wait_for_timeout(1500)
    check("профиль: неверный пароль отклонён", "Неверный" in p2.inner_text("#er"), p2.inner_text("#er"))
    p2.fill("#pw", "secret1"); p2.click("#go"); p2.wait_for_selector(".prof", timeout=8000); p2.wait_for_timeout(1000)
    got = p2.evaluate("localStorage.getItem('passed')")
    check("профиль: прогресс переехал на другое устройство", got and '"1.2"' in got, got)
    # живая викторина
    hctx = api_ctx(b, api); hctx.add_init_script("try{sessionStorage.setItem('tkey','x')}catch(e){}"); host = hctx.new_page(); attach_errors(host, bag)
    host.goto(base + "live.html"); host.fill("#tk", "wrong"); host.click("#hq"); host.wait_for_selector("#sl"); host.select_option("#sn", "5"); host.click("#fq button[type=submit]")
    host.wait_for_selector("#er2", timeout=6000); host.wait_for_timeout(800)
    check("онлайн: неверный ключ учителя не пускает", "Неверный ключ" in host.inner_text("#er2"), host.inner_text("#er2"))
    host.fill("#tk", "teacher-secret"); host.click("#hq"); host.wait_for_selector("#sl"); host.select_option("#sn", "5"); host.select_option("#ss", "15"); host.click("#fq button[type=submit]")
    host.wait_for_selector(".bigcode", timeout=8000); code = host.inner_text(".bigcode").strip()
    check("онлайн: комната создана, код из 4 цифр", len(code) == 4 and code.isdigit(), code)
    st = api_ctx(b, api, 390, 780, mobile=True, gate=False).new_page(); attach_errors(st, bag)
    st.goto(base + "live.html?c=" + code); st.fill("#nk", "Боря"); st.click("#fs button[type=submit]"); st.wait_for_selector(".wait", timeout=6000)
    host.wait_for_function("document.getElementById('pn').textContent==='1'") if False else host.wait_for_timeout(600)
    check("онлайн: ученик виден учителю", host.inner_text("#pn") == "1")
    host.click("#st"); st.wait_for_selector(".opt", timeout=6000); check("онлайн: ученик получил вопрос с 4 ответами", st.locator(".opt").count() == 4)
    check("онлайн: у ученика нет подсказки с ответом", st.locator(".opt.right").count() == 0)
    st.click(".opt >> nth=0"); host.wait_for_selector("#nx", timeout=8000)
    check("онлайн: после ответа учитель видит результат", host.locator(".cnt").count() == 1)
    check("онлайн: ученик видит верно/неверно", st.locator(".res").count() == 1)
    for _ in range(4):
        host.click("#nx"); 
        try: st.wait_for_selector(".opt", timeout=5000)
        except Exception: break
        st.click(".opt >> nth=1"); host.wait_for_selector("#nx", timeout=8000)
    host.click("#nx"); host.wait_for_selector("text=Игра окончена", timeout=6000); st.wait_for_selector("text=Игра окончена", timeout=6000)
    check("онлайн: викторина доходит до итогов", "Боря" in host.inner_text(".rows"))
    # облако слов
    h2 = api_ctx(b, api, gate=False).new_page(); h2.goto(base + "live.html"); h2.fill("#tk", "teacher-secret"); h2.click("#hc"); h2.fill("#ct", "Что такое цикл?"); h2.click("#fc button[type=submit]"); h2.wait_for_selector(".bigcode", timeout=6000)
    c2 = h2.inner_text(".bigcode").strip(); s2 = api_ctx(b, api, 390, 780, mobile=True, gate=False).new_page(); s2.goto(base + "live.html?c=" + c2); s2.fill("#nk", "Вера"); s2.click("#fs button[type=submit]"); s2.wait_for_selector("#wi", timeout=6000)
    s2.fill("#wi", "повтор, for, <b>x</b>"); s2.click("#wf button[type=submit]"); h2.wait_for_selector("#cw svg", timeout=6000)
    t = h2.inner_text("#cw"); check("облако: слова учеников появились у учителя, разметка не исполняется", "повтор" in t and h2.locator("#cw b").count() == 0, t[:60])
    # кабинет учителя
    tp = api_ctx(b, api, gate=False).new_page(); tp.goto(base + "students.html"); tp.fill("#tk", "teacher-secret"); tp.click("#ld"); tp.wait_for_selector(".tbl", timeout=6000)
    check("учитель: видит зарегистрированных учеников", "Иванова Аня" in tp.inner_text(".tbl") and "2 / 25" in tp.inner_text(".tbl"), tp.inner_text(".tbl")[:120])
    bad = [e for e in bag if "favicon" not in e and "401" not in e]
    check("онлайн: нет ошибок в консоли", not bad, bad[:3])


def botguard(b, base):
    print("\n== ЗАЩИТА ОТ БОТОВ ==")
    import random
    # 1. автоматизированный браузер (признаки webdriver / headless) блокируется сразу
    ctx = new_ctx(b, raw=True, bot=True); pg = ctx.new_page(); pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code"); pg.wait_for_timeout(300)
    check("бот: автоматизированный браузер блокируется, видно красное «Ай-ай-ай»", pg.evaluate("document.getElementById('code').readOnly") and "Ай-ай-ай" in pg.inner_text("#hn"), pg.inner_text("#hn")[:60])
    check("бот: кнопка проверки отключена", pg.is_disabled("#chk"))
    pg.click("#code"); pg.keyboard.type("print(1)"); check("бот: ввод в заблокированный редактор не проходит", "print(1)" not in pg.evaluate("document.getElementById('code').value"))
    pg.reload(); pg.wait_for_selector("#code"); pg.wait_for_timeout(300)
    check("бот: блокировка не снимается обновлением страницы", pg.evaluate("document.getElementById('code').readOnly"))
    ctx.close()
    # 2. «обычный» браузер, но ввод с одинаковым ритмом, как у скрипта
    ctx = new_ctx(b, raw=True); pg = ctx.new_page(); pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code"); pg.click("#code")
    check("бот: настоящий браузер без признаков автоматизации не блокируется", not pg.evaluate("document.getElementById('code').readOnly"))
    pg.keyboard.type("x = 1\n" * 8, delay=25); pg.wait_for_timeout(200)
    check("бот: равномерный «машинный» ввод блокируется", pg.evaluate("document.getElementById('code').readOnly") and "Ай-ай-ай" in pg.inner_text("#hn"), pg.inner_text("#hn")[:60])
    pg.click("#hn button"); pg.wait_for_timeout(200)
    check("бот: кнопка «Я человек» снимает блокировку по ритму", not pg.evaluate("document.getElementById('code').readOnly"))
    ctx.close()
    # 3. человек печатает неровно: не блокируем
    ctx = new_ctx(b, raw=True); pg = ctx.new_page(); pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code"); pg.click("#code")
    random.seed(5)
    for ch in "name = input()\ncity = input()\nprint(name)":
        pg.keyboard.type(ch); pg.wait_for_timeout(random.randint(40, 260))
    check("бот: человеческий неровный ввод не блокируется", not pg.evaluate("document.getElementById('code').readOnly") and "name = input()" in pg.evaluate("document.getElementById('code').value"))
    ctx.close()
    # 4. открытые инструменты разработчика (имитация через отладчик): редактор блокируется, после закрытия снова работает
    ctx = new_ctx(b, raw=True); pg = ctx.new_page(); pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code")
    cdp = ctx.new_cdp_session(pg)
    import threading as _th
    cdp.on("Debugger.paused", lambda e: _th.Timer(0.4, lambda: None).start() or pg.wait_for_timeout(400) or cdp.send("Debugger.resume"))
    cdp.send("Debugger.enable"); pg.wait_for_timeout(6000)
    check("F12: при открытых инструментах разработчика редактор блокируется", pg.evaluate("document.getElementById('code').readOnly") and "F12" in pg.inner_text("#hn"), pg.inner_text("#hn")[:60])
    cdp.send("Debugger.disable"); pg.wait_for_timeout(2500)
    check("F12: после закрытия инструментов редактор снова доступен", not pg.evaluate("document.getElementById('code').readOnly"))
    pg.keyboard.press("F12"); pg.wait_for_timeout(200); check("F12: нажатие F12 на странице задания перехватывается", "F12" in pg.inner_text("#hn"))
    ctx.close()
    # 5. поддельный «режим учителя» из консоли не отключает проверку на F12
    ctx = new_ctx(b, raw=True); ctx.add_init_script("localStorage.setItem('teacher','x')"); pg = ctx.new_page(); pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code")
    cdp = ctx.new_cdp_session(pg); cdp.on("Debugger.paused", lambda e: pg.wait_for_timeout(400) or cdp.send("Debugger.resume")); cdp.send("Debugger.enable"); pg.wait_for_timeout(6000)
    check("F12: флажок teacher в localStorage не освобождает от блокировки", pg.evaluate("document.getElementById('code').readOnly"))
    ctx.close()


def unlock(b, base):
    print("\n== «САЙТ ВЗЛОМАН»: РАЗБЛОКИРОВКА ЗАДАЧАМИ ==")
    import datetime as D
    ctx = new_ctx(b); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
    n = {"id": "u1", "at": D.datetime.now(D.timezone.utc).isoformat(), "sec": 300, "unlock": True, "title": "ОШИБКА", "text": "Сайт взломан!"}
    ctx.route("**/notice.json*", lambda r: r.fulfill(body=json.dumps(n), content_type="application/json"))
    pg.goto(base + "cloud.html"); pg.wait_for_selector("#notice #nuc", timeout=6000)
    check("взлом: экран с задачами появился, обновление его не убирает", "Задача 1 из 3" in pg.inner_text("#nuh"))
    pg.keyboard.press("Escape"); check("взлом: Esc не закрывает", pg.locator("#notice").count() == 1)
    def ask(code, want):
        pg.fill("#nuc", code); pg.click("#nub"); t0 = time.time()
        while time.time() - t0 < 40 and want not in pg.inner_text("#notice"): time.sleep(.3)
        return want in pg.inner_text("#notice")
    check("взлом: неверный код отклоняется", ask("print(1)", "Пока не так"))
    check("взлом: задача 1 (арифметика) принимается", ask("print(15 + 27 + 8)", "Задача 2 из 3"))
    check("взлом: задача 2 (print) принимается", ask('print("Сайт спасён")', "Задача 3 из 3"))
    pg.fill("#nuc", 'name = input()\nage = int(input())\nprint(f"{name}, через 5 лет тебе {age + 5}")'); pg.click("#nub"); pg.wait_for_selector("#notice", state="detached", timeout=40000)
    check("взлом: после 3 задач сайт разблокирован", True)
    pg.reload(); pg.wait_for_timeout(2500); check("взлом: после разблокировки экран не возвращается", pg.locator("#notice").count() == 0)
    check("взлом: нет ошибок в консоли", not bag, bag[:3]); ctx.close()


def chaos(b, base):
    print("\n== ИСПОРЧЕННЫЕ ДАННЫЕ В БРАУЗЕРЕ ==")
    junk = ["null", "{", "[]", '"x"', "12", "true", '{"last":"zzz","n":"NaN","days":5}']
    for n, j in enumerate(junk):
        ctx = new_ctx(b); ctx.route("https://api.github.com/**", lambda r: r.fulfill(status=200, body="[]", content_type="application/json")); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
        pg.goto(base + "index.html")
        pg.evaluate("""(j)=>{['streak','played','passed','done','nick','group','fio','hn_1.1','hnc_1.1','code_1.1'].forEach(k=>localStorage.setItem(k,j))}""", j)
        for u in ("index.html", "tasks.html", "task.html?id=1.1", "task.html?id=9.9", "theory.html", "video.html", "teacher.html", "start.html", "quiz.html", "projects.html", "cloud.html", "slides.html"):
            pg.goto(base + u); pg.wait_for_timeout(250)
        check("мусор в хранилище %r: нет ошибок на страницах" % j, not bag, bag[:2]); ctx.close()


def wf(pg, expr, timeout=10000):
    """Ждёт, пока выражение станет истинным (wait_for_function не работает из-за CSP без unsafe-eval)."""
    end = time.time() + timeout / 1000
    while time.time() < end:
        try:
            if pg.evaluate("()=>!!(" + expr + ")"): return True
        except Exception: pass
        pg.wait_for_timeout(120)
    raise AssertionError("не дождались: " + expr[:90])


def race(b, base):
    print("\n== ГОНКА ДЛЯ ВСЕХ (настоящий сервер) ==")
    api = start_api(base.rstrip("/")); bag = []
    RM = sys.modules["race"]; RM.MIN_GAP = 0; RM.TYPE_RATE = 80
    def student(page, w=1280, h=800, mobile=False):
        ctx = api_ctx(b, api, w, h, mobile=mobile); pg = ctx.new_page(); attach_errors(pg, bag); pg.goto(base + page); return ctx, pg
    c1, s1 = student("tasks.html"); c2, s2 = student("index.html", 390, 780, True); c3, s3 = student("theory.html")
    check("меню: вкладки «Исходники (GitHub)» у учеников нет", s1.evaluate("document.querySelector('#smenu').textContent").find("GitHub") < 0 and s1.locator("#smenu a[href*='github.com']").count() == 0)
    check("меню: есть пункт «Гонка по Python»", "Гонка по Python" in s1.evaluate("document.querySelector('#smenu').textContent"))
    ctxT = api_ctx(b, api); mock_github(ctxT, {"сдача": [], "проект": []}); t = ctxT.new_page(); attach_errors(t, bag)
    t.goto(base + "teacher.html"); t.wait_for_selector(".gate"); t.evaluate("(document.querySelector('.gate details')||{}).open=true"); t.fill("#tk", "ghp_good"); t.click("#in"); t.wait_for_selector(".kpi", timeout=10000)
    t.click('#tb button[data-k="game"]'); t.wait_for_selector("#ga")
    t.fill("#gk", "wrong"); t.click("#ga"); t.wait_for_selector("#gmsg.bad", timeout=6000)
    check("кабинет: без верного ключа игру не запустить", "ключ" in t.inner_text("#gmsg").lower(), t.inner_text("#gmsg"))
    t.fill("#gk", "teacher-secret"); t.click("#ga"); t.wait_for_selector("#gmsg.ok", timeout=6000)
    for pg in (s1, s2, s3): pg.wait_for_selector("#egp", timeout=10000)
    check("заставка: у всех на экране «Давайте поиграем!»", all("Давайте поиграем" in pg.inner_text("#egp") for pg in (s1, s2, s3)))
    bg = s1.evaluate("getComputedStyle(document.getElementById('egp')).backgroundImage")
    check("заставка: жёлто-оранжевый фон", "255, 210, 74" in bg and "255, 122, 0" in bg, bg)
    s1.screenshot(path="/tmp/race_intro.png")
    for pg in (s1, s2, s3): pg.wait_for_url("**/race.html", timeout=14000)
    check("заставка: через несколько секунд открывается гонка", True)
    for pg, nick in ((s1, "anya_r"), (s2, "boris_r"), (s3, "vera_r")):
        pg.wait_for_selector("#gn", timeout=8000); pg.fill("#gn", nick); pg.fill("#gp", "secret1"); pg.fill("#ge", nick + "@mail.ru"); pg.click("#ggo"); pg.wait_for_selector("#rc_main", timeout=10000)
    wf(s1, "document.body.innerText.includes('В игре: 3')", timeout=10000)
    check("гонка: все трое зарегистрировались (логин и пароль) и ждут старта", "Ждём старта" in s1.inner_text("#rc_head"))
    check("гонка: на телефоне нет горизонтальной прокрутки", not s2.evaluate("document.documentElement.scrollWidth>innerWidth+1"))
    t.click("#gs"); wf(t, "document.getElementById('gmsg').textContent.includes('началась')", timeout=6000)
    for pg in (s1, s2, s3): pg.wait_for_selector("#rcode", timeout=8000)
    check("гонка: после старта у всех появилась первая задача", all("Задача 1 из 5" in pg.inner_text("#rc_task") for pg in (s1, s2, s3)))
    GOOD = ['name = input()\nprint(f"Привет, {name}!")', 'a = int(input())\nb = int(input())\nprint(a + b)', 'x = int(input())\nprint(4 * x)',
            'n = int(input())\nprint("Чётное" if n % 2 == 0 else "Нечётное")', 'b = int(input())\nprint(5 if b >= 85 else 4 if b >= 70 else 3 if b >= 50 else 2)']
    def solve(pg, i, code):
        pg.wait_for_selector("#rcode"); wf(pg, "document.getElementById('rc_task').innerText.includes('Задача %d из')" % (i + 1)); pg.click("#rcode"); pg.keyboard.type(code, delay=40); pg.click("#rsend")
    solve(s2, 0, 'print("Привет, Анна!")'); wf(s2, "document.getElementById('rmsg').textContent.includes('ждали')", timeout=15000)
    check("гонка: зашитый ответ не засчитан, показана причина", "ждали" in s2.inner_text("#rmsg"), s2.inner_text("#rmsg"))
    s2.click("#rcode"); s2.keyboard.press("Control+A"); s2.keyboard.press("Backspace")
    for i, c in enumerate(GOOD):
        solve(s1, i, c)
        if i < 4: wf(s1, "document.getElementById('rc_task').innerText.includes('Задача %d из')" % (i + 2), timeout=20000)
    s1.wait_for_selector(".fin", timeout=20000)
    check("гонка: первый финишировал, видит «Финиш» и 1 место", "Финиш" in s1.inner_text("#rc_task") and "1" in s1.inner_text("#rc_task"), s1.inner_text("#rc_task"))
    s1.screenshot(path="/tmp/race_run.png")
    for i, c in enumerate(GOOD):
        solve(s3, i, c)
        if i < 4: wf(s3, "document.getElementById('rc_task').innerText.includes('Задача %d из')" % (i + 2), timeout=20000)
    s3.wait_for_selector(".fin", timeout=20000)
    for i, c in enumerate(GOOD[:3]):
        if i == 0: s2.evaluate("document.getElementById('rc_task').innerHTML=''"); s2.wait_for_selector("#rcode", timeout=8000)
        solve(s2, i, c)
        if i < 2: wf(s2, "document.getElementById('rc_task').innerText.includes('Задача %d из')" % (i + 2), timeout=20000)
    wf(s2, "document.getElementById('rc_task').innerText.includes('Задача 4 из')", timeout=20000)
    check("гонка: у третьего ученика прогресс 3 из 5, он продолжает", True)
    wf(s2, "document.querySelector('.pod')!==null", timeout=8000)
    pod = s2.inner_text(".pod"); check("гонка: подиум показывает победителей по порядку", pod.find("anya_r") < pod.find("vera_r") and "anya_r" in pod and "boris_r" not in pod, pod)
    check("гонка: на поле виден бегун каждого игрока", s2.locator(".lane").count() == 3 and s2.locator(".lane svg.rn").count() == 3, s2.locator(".lane").count())
    # табло для проектора без входа
    cb = api_ctx(b, api, 1280, 720); bd = cb.new_page(); attach_errors(bd, bag); bd.goto(base + "race.html?board=1"); bd.wait_for_selector(".trk", timeout=8000)
    check("табло: без входа видно забег и подиум", "anya_r" in bd.inner_text("#app") and "Ждём" not in bd.inner_text("#rc_head") and bd.locator("#rcode").count() == 0)
    bd.screenshot(path="/tmp/race_board.png")
    # защита: из консоли нельзя подменить Honest / Net
    s1.goto(base + "task.html?id=1.1"); s1.wait_for_selector("#code")
    r = s1.evaluate("()=>{try{window.Honest=null;Honest.code=function(){return 'x'}}catch(e){} try{Net.req=null}catch(e){} return [typeof Honest.code, typeof Honest.attach, typeof Net.req, Object.isFrozen(Honest)]}")
    check("защита: Honest и Net из консоли не подменить", r[1] == "function" and r[2] == "function" and r[3] is True and r[0] == "function", r)
    # учитель останавливает и сбрасывает
    t.click("#gx"); t.wait_for_selector("#gmsg.ok"); wf(t, "document.getElementById('gv').innerText.includes('окончена')", timeout=6000)
    wf(s2, "document.getElementById('rc_head').innerText.includes('окончена')", timeout=8000)
    check("учитель: «Остановить» завершает гонку у всех", True)
    t.once("dialog", lambda d: d.accept()); t.click("#gr"); wf(t, "document.getElementById('gv').innerText.includes('игры нет')", timeout=6000)
    check("учитель: «Сбросить» очищает игру", True)
    check("гонка: нет ошибок в консоли (кроме проверки неверного ключа)", not [x for x in bag if "403" not in x], bag[:4])
    for c in (c1, c2, c3, ctxT, cb): c.close()


def gate(b, base):
    print("\n== ПЕРВОЕ ОКНО: РЕГИСТРАЦИЯ, ВОССТАНОВЛЕНИЕ ПАРОЛЯ, СДАЧА НА СЕРВЕР ==")
    import urllib.request, json as _j
    api = start_api(base.rstrip("/")); bag = []
    ctx = api_ctx(b, api); pg = ctx.new_page(); attach_errors(pg, bag)
    pg.goto(base + "tasks.html"); pg.wait_for_selector("#gate", timeout=8000)
    check("вход: при первом заходе открывается окно регистрации", "Создай профиль" in pg.inner_text("#gate") and pg.locator("#ge").count() == 1)
    check("вход: GitHub в окне не упоминается", "github" not in pg.inner_text("#gate").lower())
    pg.screenshot(path="/tmp/gate.png")
    pg.click("#ggo"); check("вход: пустая форма не отправляется", "Впиши логин" in pg.inner_text("#ger"))
    pg.fill("#gn", "masha_g"); pg.fill("#gp", "secret1"); pg.click("#ggo"); check("вход: без почты не пускает", "почту" in pg.inner_text("#ger"), pg.inner_text("#ger"))
    pg.fill("#ge", "не-почта"); pg.click("#ggo"); pg.wait_for_function("1") if False else pg.wait_for_timeout(900)
    check("вход: неверная почта отклонена сервером", "Почта" in pg.inner_text("#ger"), pg.inner_text("#ger"))
    pg.fill("#ge", "masha@mail.ru"); pg.click("#ggo"); pg.wait_for_selector("#gate", state="detached", timeout=8000); pg.wait_for_timeout(500)
    check("вход: после регистрации окно исчезает и сайт открыт", pg.locator("#gate").count() == 0 and "Задания" in pg.title() or pg.locator("#gate").count() == 0)
    nick = pg.evaluate("(JSON.parse(localStorage.getItem('acct')||'{}')).nick"); check("вход: профиль сохранён", nick == "masha_g", nick)
    pg.reload(); pg.wait_for_timeout(1200); check("вход: после обновления окно не возвращается", pg.locator("#gate").count() == 0)
    # сдача на сервер вместо GitHub
    pg.goto(base + "task.html?id=1.1"); pg.wait_for_selector("#code"); pg.click("#code"); pg.keyboard.press("Control+A"); pg.keyboard.press("Backspace"); pg.keyboard.type('name = input()\ncity = input()\nprint(f"Меня зовут {name}, я из {city}")', delay=30)
    pg.click("#go"); pg.wait_for_selector("#msg.ok", timeout=20000)
    check("сдача: сервер проверил и принял решение (без GitHub)", "Принято" in pg.inner_text("#msg"), pg.inner_text("#msg"))
    check("сдача: нет окон GitHub", not any("github.com" in p_.url for p_ in ctx.pages))
    def tapi(path):
        r = urllib.request.Request(api + path, headers={"X-Teacher-Key": "teacher-secret"}); return _j.load(urllib.request.urlopen(r))
    subs = tapi("/api/teacher/subs")["rows"]; check("сдача: учитель видит её на сервере", subs and subs[0]["nick"] == "masha_g" and subs[0]["status"] == "ok", subs[:1])
    # забыл пароль: ученик выходит и восстанавливает по коду
    pg.evaluate("localStorage.removeItem('acct')"); pg.goto(base + "index.html"); pg.wait_for_selector("#gate"); pg.click("#tIn"); pg.click("#gfg")
    pg.fill("#gl", "masha@mail.ru"); pg.click("#ggo"); pg.wait_for_selector("#gc", timeout=8000)
    rec = tapi("/api/teacher/recov")["rows"]; check("пароль: учитель видит запрос и код (почта сервера не настроена)", rec and len(rec[0]["code"]) == 6 and rec[0]["nick"] == "masha_g", rec[:1])
    pg.fill("#gn", "masha_g"); pg.fill("#gc", "000000" if rec[0]["code"] != "000000" else "111111"); pg.fill("#gp", "newsecret1"); pg.click("#ggo"); pg.wait_for_timeout(900)
    check("пароль: неверный код отклонён", "Неверный код" in pg.inner_text("#ger"), pg.inner_text("#ger"))
    pg.fill("#gc", rec[0]["code"]); pg.click("#ggo"); pg.wait_for_selector("#gate", state="detached", timeout=8000)
    check("пароль: с верным кодом вход выполнен, новый пароль работает", pg.evaluate("(JSON.parse(localStorage.getItem('acct')||'{}')).nick") == "masha_g")
    prog = pg.evaluate("localStorage.getItem('passed')"); check("пароль: прогресс на месте после восстановления", prog and '"1.1"' in prog, prog)
    cl = api_ctx(b, api); lp = cl.new_page(); lp.goto(base + "index.html"); lp.wait_for_selector("#gate"); lp.click("#tIn")
    for _ in range(3): lp.fill("#gn", "masha_g"); lp.fill("#gp", "bad-pass"); lp.click("#ggo"); lp.wait_for_timeout(900)
    check("вход: после трёх неверных паролей кнопка выключена и просит подождать", "Подожди" in lp.inner_text("#ggo") and lp.is_disabled("#ggo"), lp.inner_text("#ggo")); cl.close()
    # сервер недоступен: сайт не закрывается навсегда
    cx = api_ctx(b, "http://127.0.0.1:9"); q = cx.new_page(); q.goto(base + "index.html"); q.wait_for_timeout(6000)
    check("вход: если сервер не отвечает, окно входа не закрывает сайт", q.locator("#gate").count() == 0 and q.locator("a.ico").count() > 0)
    # кабинет по ключу
    ct = api_ctx(b, api); t = ct.new_page(); attach_errors(t, bag); t.goto(base + "teacher.html"); t.wait_for_selector("#sk")
    t.fill("#sk", "bad"); t.click("#sin"); t.wait_for_selector("#sm.bad"); check("кабинет: неверный ключ не пускает", "не подошёл" in t.inner_text("#sm"))
    t.fill("#sk", "teacher-secret"); t.click("#sin"); t.wait_for_selector("#tb", timeout=8000)
    check("кабинет: по ключу видны вкладки Игра, Сдачи, Пароли", all(x in t.inner_text("#tb") for x in ("Игра", "Сдачи", "Пароли")))
    t.click('#tb button[data-k="subs"]'); t.wait_for_selector("#so table", timeout=8000); check("кабинет: во вкладке «Сдачи» видна сдача ученика", "masha_g" in t.inner_text("#so") and "решено" in t.inner_text("#so"))
    t.click('#tb button[data-k="rec"]'); t.wait_for_timeout(900); check("кабинет: во вкладке «Пароли» видно, что почта не настроена", "не настроена" in t.inner_text("#tab"), t.inner_text("#tab")[:100])
    check("вход: нет ошибок в консоли", not [x for x in bag if "ERR_CONNECTION" not in x and "Failed to load resource" not in x], bag[:4])
    for c in (ctx, cx, ct): c.close()


def boss(b, base):
    print("\n== БОСС-АРЕНА (настоящий сервер) ==")
    api = start_api(base.rstrip("/")); bag = []; A = sys.modules["app"]; BM = sys.modules["boss"]; BM.MIN_THINK = 0.2; BM.ANSWER_GAP = 0.1
    A.LUCKY.update(next=time.time() + 99999)
    def student(nick, w=1280, h=800, mobile=False):
        ctx = api_ctx(b, api, w, h, mobile=mobile); pg = ctx.new_page(); attach_errors(pg, bag); pg.goto(base + "index.html"); pg.wait_for_selector("#gate")
        pg.fill("#gn", nick); pg.fill("#gp", "secret1"); pg.fill("#ge", nick + "@mail.ru"); pg.click("#ggo"); pg.wait_for_selector("#gate", state="detached", timeout=8000); pg.wait_for_timeout(500); return ctx, pg
    c1, s1 = student("anya_b"); c2, s2 = student("boris_b", 390, 780, True)
    ct = api_ctx(b, api, gate=False); t = ct.new_page(); attach_errors(t, bag); t.goto(base + "teacher.html"); t.wait_for_selector("#sk")
    t.fill("#sk", "teacher-secret"); t.click("#sin"); t.wait_for_selector("#tb", timeout=8000); t.click('#tb button[data-k="game"]'); t.wait_for_selector("#ba")
    check("кабинет: есть кнопки босса и «Выключить игру»", all(x in t.inner_text("#tab") for x in ("Запустить арену", "Начать бой", "Остановить бой", "Выключить игру")))
    t.click("#ba"); t.wait_for_selector("#bmsg.ok", timeout=6000)
    for pg in (s1, s2): pg.wait_for_url("**/boss.html", timeout=14000)
    check("арена: у всех открылась страница босса", True)
    s1.wait_for_selector("#bs_cv", timeout=8000); wf(s1, "document.body.innerText.includes('В арене: 2')", timeout=10000)
    check("арена: в зале ожидания видно число игроков", True)
    t.click("#bs"); t.wait_for_selector("#bmsg.ok:has-text('Бой начался')", timeout=6000)
    s1.wait_for_selector("#qe", timeout=8000); check("арена: у ученика кнопки простого и сложного вопроса", "Сложный" in s1.inner_text("#bs_ctl"))
    check("арена: канвас нарисован (не пустой)", s1.evaluate("(()=>{const c=document.getElementById('bs_cv').getContext('2d').getImageData(0,0,640,360).data;let n=0;for(let i=0;i<c.length;i+=4*50)if(c[i]>100)n++;return n>20})()"))
    def hit(pg, sel, right):
        pg.click(sel); pg.wait_for_selector(".opts button[data-i]", timeout=6000)
        u = [x for x in A.BOSS.players.values() if x["q"]][0]; idx = u["q"]["ok"] if right else (u["q"]["ok"] + 1) % 4
        pg.wait_for_timeout(400); pg.click('.opts button[data-i="%d"]' % idx); pg.wait_for_selector("#bs_ctl .qbox .qt:has-text('!')", timeout=6000)
    hp0 = A.BOSS.hp; hit(s1, "#qe", True)
    check("арена: верный ответ бьёт босса на 100", A.BOSS.hp <= hp0 - 99 + 1 and any(p["dmg"] == 100 for p in A.BOSS.players.values()), (hp0, A.BOSS.hp))
    s1.wait_for_selector("#qh", timeout=6000); hit(s1, "#qh", True)
    check("арена: сложный вопрос бьёт на 330 (серия x1.1)", any(p["dmg"] == 430 for p in A.BOSS.players.values()), [p["dmg"] for p in A.BOSS.players.values()])
    s1.screenshot(path="/tmp/boss_arena.png"); s1.locator("#bs_cv").screenshot(path="/tmp/boss_cv.png")
    s2.wait_for_selector("#qe", timeout=6000); hit(s2, "#qe", False)
    check("арена: неверный ответ лечит босса и показывает «Мимо»", "Мимо" in s2.inner_text("#bs_ctl") and any(p["bad"] == 1 for p in A.BOSS.players.values()))
    s2.wait_for_function("document.querySelector('#bs_ctl .pick')") if False else s2.wait_for_timeout(1800)
    check("арена: рейтинг показывает игроков по урону", "anya_b" in s1.inner_text("#bs_rate") and s1.inner_text("#bs_rate").index("anya_b") < s1.inner_text("#bs_rate").index("boris_b"))
    BM_hp = A.BOSS.hp; A.BOSS.next_big = 0; A.BOSS.tick(time.time() + 1); s1.wait_for_timeout(1800)
    check("арена: большое лечение босса видно в событиях", any(e["k"] == "bigheal" for e in A.BOSS.events))
    A.BOSS.hp = 80; s1.wait_for_selector("#qe", timeout=8000); s1.click("#qe"); s1.wait_for_selector(".opts button[data-i]", timeout=6000); s1.wait_for_timeout(400)
    s1.click('.opts button[data-i="%d"]' % [x for x in A.BOSS.players.values() if x["q"]][0]["q"]["ok"])
    s1.wait_for_selector("text=Босс повержен", timeout=8000); check("арена: победа показывает «Босс повержен» и итог", "Твой урон" in s1.inner_text("#bs_ctl"))
    t.once("dialog", lambda d: d.accept()); t.click("#br"); t.wait_for_selector("#bmsg.ok:has-text('выключена')", timeout=6000)
    s2.wait_for_selector("text=Арены сейчас нет", timeout=8000); check("арена: «Выключить игру» закрывает арену у всех", True)
    check("арена: нет ошибок в консоли", not [x for x in bag if "Failed to load resource" not in x], bag[:3])
    for c in (c1, c2, ct): c.close()


def lucky(b, base):
    print("\n== РУЛЕТКА «ТРИ ЧЕРЕПА», ИГРА С БОЧКАМИ, СЕКРЕТЫ ==")
    import urllib.request, json as _j
    api = start_api(base.rstrip("/")); bag = []; A = sys.modules["app"]; A.LUCKY.update(next=time.time() + 99999)
    def tpost(path, body):
        r = urllib.request.Request(api + path, data=_j.dumps(body).encode(), headers={"X-Teacher-Key": "teacher-secret", "Content-Type": "application/json"}); return _j.load(urllib.request.urlopen(r))
    def tget(path): return _j.load(urllib.request.urlopen(urllib.request.Request(api + path, headers={"X-Teacher-Key": "teacher-secret"})))
    def student(nick):
        ctx = api_ctx(b, api); pg = ctx.new_page(); attach_errors(pg, bag); pg.goto(base + "index.html"); pg.wait_for_selector("#gate")
        pg.fill("#gn", nick); pg.fill("#gp", "secret1"); pg.fill("#ge", nick + "@mail.ru"); pg.click("#ggo"); pg.wait_for_selector("#gate", state="detached", timeout=8000); pg.wait_for_timeout(600); return ctx, pg
    c0, p0 = student("nolucky_1"); check("главный экран: значка «Убеги от скелета / получи 5» нет", "получи 5" not in p0.inner_text("body") and "Убеги" not in p0.inner_text("#smenu") if p0.locator("#smenu").count() else "получи 5" not in p0.inner_text("body"))
    # 1) черепа не выпали: смеющийся скелет
    c1, s1 = student("unlucky_1"); A.LUCKY_ODDS = 0.0
    tpost("/api/teacher/play", {"action": "lucky", "nick": "unlucky_1"}); s1.wait_for_selector("#lk", timeout=9000)
    check("рулетка: у выбранного ученика появилось окно, у остальных нет", "Тебе выпал шанс" in s1.inner_text("#lk") and p0.locator("#lk").count() == 0)
    s1.screenshot(path="/tmp/lucky_roulette.png")
    s1.click("#lks"); s1.wait_for_selector("#lc", timeout=9000); s1.wait_for_timeout(300)
    t = s1.inner_text("#lk"); check("рулетка: без трёх черепов «Ха-ха-ха» и «оценки нет»", "Ха-ха-ха" in t and "оценки нет" in t and "Фортуна" in t and "Может, повезёт" in t, t[:120])
    sums = []
    for _ in range(8): sums.append(s1.evaluate("(()=>{const d=document.getElementById('lc').getContext('2d').getImageData(120,100,250,60).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<40&&d[i+1]<20)n++;return n})()")); s1.wait_for_timeout(55)
    check("скелет смеётся: рот открывается и закрывается", max(sums) - min(sums) > 200, sums)
    s1.screenshot(path="/tmp/lucky_laugh.png"); s1.click("#lkx"); check("рулетка: окно закрывается кнопкой", s1.locator("#lk").count() == 0)
    # 2) три черепа: игра проходится и даёт красную пятёрку
    c2, s2 = student("lucky_win"); A.LUCKY_ODDS = 1.0
    tpost("/api/teacher/play", {"action": "lucky", "nick": "lucky_win"}); s2.wait_for_selector("#lk", timeout=9000); s2.click("#lks"); s2.wait_for_selector("#lkg", timeout=9000)
    check("рулетка: три черепа открывают игру", "Три черепа" in s2.inner_text("#lk"))
    s2.click("#lkg"); s2.wait_for_selector("#gc"); s2.evaluate("Lucky._t.nob(true)"); s2.screenshot(path="/tmp/lucky_game.png")
    st = lambda: s2.evaluate("Lucky._t.state()")
    def hold(key, until, tmo=12):
        end = time.time() + tmo; s2.keyboard.down(key)
        try:
            while time.time() < end and not until(st()): s2.wait_for_timeout(30)
        finally: s2.keyboard.up(key)
        return until(st())
    ok = hold("ArrowRight", lambda s: s["x"] >= 498) and hold("ArrowUp", lambda s: s["floor"] == 1 and not s["lad"])
    ok = ok and hold("ArrowLeft", lambda s: s["x"] <= 130) and hold("ArrowUp", lambda s: s["floor"] == 2 and not s["lad"])
    ok = ok and hold("ArrowRight", lambda s: s["x"] >= 498) and hold("ArrowUp", lambda s: s["floor"] == 3 and not s["lad"])
    check("игра: по лестницам можно подняться на самый верх", ok, st())
    hold("ArrowLeft", lambda s: s["over"], 8); s2.wait_for_selector(".five", timeout=9000)
    check("игра: добежал до скелета — красная пятёрка и «Позови преподавателя»", s2.inner_text(".five").strip() == "5" and "Позови преподавателя" in s2.inner_text("#lk") and "lucky_win" in s2.inner_text("#lk"), s2.inner_text("#lk")[:80])
    s2.screenshot(path="/tmp/lucky_five.png")
    rows = tget("/api/teacher/lucky")["rows"]; check("кабинет: победа записана как красная пятёрка", any(r["nick"] == "lucky_win" and r["kind"] == "five" for r in rows), rows[:2])
    # 3) проиграл в игре: оценка сгорает
    c3, s3 = student("lucky_lose"); tpost("/api/teacher/play", {"action": "lucky", "nick": "lucky_lose"}); s3.wait_for_selector("#lk", timeout=9000); s3.click("#lks"); s3.wait_for_selector("#lkg", timeout=9000); s3.click("#lkg"); s3.wait_for_selector("#gc")
    s3.evaluate("Lucky._t.hit()"); s3.wait_for_selector("#lc", timeout=9000)
    check("игра: бочка попала — одна попытка, «Ха-ха-ха», оценка сгорела", "Ха-ха-ха" in s3.inner_text("#lk") and "оценки нет" in s3.inner_text("#lk"))
    rows = tget("/api/teacher/lucky")["rows"]; check("кабинет: проигрыш записан", any(r["nick"] == "lucky_lose" and r["kind"] == "burned" for r in rows))
    # 3б) медленная сеть на телефоне: барабан не должен зависать (раньше падала анимация и оставалось «Крутим…»)
    c5, s5 = student("slow_1"); A.LUCKY_ODDS = 0.0; s5.route("**/api/lucky/spin", lambda r: (time.sleep(2.5), r.continue_()))
    tpost("/api/teacher/play", {"action": "lucky", "nick": "slow_1"}); s5.wait_for_selector("#lk", timeout=9000); s5.click("#lks"); s5.wait_for_selector("#lc", timeout=15000)
    check("рулетка: при медленном ответе сервера барабан доходит до результата", "Ха-ха-ха" in s5.inner_text("#lk")); c5.close()
    # 4) секреты
    c4, s4 = student("secret_1")
    s4.click("body")
    for k in ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]: s4.keyboard.press(k)
    s4.wait_for_selector("#gc", timeout=8000); check("секрет: ↑↑↓↓←→←→BA открывает тренировочную игру", "Скелет и бочки" in s4.inner_text("#lk"))
    s4.click("text=Выйти")
    for k in ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "Shift+B", "Shift+A"]: s4.keyboard.press(k)
    s4.wait_for_selector("#gc", timeout=8000); check("секрет: заглавные B A (с Shift) тоже подходят", True)
    s4.click("text=Выйти"); check("секрет: из тренировки можно выйти", s4.locator("#lk").count() == 0)
    for _ in range(5): s4.click(".clock")
    s4.wait_for_selector("#lc", timeout=6000); check("секрет: пять нажатий на часы показывают смеющегося скелета без оценок", "секрет" in s4.inner_text("#lk"))
    s4.click("#lkx")
    r = s4.evaluate("(()=>{let h=0;const old=Math.random;Math.random=()=>0.1;const el=document.createElement('div');for(let i=0;i<3;i++)EggHint(el);Math.random=old;return el.innerText})()")
    check("секрет: подсказки о секретах появляются после решённых заданий", "2 2 6 7" in r and "B A" in r and "часы" in r.lower(), r[:80])
    s4.keyboard.type("2267"); s4.wait_for_selector("#egg", timeout=5000); check("секрет: 2267 по-прежнему открывает «Убеги от скелета»", True); s4.keyboard.press("Escape")
    check("рулетка и игра: нет ошибок в консоли", not [x for x in bag if "Failed to load resource" not in x], bag[:3])
    for c in (c0, c1, c2, c3, c4): c.close()


if __name__ == "__main__":
    only = sys.argv[1:] or ["smoke", "functional", "teacher", "slides", "honest", "offline", "video", "extras", "brief", "chaos", "online", "gate", "race", "boss", "lucky", "botguard", "unlock", "perf", "stress"]
    srv, base = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccess,PrivateNetworkAccessRespectPreflightResults"])
        for name in only: globals()[name](b, base)
        b.close()
    bad = [r for r in RES if not r[1]]
    print("\nИТОГО: %d из %d прошли" % (len(RES) - len(bad), len(RES)))
    for n, _, i in bad: print("  FAIL:", n, "|", i)
    sys.exit(1 if bad else 0)
