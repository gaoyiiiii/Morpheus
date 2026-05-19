#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_DIR="$ROOT_DIR/macos-app"
DIST_DIR="$ROOT_DIR/dist"
APP_NAME="Morpheus"
EXECUTABLE_NAME="Morph"
APP_DIR="$DIST_DIR/${APP_NAME}.app"
APP_CONTENTS="$APP_DIR/Contents"
WEB_ROOT="$APP_CONTENTS/Resources/www"
BUILD_BIN="$MACOS_DIR/.build/release/$EXECUTABLE_NAME"
RUNTIME_DIR="$APP_CONTENTS/Resources/runtime"

STAMP="$(date +%Y%m%d-%H%M%S)"
DMG_PATH="$DIST_DIR/Morpheus-macOS-${STAMP}.dmg"
TMP_DMG_DIR="$(mktemp -d "$DIST_DIR/.morph-dmg.XXXXXX")"
ICONSET_DIR="$DIST_DIR/AppIcon.iconset"
ROUNDED_ICON_1024="$DIST_DIR/app-icon-1024-rounded.png"
ROUNDED_ICON_512="$DIST_DIR/app-icon-512.png"

cleanup() {
  rm -rf "$TMP_DMG_DIR"
}
trap cleanup EXIT

echo "[1/7] Building web assets..."
(cd "$ROOT_DIR" && npm run build)

echo "[2/7] Building release binary..."
pushd "$MACOS_DIR" >/dev/null
swift build -c release
popd >/dev/null

if [[ ! -f "$BUILD_BIN" && -f "$MACOS_DIR/.build/release/Morphe" ]]; then
  BUILD_BIN="$MACOS_DIR/.build/release/Morphe"
fi
if [[ ! -f "$BUILD_BIN" && -f "$MACOS_DIR/.build/release/Morpheus" ]]; then
  BUILD_BIN="$MACOS_DIR/.build/release/Morpheus"
fi
if [[ ! -f "$BUILD_BIN" ]]; then
  echo "Release binary not found: $BUILD_BIN" >&2
  exit 1
fi

echo "[3/7] Preparing rounded icon assets..."
ICON_SOURCE=""
for candidate in \
  "$ROOT_DIR/lian_icon.png" \
  "$DIST_DIR/app-icon-1024.png" \
  "$DIST_DIR/app-icon-512.png"
do
  if [[ -f "$candidate" ]]; then
    ICON_SOURCE="$candidate"
    break
  fi
done
if [[ -z "$ICON_SOURCE" ]]; then
  echo "Icon source not found. Expected one of: lian_icon.png / dist/app-icon-1024.png / dist/app-icon-512.png" >&2
  exit 1
fi

python3 - "$ICON_SOURCE" "$ROUNDED_ICON_1024" "$ICONSET_DIR" <<'PY'
import os
import sys
from PIL import Image, ImageDraw

src = sys.argv[1]
out_1024 = sys.argv[2]
iconset_dir = sys.argv[3]

img = Image.open(src).convert("RGBA")
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side)).resize((1024, 1024), Image.Resampling.LANCZOS)

# Keep an explicit alpha mask so the icon stays rounded on all target Macs.
radius = 230
mask = Image.new("L", (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
draw.rounded_rectangle((0, 0, 1023, 1023), radius=radius, fill=255)
img.putalpha(mask)

os.makedirs(os.path.dirname(out_1024), exist_ok=True)
img.save(out_1024, "PNG")

if os.path.isdir(iconset_dir):
    for name in os.listdir(iconset_dir):
        os.remove(os.path.join(iconset_dir, name))
else:
    os.makedirs(iconset_dir, exist_ok=True)

entries = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

for filename, size in entries:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(iconset_dir, filename), "PNG")
PY

iconutil -c icns "$ICONSET_DIR" -o "$DIST_DIR/AppIcon.icns"
cp "$ICONSET_DIR/icon_512x512.png" "$ROUNDED_ICON_512"

echo "[4/7] Assembling app bundle..."
rm -rf "$APP_DIR"
mkdir -p "$APP_CONTENTS/MacOS" "$APP_CONTENTS/Resources" "$WEB_ROOT" "$RUNTIME_DIR"

cp "$BUILD_BIN" "$APP_CONTENTS/MacOS/$EXECUTABLE_NAME"
chmod +x "$APP_CONTENTS/MacOS/$EXECUTABLE_NAME"
cp "$MACOS_DIR/Sources/MorphDesktop/Info.plist" "$APP_CONTENTS/Info.plist"

if [[ -f "$DIST_DIR/AppIcon.icns" ]]; then
  cp "$DIST_DIR/AppIcon.icns" "$APP_CONTENTS/Resources/AppIcon.icns"
fi
if [[ -f "$DIST_DIR/app-icon-512.png" ]]; then
  cp "$DIST_DIR/app-icon-512.png" "$APP_CONTENTS/Resources/AppIcon.png"
fi

echo "[5/7] Embedding protected web runtime..."
cp "$(node -p "process.execPath")" "$RUNTIME_DIR/node"
chmod +x "$RUNTIME_DIR/node"

rsync -a --delete --exclude='.DS_Store' "$ROOT_DIR/assets" "$WEB_ROOT/"
rsync -a --delete --exclude='.DS_Store' "$ROOT_DIR/extensions" "$WEB_ROOT/"
mkdir -p "$WEB_ROOT/scripts"
cp "$ROOT_DIR/morph.html" "$WEB_ROOT/morph.html"
if [[ -f "$ROOT_DIR/space-embed.html" ]]; then
  cp "$ROOT_DIR/space-embed.html" "$WEB_ROOT/space-embed.html"
fi
cp "$ROOT_DIR/scripts/sync-markdown.js" "$WEB_ROOT/scripts/sync-markdown.js"
cp "$ROOT_DIR/scripts/import-markdown.js" "$WEB_ROOT/scripts/import-markdown.js"
cp "$ROOT_DIR/scripts/markdown-mirror-lib.js" "$WEB_ROOT/scripts/markdown-mirror-lib.js"

node - "$ROOT_DIR" "$WEB_ROOT" <<'NODE'
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = process.argv[2];
const webRoot = process.argv[3];
const excludedExtensionIds = new Set([
  'atlas',
  'codex-remote-plugin',
  'example-plugin',
  'jcring-plugin',
  'pomodoro-plugin',
  'sop-plugin',
  'visual-organizer-plugin',
  'wechat-article-formatter',
]);
const excludedExtensionDirs = [
  'atlas',
  'codex-remote-plugin',
  'example-plugin',
  'jcring-plugin',
  'pomodoro-plugin',
  'sop-plugin',
  'visual-organizer-plugin',
  'wechat-article-formatter',
  'local-packages',
];
const excludedAssetFiles = [
  'atlas-plugin-runtime.js',
  'codex-remote-bootstrap-runtime.js',
  'sop-codec-runtime.js',
  'wechat-article-formatter-runtime.js',
  'local-plugin-codex-remote-runtime.js',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

function minifyStaticJS(file) {
  const source = fs.readFileSync(file, 'utf8');
  const result = esbuild.transformSync(source, {
    loader: 'js',
    target: 'es2020',
    minifyWhitespace: true,
    minifySyntax: true,
    legalComments: 'none',
  });
  fs.writeFileSync(file, result.code, 'utf8');
}

function removePath(abs) {
  try {
    fs.rmSync(abs, { recursive: true, force: true });
  } catch (error) {
    throw new Error(`Failed to remove ${abs}: ${error.message}`);
  }
}

function sanitizeManifestFile(file) {
  if (!fs.existsSync(file)) return;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(parsed.extensions)) {
    parsed.extensions = parsed.extensions.filter((item) => {
      const id = String(item && item.id || '').trim();
      const entry = String(item && item.entry || '').trim();
      if (excludedExtensionIds.has(id)) return false;
      return !Array.from(excludedExtensionIds).some((excluded) => entry.includes(`extensions/${excluded}/`) || entry.includes(`extensions/${excluded}`));
    });
  }
  if (Array.isArray(parsed.plugins)) {
    parsed.plugins = parsed.plugins.filter((item) => !excludedExtensionIds.has(String(item && item.id || '').trim()));
  }
  parsed.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

for (const dir of excludedExtensionDirs) {
  removePath(path.join(webRoot, 'extensions', dir));
}
for (const file of excludedAssetFiles) {
  removePath(path.join(webRoot, 'assets', 'js', file));
}
for (const file of [
  path.join(webRoot, 'extensions', 'manifest.json'),
  path.join(webRoot, 'extensions', 'local-manifest.json'),
  path.join(webRoot, 'extensions', 'local-packages', 'optional-plugins.catalog.json'),
]) {
  sanitizeManifestFile(file);
}

for (const file of walk(path.join(webRoot, 'assets'))) {
  if (file.endsWith('.js')) minifyStaticJS(file);
  if (file.endsWith('.css')) {
    const source = fs.readFileSync(file, 'utf8');
    const result = esbuild.transformSync(source, {
      loader: 'css',
      minify: true,
      legalComments: 'none',
    });
    fs.writeFileSync(file, result.code, 'utf8');
  }
}

for (const file of walk(path.join(webRoot, 'extensions'))) {
  if (file.endsWith('.js')) minifyStaticJS(file);
}
for (const file of walk(path.join(webRoot, 'scripts'))) {
  if (file.endsWith('.js')) minifyStaticJS(file);
}

const serverBundle = esbuild.buildSync({
  entryPoints: [path.join(root, 'server.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  minify: true,
  legalComments: 'none',
  external: ['@larksuiteoapi/node-sdk'],
  outfile: path.join(webRoot, 'server.js'),
});

for (const file of ['morph.html', 'space-embed.html']) {
  const abs = path.join(webRoot, file);
  if (!fs.existsSync(abs)) continue;
  const source = fs.readFileSync(abs, 'utf8');
  const withoutExcludedRuntimeScripts = source
    .replace(/^\s*<script[^>]+src=["'][^"']*(?:atlas-plugin-runtime|wechat-article-formatter-runtime|local-plugin-codex-remote-runtime|codex-remote-bootstrap-runtime|sop-codec-runtime)\.js[^"']*["'][^>]*><\/script>\s*$/gm, '');
  const withDistributionFlag = withoutExcludedRuntimeScripts.replace(
    /<\/head>/i,
    '<script>window.__MORPH_DISTRIBUTION_PROFILE="public";window.__MORPH_PUBLIC_DISTRIBUTION__=true;</script>\n</head>'
  );
  const withoutComments = withDistributionFlag.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
  const compact = withoutComments
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
  fs.writeFileSync(abs, compact, 'utf8');
}
NODE

echo "[6/7] Codesigning app (ad-hoc)..."
codesign --force --deep --sign - "$APP_DIR" >/dev/null

echo "[7/7] Creating dmg..."
mkdir -p "$TMP_DMG_DIR"
cp -R "$APP_DIR" "$TMP_DMG_DIR/"
hdiutil create -volname "Morpheus" -srcfolder "$TMP_DMG_DIR" -ov -format UDZO "$DMG_PATH" >/dev/null

echo
echo "App bundle: $APP_DIR"
echo "DMG: $DMG_PATH"
