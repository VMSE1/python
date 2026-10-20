"""Браузерные тесты сайта (Playwright): дымовые, функциональные, безопасность, производительность, нагрузка.
Запуск из корня репозитория:  pip install playwright && playwright install chromium && python tests/browser_tests.py
"""
import base64, functools, http.server, json, os, re, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
RES = []


def big_fill(pg, text):
    pg.evaluate("t=>{const a=document.getElementById('code');a.value=t;a.dispatchEvent(new Event('input',{bubbles:true}))}", text)


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


def new_ctx(b, w=1280, h=820, mobile=False, seen=True):
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, device_scale_factor=2 if mobile else 1, accept_downloads=True)
    if seen: ctx.add_init_script("localStorage.seenStart='1';localStorage.visited='1'")
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
    check("desktop: 8 иконок, кнопка «Начать» ведёт к 1.1", pg.locator("a.ico").count() == 8 and "id=1.1" in pg.get_attribute("#cont", "href"))
    pg.click("a.ico >> nth=0"); pg.wait_for_url("**/tasks.html"); check("иконка «Задания» открывает карту", "tasks.html" in pg.url)
    check("карта: 22 квадрата, один «следующий»", pg.locator(".node").count() == 22 and pg.locator(".node.next").count() == 1)
    pg.click(".node >> nth=3"); pg.wait_for_url("**/task.html?id=1.4"); check("клик по квадрату открывает задание", "id=1.4" in pg.url)
    pg.click(".wb >> text=Закрыть"); pg.wait_for_url("**/index.html"); check("«Закрыть» возвращает на рабочий стол", True)
    pg.click("#startBtn"); check("«Пуск» открывает меню (11 пунктов)", pg.locator("#smenu.on a").count() == 11, pg.locator("#smenu.on a").count())
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
    pg.fill("#nick", ""); pg.click("#go"); check("отправка: без ника просит ник", "ник" in pg.inner_text("#msg"))
    pg.fill("#nick", "snake_42"); pg.fill("#group", ""); pg.click("#go"); check("отправка: без группы просит группу", "групп" in pg.inner_text("#msg"))
    with ctx.expect_page() as np:
        pg.fill("#nick", "snake_42"); pg.fill("#group", "9А"); pg.click("#go")
    pop = np.value.url; from urllib.parse import unquote
    pop = unquote(unquote(pop)); check("отправка: открывается заполненная форма Issue", "issues/new" in pop and "snake_42" in pop and "template=submit.yml" in pop and "group=9А" in pop, pop[:90])
    # длинный код
    big_fill(pg, "x=1\n" * 5000)
    with ctx.expect_page() as np2: pg.click("#go")
    check("отправка: очень длинный код не ломает URL (запасной путь)", len(np2.value.url) < 8000 and "code=" not in np2.value.url)
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
    pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate")
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
    pg.click("#tb button >> nth=4"); pg.fill("#qi", base64.b64encode(json.dumps({"n": "anna", "l": 0, "d": "x", "a": [[0, 0], [1, 1]]}).encode()).decode()); pg.click("#qg"); pg.wait_for_timeout(200)
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
    pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate"); check("безопасность: запомненный токен истекает через 7 дней", pg.evaluate("!localStorage.tk"))
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
    ctx = new_ctx(b); ctx.grant_permissions(["clipboard-read", "clipboard-write"]); pg = ctx.new_page(); bag = []; attach_errors(pg, bag)
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
    with ctx.expect_page() as np: pg.click("#go")
    raw = unquote(unquote(np.value.url)); import re as _re
    m = _re.search(r"meta=(v1;[^&]*)", raw); meta = dict(p.split("=") for p in m.group(1).split(";")[1:]) if m else {}
    final = pg.input_value("#code")
    check("честный ввод: в заявку уходят метаданные набора", m is not None and int(meta.get("t", 0)) >= 9 and int(meta.get("p", 0)) >= 1 and int(meta.get("b", 0)) == 1, raw[-120:])
    check("честный ввод: Tab и стирание не считаются подменой", meta.get("e") == "0", meta)
    check("честный ввод: хеш кода в заявке совпадает с кодом", meta.get("h") == hn_hash(final), (meta.get("h"), hn_hash(final)))
    pg.reload(); pg.wait_for_selector("#code"); pg.fill("#nick", "snake_42"); pg.fill("#group", "9А")
    with ctx.expect_page() as np2: pg.click("#go")
    m2 = _re.search(r"meta=(v1;[^&]*)", unquote(unquote(np2.value.url)))
    check("честный ввод: счётчик переживает перезагрузку страницы", m2 and "p=" in m2.group(1) and int(dict(p.split("=") for p in m2.group(1).split(";")[1:])["t"]) >= 9)
    pg.once("dialog", lambda d: d.accept()); pg.click("#rs"); pg.fill("#nick", "snake_42"); pg.fill("#group", "9А")
    with ctx.expect_page() as np3: pg.click("#go")
    m3 = _re.search(r"meta=(v1;[^&]*)", unquote(unquote(np3.value.url)))
    check("честный ввод: «Сбросить» обнуляет счётчик", m3 and "t=0;p=0;b=0;e=0" in m3.group(1), m3 and m3.group(1))
    check("честный ввод: нет ошибок в консоли", not bag, bag[:3]); ctx.close()
    # кабинет: пометки в «Заявках»
    code = "print(1)"
    good = "v1;t=8;p=0;b=0;e=0;s=10;h=" + hn_hash(code)
    issues = [issue(1, "anna", "1.1", "решено", "\n\n### Служебное (не меняй)\n\n" + good),
              issue(2, "boris", "1.1", "решено", "\n\n### Служебное (не меняй)\n\nv1;t=8;p=3;b=0;e=0;s=10;h=" + hn_hash(code)),
              issue(3, "vera", "1.1", "решено", "\n\n### Служебное (не меняй)\n\nv1;t=8;p=0;b=0;e=0;s=10;h=00000000"),
              issue(4, "gleb", "1.1", "решено")]
    ctx = new_ctx(b); mock_github(ctx, {"сдача": issues, "проект": []}); pg = ctx.new_page(); pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate")
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
    pg.goto(base + "teacher.html"); pg.wait_for_selector(".gate"); pg.fill("#tk", "ghp_good"); pg.click("#in"); pg.wait_for_selector(".kpi", timeout=10000)
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


if __name__ == "__main__":
    only = sys.argv[1:] or ["smoke", "functional", "teacher", "slides", "honest", "offline", "video", "perf", "stress"]
    srv, base = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        for name in only: globals()[name](b, base)
        b.close()
    bad = [r for r in RES if not r[1]]
    print("\nИТОГО: %d из %d прошли" % (len(RES) - len(bad), len(RES)))
    for n, _, i in bad: print("  FAIL:", n, "|", i)
    sys.exit(1 if bad else 0)
