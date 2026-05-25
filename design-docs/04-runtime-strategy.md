# 04 — Runtime strategy

**Status as of 2026-05-25.** The Yaegi-WASM-in-Worker primary path
drives every Go freeform + fill-line exercise across all 7 modules.
The vendored stdlib has grown beyond the launch subset — `sync`,
`time`, and `context` were added 2026-05-21, unlocking Module 6
(Concurrency) and Module 7.3 (idioms/context). The matrix outcome
lives in [04a-runtime-matrix.md](04a-runtime-matrix.md); the
ongoing gap tracker lives in [30](30-yaegi-upstream-tracker-2026-05-21.md).
The server-compile pipeline is no longer parked — it shipped 2026-05-24
for the Rust track and is the only path that uses `runtime: "server"`
today; see [32](32-compile-service-architecture-2026-05-24.md) for the
language-agnostic shape and Rust-specific implementation. Go's hard-edge
exercises (`defer` arg-capture semantics, generic-stdlib funcs) still
use Yaegi-friendly workarounds (`alternateCanonicals`, MCQ-instead-of-fill-line
for unfixable cases) rather than routing to the server — see
design-docs/30 for the per-gap workarounds in shipped content.

## The question

Four exercise types (recognition, tile fill-in, constrained write, open
problem). Only two of them require *executing* Go code. How do we run that
Go safely, fast, and at zero per-request cost?

## The answer: tiered runtime

| Exercise type | Runtime |
|---|---|
| Recognition (MCQ) | None — ID match |
| Tile fill-in | None — tile-position match |
| Constrained write | None — gofmt-normalised compare, optionally AST diff |
| Open problem | **Yaegi WASM in Web Worker** (primary) → server compile (fallback) |

Only the last category needs a real Go runtime, and even there, *most*
exercises will run on Yaegi alone.

## Yaegi — the primary runtime

[Yaegi](https://github.com/traefik/yaegi) is a pure-Go interpreter
maintained by Traefik. It's written in Go, has no native dependencies, and
compiles cleanly to WASM via the standard Go toolchain.

**Architecture:**

```
┌─────────────────────────────────────┐
│  Main thread                        │
│                                     │
│   CodeMirror ── code ──┐            │
│                        │            │
│   Comlink API ─────────┘            │
│   ▲                                 │
│   │                                 │
│   ▼                                 │
│   Web Worker                        │
│   ├── yaegi.wasm                    │
│   ├── stdout/stderr capture         │
│   └── eval(code) → { result, logs } │
└─────────────────────────────────────┘
```

**Why a worker:** a learner's `for {}` loop must not freeze the tab. The
worker is isolatable, killable, and can be hard-reset between exercises.

**Why Comlink:** turns the worker's `postMessage` dance into a typed promise
API. The lesson UI gets `await runner.eval(code)`.

## Yaegi limitations to plan around

Yaegi added generics support in v0.14.0 (2022), but as of mid-2026 there
are open issues (yaegi#1700, #1704) for:

- Generic constraint interfaces returning nil-typed values
- Generic stdlib functions (`slices.Sort`, `maps.Keys`, etc.) failing
- Lag behind latest Go SDK releases

**Implication:** any exercise that uses generics-heavy stdlib or modern
generic patterns must go through the fallback path. We tag exercises with
a `runtime: "yaegi" | "server"` field in their frontmatter; the loader
picks the right runtime.

## Fallback: server compile

**Shipped 2026-05-24 — for Rust, not Go.** When an exercise's
`runtime` is `"server"`, the worker is bypassed and the code routes
through the language-agnostic compile-service pipeline documented in
[32](32-compile-service-architecture-2026-05-24.md). The pipeline:

1. Service-worker intercept hashes a normalized source.
2. L1 (static CDN) → L2 (Vercel Blob, deferred today) → L3 (Vercel
   Sandbox, Firecracker microVM).
3. Function returns wasm bytes; browser instantiates via
   `bjorn3/browser_wasi_shim` and captures stdout/stderr.

For Go specifically, the server fallback is **available but unused
in shipped content** — every Go exercise we ship today runs cleanly
on Yaegi (with `alternateCanonicals` covering the
`slices.Sort` / range-over-int / loop-var-1.22 gaps from
design-docs/30). If a future Go exercise genuinely cannot avoid a
Yaegi gap, the path to wire it through the same compile-service is
one `LANGUAGE_REGISTRY` entry + `/api/compile/go.ts` route + a Docker
or Sandbox transport that runs `go build -target wasm32-wasip1`. The
heavy lifting (SW cache, L1/L2/L3 cascade, source normaliser, hash
function, registration) is already in place.

## Not chosen: full gc in WASM

The official Go compiler can itself be compiled to WASM
([progrium/wasm-go-playground](https://github.com/progrium/wasm-go-playground)),
giving 100% correctness in the browser. Rejected as the *primary* runtime
because the blob is ~50 MB, which:

- Eats a noticeable chunk of Vercel's free-tier bandwidth (every cold visit)
- Adds significant first-load delay even with aggressive caching
- Is overkill for the 90% of exercises Yaegi handles fine

We'll revisit if Yaegi's generics gaps don't get fixed and the server path
becomes hot enough to justify offloading to the client.

## Validation plan

*Completed 2026-05-19.* The half-day POC ran, results live in
[04a-runtime-matrix.md](04a-runtime-matrix.md):

- Yaegi compiles to WASM cleanly via the standard Go toolchain;
  vendoring a minimal stdlib subset (`fmt`, `strings`, `strconv`,
  `errors`, `math`, `sort`, `slices`, `maps`) brings the bundle
  from ~40 MB raw to ~11 MB raw / ~1.9 MB brotli.
- The 20-snippet candidate matrix is in 04a; pass rate cleared the
  ≥80% bar for Module 1's exercise set. Generic stdlib funcs
  (`slices.Sort` / `Min` / `Max`) and `defer` arg-capture semantics
  are the documented Yaegi gaps — those exercises route via the
  not-yet-built server-fallback path (Modules 6-7 only; not
  blocking launch).
- Architecture locked in: `runtime/yaegi-wasm/` compiles the
  bundle, `src/runtime/index.ts` runs it in a Web Worker via
  Comlink, `useYaegiRun` is the per-component lifecycle hook
  consumed by Freeform and FillBlankLineInput.
