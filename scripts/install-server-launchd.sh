#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
LABEL="me.jueji.morph.server"
PLIST_FILE="$PLIST_DIR/$LABEL.plist"
LOG_OUT="$ROOT_DIR/data/morph-server.launchd.out.log"
LOG_ERR="$ROOT_DIR/data/morph-server.launchd.err.log"
NODE_BIN="$(command -v node || true)"
CONFIG_FILE="$ROOT_DIR/data/proactive-agent.config.json"
CODEX_REMOTE_CONFIG_FILE="$ROOT_DIR/data/codex-remote.config.json"
WEBHOOK_SECRET=""
SERVER_HOST="127.0.0.1"
SERVER_PORT="2199"
CODEX_REMOTE_ACCESS_TOKEN=""

if [[ -z "$NODE_BIN" ]]; then
  echo "[install] node not found in PATH"
  exit 1
fi

mkdir -p "$PLIST_DIR" "$ROOT_DIR/data"
if [[ -f "$CONFIG_FILE" ]]; then
  WEBHOOK_SECRET="$(node -e "try{const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j?.webhook?.secret||''));}catch(_){process.stdout.write('');}" "$CONFIG_FILE")"
fi
if [[ -f "$CODEX_REMOTE_CONFIG_FILE" ]]; then
  SERVER_HOST="$(node -e "try{const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j?.server?.host||'127.0.0.1'));}catch(_){process.stdout.write('127.0.0.1');}" "$CODEX_REMOTE_CONFIG_FILE")"
  SERVER_PORT="$(node -e "try{const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j?.server?.port||'2199'));}catch(_){process.stdout.write('2199');}" "$CODEX_REMOTE_CONFIG_FILE")"
  CODEX_REMOTE_ACCESS_TOKEN="$(node -e "try{const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j?.authToken||''));}catch(_){process.stdout.write('');}" "$CODEX_REMOTE_CONFIG_FILE")"
fi

cat >"$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$ROOT_DIR/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOST</key>
    <string>$SERVER_HOST</string>
    <key>PORT</key>
    <string>$SERVER_PORT</string>
    <key>MORPH_AGENT_WEBHOOK_SECRET</key>
    <string>$WEBHOOK_SECRET</string>
    <key>MORPH_CODEX_REMOTE_ACCESS_TOKEN</key>
    <string>$CODEX_REMOTE_ACCESS_TOKEN</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_OUT</string>
  <key>StandardErrorPath</key>
  <string>$LOG_ERR</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_FILE" >/dev/null 2>&1 || true
launchctl load "$PLIST_FILE"
launchctl kickstart -k "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
echo "[install] launchd loaded: $LABEL"
echo "[install] logs: $LOG_OUT / $LOG_ERR"
echo "[install] host: $SERVER_HOST  port: $SERVER_PORT"
if [[ -n "$CODEX_REMOTE_ACCESS_TOKEN" ]]; then
  echo "[install] codex remote token: configured"
else
  echo "[install] codex remote token: empty"
fi
