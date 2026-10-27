#!/usr/bin/env bash
# Обновление сайта и сервера на VPS из GitHub (запуск от root, вручную или по таймеру pycourse-update):
#   /opt/pycourse/server/deploy_site.sh
# Что делает: git pull --ff-only, собирает данные сайта (tools/build_site.py), копирует docs/ в /var/www/pycourse,
# перезапускает сервис, только если что-то изменилось. Код разрабатывается на GitHub, раздаёт его твой сервер.
set -euo pipefail
DIR=/opt/pycourse
WWW=/var/www/pycourse
cd "$DIR"
OLD="$(git rev-parse HEAD)"
git pull --ff-only -q
NEW="$(git rev-parse HEAD)"
if [ "$OLD" = "$NEW" ] && [ -f "$WWW/index.html" ] && [ "${1:-}" != "--force" ]; then exit 0; fi
python3 tools/build_site.py >/dev/null
mkdir -p "$WWW"
if command -v rsync >/dev/null; then rsync -a --delete docs/ "$WWW/"; else rm -rf "${WWW:?}"/* && cp -a docs/. "$WWW/"; fi
"$DIR/venv/bin/pip" install -q -r server/requirements.txt
systemctl restart pycourse
echo "Сайт обновлён: ${OLD:0:7} -> ${NEW:0:7}"
