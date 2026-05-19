#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${MORPHEUS_REPO_URL:-https://github.com/gaoyiiiii/Morpheus.git}"
APP_DIR="${MORPHEUS_HOME:-$HOME/Morpheus}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-2199}"
LOG_DIR="$APP_DIR/.morpheus"
LOG_FILE="$LOG_DIR/server.log"
PID_FILE="$LOG_DIR/server.pid"

say() {
  printf '%s\n' "$*"
}

fail() {
  say "Morpheus setup failed: $*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing '$1'. Please install it and run this command again."
}

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
    return
  fi
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
    return
  fi
  if command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /C start "$url" >/dev/null 2>&1 || true
    return
  fi
  say "Open this URL in your browser: $url"
}

wait_for_server() {
  local url="$1"
  local deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

is_running() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

need_command git
need_command node
need_command npm
need_command curl

say "Preparing Morpheus Web client..."

if [[ -d "$APP_DIR/.git" ]]; then
  current_remote="$(git -C "$APP_DIR" remote get-url origin 2>/dev/null || true)"
  [[ "$current_remote" == "$REPO_URL" ]] || fail "$APP_DIR already exists and is not the Morpheus repository. Set MORPHEUS_HOME to another directory."
  git -C "$APP_DIR" pull --ff-only
elif [[ -e "$APP_DIR" ]]; then
  fail "$APP_DIR already exists. Move it away or set MORPHEUS_HOME to another directory."
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
mkdir -p "$LOG_DIR"

say "Installing dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

say "Building Morpheus..."
npm run build

url="http://$HOST:$PORT/"

if [[ -f "$PID_FILE" ]] && is_running "$(cat "$PID_FILE" 2>/dev/null)"; then
  say "Morpheus is already running."
else
  say "Starting Morpheus at $url ..."
  nohup env HOST="$HOST" PORT="$PORT" npm start >"$LOG_FILE" 2>&1 &
  printf '%s\n' "$!" > "$PID_FILE"
fi

if wait_for_server "$url"; then
  say "Morpheus is ready: $url"
  open_url "$url"
else
  fail "server did not become ready. See log: $LOG_FILE"
fi
