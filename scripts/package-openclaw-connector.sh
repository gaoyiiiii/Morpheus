#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT/integrations/openclaw/morph-core"
OUT_DIR="${1:-$ROOT/dist/openclaw/morph-core}"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -R "$SRC_DIR"/. "$OUT_DIR"/

echo "[openclaw:package] staged connector to $OUT_DIR"
