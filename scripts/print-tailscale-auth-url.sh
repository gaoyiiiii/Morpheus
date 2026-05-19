#!/usr/bin/env bash
set -euo pipefail

SOCKET_PATH="${TAILSCALE_SOCKET:-$HOME/.local/share/tailscale/tailscaled.sock}"
TAILSCALE_BIN="${TAILSCALE_BIN:-/opt/homebrew/bin/tailscale}"

if [[ ! -x "$TAILSCALE_BIN" ]]; then
  echo "[tailscale] cli not found: $TAILSCALE_BIN"
  exit 1
fi

"$TAILSCALE_BIN" --socket="$SOCKET_PATH" up >/tmp/tailscale-up.out 2>&1 || true
cat /tmp/tailscale-up.out
