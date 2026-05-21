#!/usr/bin/env bash
# Build the Yaegi → WASM blob and stage it under public/yaegi/.
# Run from the repo root, OR from this directory — either works.
#
# Output (both regenerated each run):
#   public/yaegi/yaegi.wasm    — the compiled interpreter blob
#   public/yaegi/wasm_exec.js  — Go's bootstrap shim (copied from GOROOT)
#
# Both are gitignored. Vercel + local dev run this as a pre-build step.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
OUT_DIR="$REPO_ROOT/public/yaegi"

mkdir -p "$OUT_DIR"

cd "$HERE"

echo "→ Building yaegi.wasm (minimal stdlib: fmt strings strconv errors math sort slices maps sync time)"
GOOS=js GOARCH=wasm go build \
  -ldflags="-s -w" \
  -trimpath \
  -o "$OUT_DIR/yaegi.wasm" \
  .

echo "→ Copying wasm_exec.js from \$GOROOT"
GOROOT="$(go env GOROOT)"
cp "$GOROOT/lib/wasm/wasm_exec.js" "$OUT_DIR/wasm_exec.js"

SIZE=$(stat -f%z "$OUT_DIR/yaegi.wasm" 2>/dev/null || stat -c%s "$OUT_DIR/yaegi.wasm")
echo "→ Done. yaegi.wasm = $((SIZE / 1024 / 1024)) MB raw"
