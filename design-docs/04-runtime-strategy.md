# 04 — Runtime strategy

**Status:** shipped. The Yaegi-WASM-in-Worker primary path is live —
vendored stdlib subset, ~11 MB raw / 1.9 MB brotli, drives every
freeform + fill-line exercise in Module 1. The POC matrix outcome
lives in [04a-runtime-matrix.md](04a-runtime-matrix.md). The
server-compile fallback is still parked (Modules 6-7 only); see
[99-open-questions.md](99-open-questions.md) for the proposed
deployable shape.

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

When an exercise's `runtime` is `"server"`, the worker is bypassed and the
code is `POST`ed to a serverless endpoint (Vercel function) that:

1. Writes the code to a tempdir.
2. Compiles + runs it with `go run`, with timeout and resource limits.
3. Captures stdout/stderr/exit code, returns them.

This is slow (~500ms) compared to Yaegi (~10ms), but it's only for the
~10% of exercises that need it, and it covers 100% of valid Go.

**Sandboxing the server path:** `firejail` or a small Docker container with
no network, read-only FS except `/tmp`, ulimit on CPU and memory. The
official Go Playground's sandbox is over-engineered for our needs; a
minimal `nsjail` config is enough.

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
