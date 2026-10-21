#!/usr/bin/env bash
# Установка и обновление сервера курса на VPS (Debian/Ubuntu), запуск от root:
#   curl -fsSL https://raw.githubusercontent.com/VMSE1/python/main/server/install.sh | bash
# Свой домен: ... | bash -s -- course.example.com   (А-запись домена должна смотреть на IP сервера)
set -euo pipefail
REPO="https://github.com/VMSE1/python"
DIR=/opt/pycourse
ENVF=/etc/pycourse.env
[ "$(id -u)" = 0 ] || { echo "Запусти от root"; exit 1; }

IP="$(curl -4fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || DOMAIN="$(echo "$IP" | tr . -).sslip.io"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv git curl sqlite3
if ! command -v caddy >/dev/null; then
  apt-get install -y caddy || {
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
  }
fi

if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone --depth 1 "$REPO" "$DIR"; fi
python3 -m venv "$DIR/venv"
"$DIR/venv/bin/pip" install -q -r "$DIR/server/requirements.txt"
mkdir -p /var/lib/pycourse /var/backups/pycourse

if [ ! -f "$ENVF" ]; then
  KEY="$(python3 -c 'import secrets;print(secrets.token_urlsafe(12))')"
  cat > "$ENVF" <<EOF
TEACHER_KEY=$KEY
DB_PATH=/var/lib/pycourse/data.sqlite
PORT=8080
ALLOW_ORIGINS=https://vmse1.github.io
EOF
  chmod 600 "$ENVF"
  NEWKEY="$KEY"
fi

cat > /etc/systemd/system/pycourse.service <<EOF
[Unit]
Description=Python course server
After=network.target
[Service]
EnvironmentFile=$ENVF
WorkingDirectory=$DIR/server
ExecStart=$DIR/venv/bin/python app.py
Restart=always
RestartSec=2
User=www-data
Group=www-data
StateDirectory=pycourse
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
chown -R www-data:www-data /var/lib/pycourse /var/backups/pycourse

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
EOF

cat > /etc/cron.daily/pycourse-backup <<'EOF'
#!/bin/sh
sqlite3 /var/lib/pycourse/data.sqlite ".backup '/var/backups/pycourse/data-$(date +%F).sqlite'" && find /var/backups/pycourse -name 'data-*.sqlite' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/pycourse-backup

systemctl daemon-reload
systemctl enable --now pycourse
systemctl restart pycourse
systemctl enable caddy
systemctl restart caddy
sleep 4
echo
echo "================ ГОТОВО ================"
echo "Адрес сервера:  https://$DOMAIN"
[ -n "${NEWKEY:-}" ] && echo "Ключ учителя:   $NEWKEY   (запиши; хранится в $ENVF)" || echo "Ключ учителя:   см. $ENVF"
echo "Проверка:       curl https://$DOMAIN/api/ping"
curl -fsS "https://$DOMAIN/api/ping" || echo "(сертификат ещё выпускается: подожди минуту и повтори проверку; проверь, что порты 80 и 443 открыты)"
