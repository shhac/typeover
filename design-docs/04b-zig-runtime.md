# 04b — Zig runtime

**Status:** shipped 2026-05-22. The real Zig compiler (`zig.wasm`,
self-hosted Zig built for `wasm32-wasi`) runs in a Web Worker and
grades the Zig track's fill-line / freeform exercises. Foundational
sibling to [04-runtime-strategy.md](04-runtime-strategy.md) (Yaegi
for Go) and [04a-runtime-matrix.md](04a-runtime-matrix.md) (Yaegi
POC outcome).

## The question

We wanted a Zig track with the same in-browser, no-backend grading
shape as the Go track. Yaegi-the-Go-interpreter has no Zig
equivalent — there's no embeddable Zig source interpreter — so the
choice was: ship the *actual compiler* in the browser, ship code
without execution, or skip Zig.

Decision: ship the actual compiler. The Zig self-hosted compiler
already targets `wasm32-wasi` and the [zigtools/playground](https://github.com/zigtools/playground)
project demonstrates a working browser-side compile + run flow.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Main thread                                │
│                                             │
│   CodeMirror ── code ──┐                    │
│                        │                    │
│   Comlink API ─────────┘                    │
│   ▲                                         │
│   │                                         │
│   ▼                                         │
│   Web Worker (zig-worker.ts)                │
│   ┌───────────────────────────────────────┐ │
│   │ Stage 1 — compile                     │ │
│   │   WASI context A → zig.wasm           │ │
│   │   preopens:                           │ │
│   │     ./             → main.zig +       │ │
│   │                      libcompiler_rt.a │ │
│   │     /lib           → stdlib (in-mem)  │ │
│   │     /cache         → empty            │ │
│   │   stdout/stderr captured              │ │
│   │   → ArrayBuffer of main.wasm          │ │
│   └───────────────────────────────────────┘ │
│   ┌───────────────────────────────────────┐ │
│   │ Stage 2 — run                         │ │
│   │   WASI context B → main.wasm          │ │
│   │   fresh memory + fd table             │ │
│   │   stdout/stderr captured              │ │
│   │   → { stdout, stderr, error }         │ │
│   └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

Two nested WASI contexts in one worker (vs zigtools' two
separate workers). Rationale: the typing-exercise host owns the
worker lifecycle via `terminateZigRunner()`; if the learner's
code hangs, the whole worker dies and a fresh one boots. Simpler
than a two-worker dance for our single-shot, run-on-submit model.

The WASI shim is [@bjorn3/browser_wasi_shim](https://www.npmjs.com/package/@bjorn3/browser_wasi_shim)
— pure-JS, no `SharedArrayBuffer` required. The stdlib is
mounted via `PreopenDirectory("/lib", …)` from an in-memory
`Directory` tree built from an untarred `zig-stdlib.tar.gz`.

## Assets

Built by `runtime/zig-wasm/build.sh` (clones zigtools/playground
at a pinned commit, runs `zig build --release=small`), staged
under `public/zig/`:

| File | Raw | Brotli q11 | Loaded when |
|---|---:|---:|---|
| `zig.wasm` (compiler, ReleaseSmall) | 3.95 MB | 905 KB | `getZigRunner().ready()` — page load on `/zig/*` |
| `libcompiler_rt.a` | 169 KB | 56 KB | First `eval()` — manually linked because the self-hosted wasm backend can't compile compiler_rt itself |
| `zig-stdlib.tar.gz` | 3.5 MB gzip / 2.4 MB brotli (raw tar) | — | First `eval()` — ~18 MB raw, ~669 files |
| **Total on the wire** | | **~3.4 MB brotli** | (~900 KB initial + ~2.5 MB deferred) |

The split-loading pattern is intentional. MCQ + fill-word
exercises on `/zig/*` never trigger `eval()`, so they only pay
the compiler-module download. The heavy stdlib bundle defers to
the first time a learner clicks Run on a fill-line / freeform.

For comparison, Yaegi is ~1.9 MB brotli all-in. Zig is roughly
2× heavier, which is fair given it's the whole compiler.

## Pinned dependencies

The build is reproducible because it pins:

- **`PLAYGROUND_COMMIT`** in `runtime/zig-wasm/build.sh` —
  `9f9403892077b7624b97b8c1cd0ca5504afebfe7` on `zigtools/playground@main`.
- Local **Zig 0.16.0** (homebrew on dev machine) drives the
  `zig build` invocation.
- zigtools/playground's `build.zig.zon` then fetches a **patched
  Zig fork** (`zigtools/zig` ref `wasm32-wasi`, commit
  `1c430bc...`) — that fork carries the small patch that enables
  `build-exe` + `sema` + `ast_gen` under the `wasm` dev env.

The build script's fallback path: if the local build fails for
any reason (Zig version drift, network outage on the package
fetch, etc.) it scrapes the live deployed assets from
`https://playground.zigtools.org/` instead. Vercel deploys ship
the staged files from `public/zig/`, so this fallback only
matters for local rebuilds.

## Known limitations

Re-probed 2026-05-22 against the patched compiler:

### 1. Self-hosted wasm backend is experimental

The zigtools playground itself flags it: "Zig's self-hosted
WebAssembly backend is still experimental." Some language
features that work under the LLVM backend may not under this one.
Mitigation: every fill-line / freeform canonical we author is
smoke-tested against the real compiler before shipping (see
`runtime/zig-wasm/smoke.mjs`).

### 2. API churn in `std.Io` / `std.process`

Zig's stdlib I/O surface had significant renames during the
0.15 → 0.16 transition. The shape the playground compiler
supports is:

```zig
pub fn main(init: std.process.Init) !void {
    try std.Io.File.stdout().writeStreamingAll(init.io, "hello\n");
}
```

Anything older (`std.debug.print(...)`, the no-arg `main`,
`std.io.getStdOut()`) may not link cleanly. The first authored
exercise (`zig/basics/hello-and-output/03`) anchors to the
working shape and the matching distractor calls out the
`std.debug.print` trap.

### 3. ZLS skipped

The zigtools playground also ships ZLS (the Zig Language Server)
for editor autocomplete + diagnostics. Our build explicitly
skips it (`zig build zig zig_compiler_rt zig_tarball
--release=small`, no `zls` target). Saves ~434 KB brotli on
every Zig-page load. Cost: no in-editor autocomplete, but the
typing-exercise UX doesn't need it — the canonical's there in
the hints when stuck.

A topical `32-zig-upstream-tracker-...` doc will spawn the first
time a real upstream gap blocks an exercise. Today the smoke
test passes both happy and compile-error cases cleanly, so
there's nothing to track yet.

## Validation

- **Smoke test** (`pnpm runtime:zig:smoke`) — Node-side compile +
  run using the same `@bjorn3/browser_wasi_shim` the browser
  worker uses. Currently 2/2 (hello-world + deliberate
  compile-error). Adding a canonical to the cases array
  verifies it end-to-end without spinning up a browser.
- **Browser e2e** — Playwright-driven walk through all three
  exercises in the first slice. Confirmed 2026-05-22:
  compile-and-run pipeline produces correct stdout, Submit
  grades correct.

## Files

- `runtime/zig-wasm/build.sh` — local build + prebuilt-asset fallback
- `runtime/zig-wasm/smoke.mjs` — Node-side verifier
- `src/runtime/zig-worker.ts` — Web Worker (Comlink-exposed)
- `src/runtime/index.ts` — `getZigRunner()` / `terminateZigRunner()`
- `public/zig/{zig.wasm, libcompiler_rt.a, zig-stdlib.tar.gz}` —
  staged artifacts (tracked, same convention as `public/yaegi/`)
