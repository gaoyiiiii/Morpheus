#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${MORPHEUS_REPO_URL:-https://github.com/gaoyiiiii/morph.git}"
BRANCH="${MORPHEUS_BRANCH:-main}"
INSTALL_DIR="${MORPHEUS_INSTALL_DIR:-$HOME/Morpheus}"
PORT="${MORPHEUS_PORT:-2199}"
HOST="${MORPHEUS_HOST:-127.0.0.1}"
APP_URL="http://127.0.0.1:$PORT/"

log() {
  printf '[morpheus:install] %s\n' "$*"
}

fail() {
  printf '[morpheus:install] ERROR: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing '$1'. Please install it first, then rerun this command."
}

is_morpheus_repo() {
  [[ -f "$1/package.json" && -f "$1/server.js" && -f "$1/morph.html" && -d "$1/scripts" ]]
}

wait_for_health() {
  local url="http://127.0.0.1:$PORT/api/health"
  local attempt
  for attempt in $(seq 1 40); do
    if node -e "const http=require('http');const req=http.get(process.argv[1],res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(900,()=>{req.destroy();process.exit(1);});" "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

open_url() {
  if command -v open >/dev/null 2>&1; then
    open "$APP_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL" >/dev/null 2>&1 || true
  else
    log "open this URL manually: $APP_URL"
  fi
}

need_cmd git
need_cmd node
need_cmd npm

if is_morpheus_repo "$PWD"; then
  ROOT_DIR="$PWD"
  log "using current checkout: $ROOT_DIR"
else
  ROOT_DIR="$INSTALL_DIR"
  if [[ -e "$ROOT_DIR" && ! -d "$ROOT_DIR/.git" ]]; then
    fail "$ROOT_DIR already exists but is not a git checkout. Set MORPHEUS_INSTALL_DIR to another path."
  fi
  if [[ -d "$ROOT_DIR/.git" ]]; then
    log "updating existing checkout: $ROOT_DIR"
    git -C "$ROOT_DIR" fetch --quiet origin "$BRANCH"
    git -C "$ROOT_DIR" checkout --quiet "$BRANCH"
    git -C "$ROOT_DIR" pull --ff-only --quiet origin "$BRANCH"
  else
    log "cloning $REPO_URL#$BRANCH into $ROOT_DIR"
    git clone --quiet --branch "$BRANCH" "$REPO_URL" "$ROOT_DIR"
  fi
fi

is_morpheus_repo "$ROOT_DIR" || fail "$ROOT_DIR does not look like a Morpheus checkout."

cd "$ROOT_DIR"

log "installing dependencies"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "building web assets"
npm run build

if [[ "$(uname -s)" == "Darwin" ]]; then
  log "installing macOS launchd server on $HOST:$PORT"
  HOST="$HOST" PORT="$PORT" npm run server:install:launchd
else
  mkdir -p data
  log "starting foreground-compatible local server on $HOST:$PORT"
  HOST="$HOST" PORT="$PORT" nohup npm start >data/morph-server.local.out.log 2>data/morph-server.local.err.log &
fi

if wait_for_health; then
  log "server is ready: $APP_URL"
  open_url
  log "done"
else
  fail "server did not become ready at $APP_URL. Check data/morph-server.launchd.err.log or data/morph-server.local.err.log."
fi
