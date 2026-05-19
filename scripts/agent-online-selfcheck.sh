#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${1:-http://127.0.0.1:2199}"
TMP_DIR="$(mktemp -d /tmp/morph_agent_selfcheck_XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[selfcheck] base=$BASE_URL"

HEALTH="$(curl -sS "$BASE_URL/api/health")"
echo "$HEALTH" | rg '"ok":true' >/dev/null
echo "[selfcheck] health ok"

UNSIGNED_CODE="$(curl -sS -o "$TMP_DIR/unauth.json" -w "%{http_code}" -X POST "$BASE_URL/api/agent/webhook" -H 'Content-Type: application/json' --data '{"at":"2026-03-09T00:00:00.000Z","summary":"selfcheck unsigned","findings":[]}')"
if [[ "$UNSIGNED_CODE" != "401" ]]; then
  echo "[selfcheck] expected unsigned=401, got=$UNSIGNED_CODE"
  cat "$TMP_DIR/unauth.json" || true
  exit 1
fi
echo "[selfcheck] unsigned rejected"

SECRET="$(node -e "const j=require('$ROOT_DIR/data/proactive-agent.config.json');process.stdout.write(String(j?.webhook?.secret||''));")"
if [[ -z "$SECRET" ]]; then
  echo "[selfcheck] empty webhook secret"
  exit 1
fi

SIGNED_CODE="$(curl -sS -o "$TMP_DIR/signed.json" -w "%{http_code}" -X POST "$BASE_URL/api/agent/webhook" -H 'Content-Type: application/json' -H "x-morph-agent-secret: $SECRET" --data '{"at":"2026-03-09T00:00:00.000Z","summary":"selfcheck signed","findings":[{"key":"selfcheck","severity":"low","summary":"ok"}]}')"
if [[ "$SIGNED_CODE" != "200" ]]; then
  echo "[selfcheck] expected signed=200, got=$SIGNED_CODE"
  cat "$TMP_DIR/signed.json" || true
  exit 1
fi
echo "[selfcheck] signed accepted"

EVENTS="$(curl -sS "$BASE_URL/api/agent/events?limit=5")"
echo "$EVENTS" | rg 'selfcheck signed' >/dev/null
echo "[selfcheck] event persisted"

STATUS="$(curl -sS "$BASE_URL/api/agent/status")"
echo "$STATUS" | rg '"ok":true' >/dev/null
echo "$STATUS" | rg '"webhookSecretConfigured":true' >/dev/null
echo "[selfcheck] status ok"

echo "[selfcheck] PASS"
