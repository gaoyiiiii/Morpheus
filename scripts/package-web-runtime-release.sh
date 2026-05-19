#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/web-runtime"
CACHE_DIR="$DIST_DIR/.cache"
STAMP="${MORPHEUS_RELEASE_STAMP:-$(date +%Y%m%d-%H%M%S)}"
NODE_VERSION="${MORPHEUS_NODE_VERSION:-$(node -p "process.versions.node")}"
TARGETS="${MORPHEUS_WEB_TARGETS:-macos-arm64 windows-x64}"
OUT_DIR="${MORPHEUS_RELEASE_OUT_DIR:-$DIST_DIR}"
PORT="${MORPHEUS_PORT:-2199}"
HOST="${MORPHEUS_HOST:-127.0.0.1}"

log() {
  printf '[morpheus:web-release] %s\n' "$*" >&2
}

fail() {
  printf '[morpheus:web-release] ERROR: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing '$1'"
}

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [[ -e "$src" ]]; then
    rsync -a --exclude='.DS_Store' "$src" "$dest"
  fi
}

prepare_common_payload() {
  local target_dir="$1"
  mkdir -p "$target_dir" "$target_dir/data" "$target_dir/scripts" "$target_dir/runtime"

  rsync -a --exclude='.DS_Store' \
    "$ROOT_DIR/morph.html" \
    "$ROOT_DIR/server.js" \
    "$ROOT_DIR/package.json" \
    "$ROOT_DIR/package-lock.json" \
    "$target_dir/"

  copy_if_exists "$ROOT_DIR/space-embed.html" "$target_dir/"
  rsync -a --exclude='.DS_Store' "$ROOT_DIR/assets" "$target_dir/"
  rsync -a --exclude='.DS_Store' "$ROOT_DIR/extensions" "$target_dir/"
  copy_if_exists "$ROOT_DIR/morph-runtime" "$target_dir/"
  rsync -a \
    --exclude='.DS_Store' \
    --exclude='contracts' \
    --exclude='legacy' \
    --exclude='writing' \
    "$ROOT_DIR/scripts/" "$target_dir/scripts/"

  (
    cd "$target_dir"
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  )

  rm -rf \
    "$target_dir/node_modules/.cache" \
    "$target_dir/node_modules"/**/.github 2>/dev/null || true

  touch "$target_dir/data/.keep"
}

write_readme() {
  local target_dir="$1"
  local target_label="$2"
  cat > "$target_dir/README-本地运行.txt" <<TXT
Morpheus Web Runtime Release ($target_label)

使用方式：
- macOS：双击 Morpheus.command。
- Windows：双击 Morpheus.bat。

启动后会自动打开：
http://127.0.0.1:$PORT/

说明：
- 这是 Web 应用本地运行包，不包含 macOS/iOS 工程，也不包含 Git 仓库。
- 包内自带 Node runtime，用户无需单独安装 Node.js。
- 包内不包含你的个人 data/live-data.json。
- 运行时会优先读取本机 iCloud / Documents 下已有的 Morph 数据。
- 如果 $PORT 已经有 Morpheus 服务在运行，启动脚本会直接打开已有页面，不会重复启动导致报错。
- 如需临时改端口，可在终端里设置 PORT 后再启动。
TXT
}

write_macos_launcher() {
  local target_dir="$1"
  cat > "$target_dir/Morpheus.command" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-2199}"
URL="http://127.0.0.1:${PORT}/"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
NODE_BIN="./runtime/node"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "[Morpheus] Missing runtime/node"
  read -r -p "Press Enter to close..."
  exit 1
fi

if "$NODE_BIN" -e "const http=require('http');const req=http.get(process.argv[1],res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(700,()=>{req.destroy();process.exit(1);});" "$HEALTH_URL" >/dev/null 2>&1; then
  echo "[Morpheus] Morpheus Web is already running at ${URL}"
  open "$URL" >/dev/null 2>&1 || true
  exit 0
fi

echo "[Morpheus] Starting Morpheus Web at ${URL}"
"$NODE_BIN" server.js &
SERVER_PID="$!"
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' INT TERM EXIT
for _ in $(seq 1 40); do
  if "$NODE_BIN" -e "const http=require('http');const req=http.get(process.argv[1],res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(700,()=>{req.destroy();process.exit(1);});" "$HEALTH_URL" >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
    echo "[Morpheus] Ready. Close this window to stop Morpheus Web."
    wait "$SERVER_PID"
    exit $?
  fi
  sleep 0.5
done
echo "[Morpheus] Server did not become ready. See messages above."
wait "$SERVER_PID"
SH
  chmod +x "$target_dir/Morpheus.command"
}

write_windows_launcher() {
  local target_dir="$1"
  cat > "$target_dir/Morpheus.bat" <<'BAT'
@echo off
setlocal
cd /d "%~dp0"

if "%HOST%"=="" set HOST=127.0.0.1
if "%PORT%"=="" set PORT=2199
set URL=http://127.0.0.1:%PORT%/
set HEALTH_URL=http://127.0.0.1:%PORT%/api/health
set NODE_BIN=%~dp0runtime\node.exe

if not exist "%NODE_BIN%" (
  echo [Morpheus] Missing runtime\node.exe
  pause
  exit /b 1
)

"%NODE_BIN%" -e "const http=require('http');const req=http.get(process.argv[1],res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(700,()=>{req.destroy();process.exit(1);});" "%HEALTH_URL%" >nul 2>nul
if not errorlevel 1 (
  echo [Morpheus] Morpheus Web is already running at %URL%
  start "" "%URL%"
  exit /b 0
)

echo [Morpheus] Starting Morpheus Web at %URL%
start "" /B "%NODE_BIN%" server.js
for /L %%i in (1,1,40) do (
  "%NODE_BIN%" -e "const http=require('http');const req=http.get(process.argv[1],res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(700,()=>{req.destroy();process.exit(1);});" "%HEALTH_URL%" >nul 2>nul
  if not errorlevel 1 (
    start "" "%URL%"
    echo [Morpheus] Ready. Close this window to stop Morpheus Web.
    pause
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)
echo [Morpheus] Server did not become ready. See messages above.
pause
BAT
}

package_zip() {
  local target_dir="$1"
  local zip_path="$2"
  rm -f "$zip_path"
  need_cmd zip
  (cd "$(dirname "$target_dir")" && zip -X -qr "$zip_path" "$(basename "$target_dir")")
}

write_macos_app_launcher() {
  local app_dir="$1"
  mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources"
  cat > "$app_dir/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>Morpheus</string>
  <key>CFBundleExecutable</key>
  <string>Morpheus</string>
  <key>CFBundleIdentifier</key>
  <string>io.morpheus.web</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Morpheus</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
</dict>
</plist>
PLIST
  cat > "$app_dir/Contents/MacOS/Morpheus" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PAYLOAD_DIR="$APP_DIR/Resources/app"
cd "$PAYLOAD_DIR"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-2199}"
URL="http://127.0.0.1:${PORT}/"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
NODE_BIN="./runtime/node"

if "$NODE_BIN" -e "const http=require('http');const req=http.get(process.argv[1],res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(700,()=>{req.destroy();process.exit(1);});" "$HEALTH_URL" >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
  exit 0
fi

"$NODE_BIN" server.js &
SERVER_PID="$!"
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' INT TERM EXIT
for _ in $(seq 1 40); do
  if "$NODE_BIN" -e "const http=require('http');const req=http.get(process.argv[1],res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(700,()=>{req.destroy();process.exit(1);});" "$HEALTH_URL" >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
    wait "$SERVER_PID"
    exit $?
  fi
  sleep 0.5
done
wait "$SERVER_PID"
SH
  chmod +x "$app_dir/Contents/MacOS/Morpheus"
}

package_macos_installers() {
  local target_dir="$1"
  local name="$2"
  local app_stage="$OUT_DIR/$name-app-stage"
  local pkg_stage="$OUT_DIR/$name-pkg-stage"
  local dmg_stage="$OUT_DIR/$name-dmg-stage"
  local app_dir="$app_stage/Morpheus.app"
  local pkg_path="$OUT_DIR/$name.pkg"
  local dmg_path="$OUT_DIR/$name.dmg"

  rm -rf "$app_stage" "$pkg_stage" "$dmg_stage" "$pkg_path" "$dmg_path"
  write_macos_app_launcher "$app_dir"
  rsync -a --exclude='.DS_Store' "$target_dir/" "$app_dir/Contents/Resources/app/"

  mkdir -p "$pkg_stage/Applications" "$dmg_stage"
  rsync -a --exclude='.DS_Store' "$app_dir" "$pkg_stage/Applications/"
  rsync -a --exclude='.DS_Store' "$app_dir" "$dmg_stage/"

  if command -v pkgbuild >/dev/null 2>&1; then
    pkgbuild \
      --root "$pkg_stage" \
      --identifier "io.morpheus.web" \
      --version "0.1.0" \
      --install-location "/" \
      "$pkg_path" >/dev/null
    log "macOS installer: $pkg_path"
  fi

  if command -v hdiutil >/dev/null 2>&1; then
    hdiutil create \
      -volname "Morpheus" \
      -srcfolder "$dmg_stage" \
      -ov \
      -format UDZO \
      "$dmg_path" >/dev/null
    log "macOS disk image: $dmg_path"
  fi
}

package_windows_installer() {
  local target_dir="$1"
  local name="$2"
  local nsi_path="$OUT_DIR/$name.nsi"
  local exe_path="$OUT_DIR/$name-Setup.exe"

  if ! command -v makensis >/dev/null 2>&1; then
    log "Windows installer skipped: makensis is not installed"
    return 0
  fi

  rm -f "$nsi_path" "$exe_path"
  cat > "$nsi_path" <<NSI
Unicode true
Name "Morpheus"
OutFile "$exe_path"
InstallDir "\$LOCALAPPDATA\\Morpheus"
RequestExecutionLevel user

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "\$INSTDIR"
  File /r "$target_dir/*"
  WriteUninstaller "\$INSTDIR\\Uninstall Morpheus.exe"
  CreateDirectory "\$SMPROGRAMS\\Morpheus"
  CreateShortCut "\$SMPROGRAMS\\Morpheus\\Morpheus.lnk" "\$INSTDIR\\Morpheus.bat"
  CreateShortCut "\$DESKTOP\\Morpheus.lnk" "\$INSTDIR\\Morpheus.bat"
SectionEnd

Section "Uninstall"
  Delete "\$DESKTOP\\Morpheus.lnk"
  Delete "\$SMPROGRAMS\\Morpheus\\Morpheus.lnk"
  RMDir "\$SMPROGRAMS\\Morpheus"
  RMDir /r "\$INSTDIR"
SectionEnd
NSI

  makensis "$nsi_path" >/dev/null
  rm -f "$nsi_path"
  log "Windows installer: $exe_path"
}

download_node_windows_x64() {
  local node_zip="$CACHE_DIR/node-v$NODE_VERSION-win-x64.zip"
  local node_dir="$CACHE_DIR/node-v$NODE_VERSION-win-x64"
  mkdir -p "$CACHE_DIR"
  if [[ ! -f "$node_zip" ]]; then
    log "downloading Node v$NODE_VERSION for Windows x64"
    rm -f "$node_zip"
    curl --retry 4 --retry-delay 2 --retry-all-errors -fL \
      "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-win-x64.zip" \
      -o "$node_zip"
  fi
  if [[ ! -f "$node_dir/node.exe" ]]; then
    rm -rf "$node_dir"
    unzip -q "$node_zip" -d "$CACHE_DIR" || {
      rm -f "$node_zip"
      fail "failed to unpack Windows Node runtime"
    }
  fi
  [[ -f "$node_dir/node.exe" ]] || fail "Windows node.exe not found after download"
  printf '%s\n' "$node_dir/node.exe"
}

build_macos_arm64() {
  local name="Morpheus-Web-Runtime-macos-arm64-$STAMP"
  local target_dir="$OUT_DIR/$name"
  local zip_path="$OUT_DIR/$name.zip"
  rm -rf "$target_dir"
  prepare_common_payload "$target_dir"
  cp "$(node -p "process.execPath")" "$target_dir/runtime/node"
  chmod +x "$target_dir/runtime/node"
  write_macos_launcher "$target_dir"
  write_readme "$target_dir" "macos-arm64"
  package_zip "$target_dir" "$zip_path"
  package_macos_installers "$target_dir" "$name"
  log "macOS package: $zip_path"
}

build_windows_x64() {
  local name="Morpheus-Web-Runtime-windows-x64-$STAMP"
  local target_dir="$OUT_DIR/$name"
  local zip_path="$OUT_DIR/$name.zip"
  local node_exe
  rm -rf "$target_dir"
  prepare_common_payload "$target_dir"
  node_exe="$(download_node_windows_x64)"
  cp "$node_exe" "$target_dir/runtime/node.exe"
  write_windows_launcher "$target_dir"
  write_readme "$target_dir" "windows-x64"
  package_zip "$target_dir" "$zip_path"
  package_windows_installer "$target_dir" "$name"
  log "Windows package: $zip_path"
}

need_cmd node
need_cmd npm
need_cmd rsync

mkdir -p "$DIST_DIR" "$CACHE_DIR" "$OUT_DIR"

log "building web assets"
(cd "$ROOT_DIR" && npm run build)

for target in $TARGETS; do
  case "$target" in
    macos-arm64) build_macos_arm64 ;;
    windows-x64) build_windows_x64 ;;
    *) fail "unsupported target: $target" ;;
  esac
done

log "done"
