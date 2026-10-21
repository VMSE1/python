"""Меняет адрес сервера курса: python3 tools/set_server.py https://course.example.com
Правит docs/config.js и строку connect-src (CSP) во всех страницах."""
import glob, re, sys
if len(sys.argv) != 2 or not re.match(r"^https://[a-z0-9.-]+$", sys.argv[1]):
    sys.exit("Использование: python3 tools/set_server.py https://адрес")
url = sys.argv[1]; host = url[len("https://"):]
cfg = open("docs/config.js", encoding="utf-8").read()
open("docs/config.js", "w", encoding="utf-8").write(re.sub(r'window\.API_BASE = "[^"]*";', 'window.API_BASE = "%s";' % url, cfg))
for p in glob.glob("docs/*.html"):
    s = open(p, encoding="utf-8").read()
    n = re.sub(r"connect-src 'self' https://api\.github\.com( https://[a-z0-9.-]+ wss://[a-z0-9.-]+)?", "connect-src 'self' https://api.github.com %s wss://%s" % (url, host), s)
    if n != s: open(p, "w", encoding="utf-8").write(n)
print("ok:", url)
