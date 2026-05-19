#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/data/morph-owner-loop.config.json"
EXAMPLE_FILE="$ROOT_DIR/data/morph-owner-loop.config.example.json"
PLIST_DIR="$HOME/Library/LaunchAgents"
LABEL="me.jueji.morph.owner-loop"
PLIST_FILE="$PLIST_DIR/$LABEL.plist"
LOG_OUT="$ROOT_DIR/data/owner-loop.launchd.out.log"
LOG_ERR="$ROOT_DIR/data/owner-loop.launchd.err.log"
NODE_BIN="$(command -v node || true)"
CODEX_BIN="${MORPH_OWNER_LOOP_CODEX_BIN:-$(command -v codex || true)}"
CODEX_HOME_VALUE="${CODEX_HOME:-$HOME/.codex}"
PATH_VALUE="${PATH:-/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"

mkdir -p "$PLIST_DIR" "$ROOT_DIR/data"

if [[ ! -f "$CONFIG_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$CONFIG_FILE"
  echo "[install] created config: $CONFIG_FILE"
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "[install] node not found in PATH"
  exit 1
fi

if [[ -z "$CODEX_BIN" ]]; then
  echo "[install] codex not found in PATH"
  exit 1
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
    <string>$ROOT_DIR/scripts/morph-owner-loop.js</string>
    <string>--config</string>
    <string>$CONFIG_FILE</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MORPH_OWNER_LOOP_CODEX_BIN</key>
    <string>$CODEX_BIN</string>
    <key>HOME</key>
    <string>$HOME</string>
    <key>CODEX_HOME</key>
    <string>$CODEX_HOME_VALUE</string>
    <key>PATH</key>
    <string>$PATH_VALUE</string>
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
echo "[install] config: $CONFIG_FILE"
echo "[install] codex: $CODEX_BIN"
echo "[install] logs: $LOG_OUT / $LOG_ERR"
