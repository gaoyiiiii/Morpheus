#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
LABEL="me.jueji.tailscale.userspace"
PLIST_FILE="$PLIST_DIR/$LABEL.plist"
LOG_OUT="$ROOT_DIR/data/tailscale-userspace.launchd.out.log"
LOG_ERR="$ROOT_DIR/data/tailscale-userspace.launchd.err.log"
TAILSCALED_BIN="${TAILSCALED_BIN:-/opt/homebrew/opt/tailscale/bin/tailscaled}"
STATE_DIR="$HOME/.local/share/tailscale"
SOCKET_PATH="$STATE_DIR/tailscaled.sock"

if [[ ! -x "$TAILSCALED_BIN" ]]; then
  echo "[install] tailscaled not found: $TAILSCALED_BIN"
  exit 1
fi

mkdir -p "$PLIST_DIR" "$ROOT_DIR/data" "$STATE_DIR"

cat >"$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$TAILSCALED_BIN</string>
    <string>--socket=$SOCKET_PATH</string>
    <string>--state=$STATE_DIR/tailscaled.state</string>
    <string>--statedir=$STATE_DIR</string>
    <string>--tun=userspace-networking</string>
    <string>--socks5-server=localhost:1055</string>
    <string>--outbound-http-proxy-listen=localhost:1055</string>
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
echo "[install] socket: $SOCKET_PATH"
echo "[install] logs: $LOG_OUT / $LOG_ERR"
