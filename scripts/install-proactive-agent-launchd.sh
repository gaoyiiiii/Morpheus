#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/data/proactive-agent.config.json"
EXAMPLE_FILE="$ROOT_DIR/data/proactive-agent.config.example.json"
PLIST_DIR="$HOME/Library/LaunchAgents"
LABEL="me.jueji.morph.proactive-agent"
PLIST_FILE="$PLIST_DIR/$LABEL.plist"
LOG_OUT="$ROOT_DIR/data/proactive-agent.launchd.out.log"
LOG_ERR="$ROOT_DIR/data/proactive-agent.launchd.err.log"

mkdir -p "$PLIST_DIR"
mkdir -p "$ROOT_DIR/data"

if [[ ! -f "$CONFIG_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$CONFIG_FILE"
  echo "[install] created config: $CONFIG_FILE"
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "[install] node not found in PATH"
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
    <string>$ROOT_DIR/scripts/proactive-agent-worker.js</string>
    <string>--config</string>
    <string>$CONFIG_FILE</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
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
echo "[install] logs: $LOG_OUT / $LOG_ERR"
