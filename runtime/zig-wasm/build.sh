#!/usr/bin/env bash
# Build the Zig → WASM blobs and stage them under public/zig/.
# Run from the repo root, OR from this directory — either works.
#
# Outputs (all regenerated each run):
#   public/zig/zig.wasm           — the Zig compiler, compiled to wasm32-wasi
#   public/zig/libcompiler_rt.a   — pre-built compiler-rt static archive
#                                   (manually linked because the self-hosted
#                                    wasm backend can't compile it itself)
#   public/zig/zig-stdlib.tar.gz  — the Zig stdlib tree, gzipped
#
# Approach:
#   1. Preferred path — local build using zigtools/playground at a pinned
#      commit. This depends on:
#        - `zig` >= 0.16.0 on PATH
#        - network access (Zig's package manager fetches the patched
#          zigtools/zig fork that enables build-exe under wasm32-wasi)
#        - `git` on PATH
#   2. Fallback path — fetch the live prebuilt assets from
#      playground.zigtools.org. The asset paths are content-hashed by
#      Vite, so we scrape them from the deployed index.html → main JS
#      chunk before each fallback fetch.
#
# Both paths produce the same three files. The compiler itself is the
# bulk of the payload (~3.3 MB raw / ~900 KB brotli); the stdlib tarball
# is fetched lazily by the worker on first eval, not at page load.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
OUT_DIR="$REPO_ROOT/public/zig"
CACHE_DIR="$HERE/.build-cache"

# Pinned zigtools/playground commit. Bump intentionally — the upstream
# pulls a patched Zig fork keyed off this commit, so jumping ahead
# may break against local Zig if their patch falls behind.
PLAYGROUND_REPO="https://github.com/zigtools/playground.git"
PLAYGROUND_COMMIT="9f9403892077b7624b97b8c1cd0ca5504afebfe7"

mkdir -p "$OUT_DIR"

build_local() {
  command -v zig >/dev/null 2>&1 || { echo "  (no \`zig\` on PATH)"; return 1; }
  command -v git >/dev/null 2>&1 || { echo "  (no \`git\` on PATH)"; return 1; }

  if [ -d "$CACHE_DIR/.git" ]; then
    echo "→ Updating playground checkout in $CACHE_DIR"
    git -C "$CACHE_DIR" fetch --depth 1 origin "$PLAYGROUND_COMMIT" || return 1
    git -C "$CACHE_DIR" checkout -q "$PLAYGROUND_COMMIT" || return 1
  else
    echo "→ Cloning zigtools/playground@$PLAYGROUND_COMMIT into $CACHE_DIR"
    rm -rf "$CACHE_DIR"
    git clone --depth 1 "$PLAYGROUND_REPO" "$CACHE_DIR" || return 1
    git -C "$CACHE_DIR" fetch --depth 1 origin "$PLAYGROUND_COMMIT" || return 1
    git -C "$CACHE_DIR" checkout -q "$PLAYGROUND_COMMIT" || return 1
  fi

  echo "→ Building zig.wasm + compiler_rt + stdlib tarball (local zig: $(zig version))"
  (
    cd "$CACHE_DIR"
    # Skip zls — it's only useful for the editor integration, not the
    # typing-exercise runtime. Naming the individual steps bypasses the
    # default `install` step (which depends on `zls`).
    zig build zig zig_compiler_rt zig_tarball --release=small
  ) || return 1

  cp "$CACHE_DIR/zig-out/bin/zig.wasm"      "$OUT_DIR/zig.wasm"
  cp "$CACHE_DIR/zig-out/libcompiler_rt.a"  "$OUT_DIR/libcompiler_rt.a"
  cp "$CACHE_DIR/zig-out/zig.tar.gz"        "$OUT_DIR/zig-stdlib.tar.gz"
}

PLAYGROUND_ORIGIN="https://playground.zigtools.org"

# Echo the first path matching $pattern in $haystack, or fail with a
# diagnostic referencing $label. Pulled out of fetch_prebuilt's
# four-times-near-identical inline grep+validate pairs — when
# Vite's chunk-naming or directory layout shifts upstream, the
# single helper definition is the only place that needs updating.
scrape_first_match() {
  local haystack="$1" pattern="$2" label="$3"
  local match
  match="$(printf '%s' "$haystack" | grep -oE "$pattern" | head -1)"
  if [ -z "$match" ]; then
    echo "  (could not locate $label in scraped content)"
    return 1
  fi
  printf '%s' "$match"
}

fetch_prebuilt() {
  echo "→ Fallback: fetching prebuilt assets from $PLAYGROUND_ORIGIN"
  command -v curl >/dev/null 2>&1 || { echo "  (no \`curl\` on PATH)"; return 1; }

  local index_html main_chunk main_js zig_chunk zig_js zig_wasm rt_a tar_gz

  index_html="$(curl -fsSL "$PLAYGROUND_ORIGIN/")" || return 1
  main_chunk="$(scrape_first_match "$index_html" '/assets/index-[A-Za-z0-9_-]+\.js' "main JS chunk")" || return 1

  # The main bundle imports the zig-worker chunk by name — scrape both
  # then probe the zig-worker chunk for the wasm/.a/.tar.gz paths.
  main_js="$(curl -fsSL "$PLAYGROUND_ORIGIN$main_chunk")" || return 1
  zig_chunk="$(scrape_first_match "$main_js" '/assets/zig-[A-Za-z0-9_-]+\.js' "zig worker chunk")" || return 1

  zig_js="$(curl -fsSL "$PLAYGROUND_ORIGIN$zig_chunk")" || return 1
  zig_wasm="$(scrape_first_match "$zig_js" '/assets/zig-[A-Za-z0-9_-]+\.wasm' "zig.wasm asset")" || return 1
  rt_a="$(scrape_first_match "$zig_js" '/assets/libcompiler_rt-[A-Za-z0-9_-]+\.a' "libcompiler_rt.a asset")" || return 1
  tar_gz="$(scrape_first_match "$zig_js" '/assets/zig\.tar-[A-Za-z0-9_-]+\.gz' "zig-stdlib.tar.gz asset")" || return 1

  echo "  zig.wasm           ← $zig_wasm"
  echo "  libcompiler_rt.a   ← $rt_a"
  echo "  zig-stdlib.tar.gz  ← $tar_gz"
  curl -fsSL "$PLAYGROUND_ORIGIN$zig_wasm" -o "$OUT_DIR/zig.wasm" || return 1
  curl -fsSL "$PLAYGROUND_ORIGIN$rt_a"     -o "$OUT_DIR/libcompiler_rt.a" || return 1
  curl -fsSL "$PLAYGROUND_ORIGIN$tar_gz"   -o "$OUT_DIR/zig-stdlib.tar.gz" || return 1
}

if build_local; then
  echo "→ Local build succeeded"
else
  echo "→ Local build failed; trying fallback"
  fetch_prebuilt || {
    echo "✗ Both local build and prebuilt fetch failed. Cannot stage Zig WASM assets." >&2
    exit 1
  }
fi

ZIG_SIZE=$(stat -f%z "$OUT_DIR/zig.wasm" 2>/dev/null || stat -c%s "$OUT_DIR/zig.wasm")
RT_SIZE=$(stat -f%z "$OUT_DIR/libcompiler_rt.a" 2>/dev/null || stat -c%s "$OUT_DIR/libcompiler_rt.a")
TAR_SIZE=$(stat -f%z "$OUT_DIR/zig-stdlib.tar.gz" 2>/dev/null || stat -c%s "$OUT_DIR/zig-stdlib.tar.gz")
TOTAL=$((ZIG_SIZE + RT_SIZE + TAR_SIZE))
echo "→ Done."
printf "    zig.wasm           %8d bytes\n" "$ZIG_SIZE"
printf "    libcompiler_rt.a   %8d bytes\n" "$RT_SIZE"
printf "    zig-stdlib.tar.gz  %8d bytes\n" "$TAR_SIZE"
printf "    total              %8d bytes (%d MB raw)\n" "$TOTAL" "$((TOTAL / 1024 / 1024))"
