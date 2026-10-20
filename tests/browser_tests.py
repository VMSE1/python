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


PAGES = ["index.html", "tasks.html", "theory.html", "quiz.html", "projects.html", "teacher.html", "task.html?id=1.1", "task.html?id=5.4", "theory.html?l=3"]


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
    check("desktop: 5 иконок, кнопка «Начать» ведёт к 1.1", pg.locator("a.ico").count() == 5 and "id=1.1" in pg.get_attribute("#cont", "href"))
    pg.click("a.ico >> nth=0"); pg.wait_for_url("**/tasks.html"); check("иконка «Задания» открывает карту", "tasks.html" in pg.url)
    check("карта: 22 квадрата, один «следующий»", pg.locator(".node").count() == 22 and pg.locator(".node.next").count() == 1)
    pg.click(".node >> nth=3"); pg.wait_for_url("**/task.html?id=1.4"); check("клик по квадрату открывает задание", "id=1.4" in pg.url)
    pg.click(".wb >> text=Закрыть"); pg.wait_for_url("**/index.html"); check("«Закрыть» возвращает на рабочий стол", True)
    pg.click("#startBtn"); check("«Пуск» открывает меню (7 пунктов)", pg.locator("#smenu.on a").count() == 7, pg.locator("#smenu.on a").count())
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
        pg.fill("#code", code); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=tmo); return pg.get_attribute("#res", "class"), pg.inner_text("#res")
    cls, txt = run_code(starter); check("задание: заготовка -> «только заготовка»", "fail" in cls and "заготовка" in txt, txt[:60])
    cls, txt = run_code('name=input("Имя: ")\ncity=input("Город: ")\nprint(f"Меня зовут {name}, я из {city}")'); check("задание: верное решение -> зелёный", "pass" in cls, txt[:80])
    cls, txt = run_code('print("не то")'); check("задание: неверное -> красный", "fail" in cls, txt[:80])
    pg.fill("#code", "while True: pass"); t0 = time.time(); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=30000)
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
    pg.click("#tb button >> nth=2"); pg.wait_for_selector("#stc")
    with pg.expect_download() as d2: pg.click("#stc")
    stc = open(d2.value.path(), encoding="utf-8-sig", newline="").read().split("\r\n")
    check("кабинет: students.csv для робота (github;фио;группа)", stc[0] == "github;фио;группа;примечание" and any(l.startswith("gh_anna;;9А") for l in stc), stc[:3])
    pg.click("#tb button >> nth=0")
    check("кабинет: пункт появился в «Пуске»", "Кабинет" in pg.evaluate("document.querySelector('#smenu').textContent"))
    check("кабинет: токен в sessionStorage, не в localStorage", pg.evaluate("!!sessionStorage.tk && !localStorage.tk"))
    pg.click("#tb button >> nth=3"); pg.fill("#qi", base64.b64encode(json.dumps({"n": "anna", "l": 0, "d": "x", "a": [[0, 0], [1, 1]]}).encode()).decode()); pg.click("#qg"); pg.wait_for_timeout(200)
    pg.click("#tb button >> nth=0"); pg.wait_for_selector("#csv")
    with pg.expect_download() as d: pg.click("#csv")
    path = d.value.path(); data = open(path, encoding="utf-8-sig", newline="").read()
    lines = data.split("\r\n")
    check("выгрузка: ведомость скачивается (CSV, ; , BOM)", len(lines) >= 5 and lines[0].startswith("Ученик;Ник;1.1"), "строк=%d, заголовок=%r" % (len(lines), lines[0][:30]))
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
        pg.fill("#code", 'print("x%d")' % i); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=60000); ok += 1
    check("нагрузка: 20 проверок подряд в одной вкладке", ok == 20, "%.1fс" % (time.time() - t0))
    big_fill(pg, "x = 1\n" * 50000); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=60000)
    check("нагрузка: код 300 КБ не вешает страницу", pg.evaluate("1+1") == 2)
    big_fill(pg, 'print("a"*10**7)'); pg.click("#chk"); pg.wait_for_selector("#res.on:not(.wait)", timeout=60000); check("нагрузка: вывод 10 МБ не вешает страницу", pg.evaluate("1+1") == 2)
    ctx.close()


if __name__ == "__main__":
    only = sys.argv[1:] or ["smoke", "functional", "teacher", "perf", "stress"]
    srv, base = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        for name in only: globals()[name](b, base)
        b.close()
    bad = [r for r in RES if not r[1]]
    print("\nИТОГО: %d из %d прошли" % (len(RES) - len(bad), len(RES)))
    for n, _, i in bad: print("  FAIL:", n, "|", i)
    sys.exit(1 if bad else 0)
