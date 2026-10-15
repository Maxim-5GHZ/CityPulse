#!/usr/bin/env bash
# Генерация самоподписанного серта для prod-стенда.
# Приватный ключ остаётся только на хосте: nginx/certs/ в .gitignore, в репо не коммитить.
# Idempotent: если серт уже есть — ничего не делает.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p certs
if [[ -f certs/citypulse.crt && -f certs/citypulse.key ]]; then
  echo "OK: серт уже есть (certs/citypulse.crt), пропускаю."
  exit 0
fi
openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout certs/citypulse.key \
  -out certs/citypulse.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
chmod 600 certs/citypulse.key
echo "OK: certs/citypulse.crt + certs/citypulse.key (825 дней, CN=localhost)"
