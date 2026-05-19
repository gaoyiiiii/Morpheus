#!/usr/bin/env bash
set -euo pipefail

LABEL="me.jueji.morph.owner-loop-status"
PLIST_FILE="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl unload "$PLIST_FILE" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST_FILE"
echo "[uninstall] launchd removed: $LABEL"
