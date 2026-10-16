#!/usr/bin/env bash
# e2e на ОБЩЕЙ dev-базе (Testcontainers не тащим).
# Правило: «создал — удали», все имена с префиксом e2e- + timestamp.
# Раз есть POST — обязан быть DELETE: cleanup висит на trap и выполняется всегда.
# Запуск: ./scripts/e2e.sh (стенд уже поднят через make dev).
set -euo pipefail

BASE="${BASE:-http://localhost:8080/api}"
TS="$(date +%s)"
ADMIN_EMAIL="${APP_ADMIN_EMAIL:-}"
ADMIN_PASS="${APP_ADMIN_PASSWORD:-}"

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASS" ]]; then
  echo "Нужны APP_ADMIN_EMAIL/APP_ADMIN_PASSWORD из .env (админ создаётся только из ENV)"
  exit 1
fi

E2E_USER="e2e-${TS}@example.com"
E2E_PASS="e2e-pass-123"
CREATED_ID=""

pass() { echo "  ok: $1"; }
fail() { echo "  FAIL: $1"; exit 1; }

cleanup() {
  if [[ -n "$CREATED_ID" && -n "${ADMIN_TOKEN:-}" ]]; then
    curl -s -o /dev/null -X DELETE "$BASE/admin/users/$CREATED_ID" \
      -H "Authorization: Bearer $ADMIN_TOKEN" || true
    echo "  cleanup: удалён $E2E_USER"
  fi
}
trap cleanup EXIT

echo "== health =="
curl -s -f "$BASE/health" > /dev/null || fail "health"
pass "health"

echo "== admin login =="
ADMIN_TOKEN="$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')"
[[ -n "$ADMIN_TOKEN" ]] || fail "admin login"
pass "admin login"

echo "== create user (POST) =="
RESP="$(curl -s -X POST "$BASE/admin/users" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"email\":\"$E2E_USER\",\"password\":\"$E2E_PASS\",\"role\":\"USER\"}")"
echo "$RESP" | grep -q "$E2E_USER" || fail "create: $RESP"
CREATED_ID="$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')"
pass "create $E2E_USER ($CREATED_ID)"

echo "== list contains created =="
curl -s "$BASE/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN" | grep -q "$E2E_USER" \
  || fail "list"
pass "list"

echo "== e2e user login =="
USER_TOKEN="$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$E2E_USER\",\"password\":\"$E2E_PASS\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')"
[[ -n "$USER_TOKEN" ]] || fail "e2e login"
pass "e2e login"

echo "== non-admin blocked from admin API (403) =="
CODE="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/users" \
  -H "Authorization: Bearer $USER_TOKEN")"
[[ "$CODE" == "403" ]] || fail "ожидался 403, получили $CODE"
pass "403 для USER"

echo "== delete user (DELETE — чистка за собой) =="
curl -s -f -X DELETE "$BASE/admin/users/$CREATED_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null || fail "delete"
CREATED_ID="" # удалили сами — trap'у делать нечего
pass "delete"

echo "== verify gone =="
curl -s "$BASE/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN" | grep -q "$E2E_USER" \
  && fail "мусор остался в базе" || pass "база чистая"

echo "ALL E2E PASSED"
