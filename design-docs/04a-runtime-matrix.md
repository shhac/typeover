# 04a — Runtime matrix (Yaegi POC results)

The "20-snippet matrix" called out in
[04-runtime-strategy.md](04-runtime-strategy.md) under "Validation
plan." Determines which Go features stay on the in-browser Yaegi
runtime and which need the server-compile fallback path.

**Regenerate:** `pnpm runtime:build && pnpm runtime:matrix`. Source
snippets live in `runtime/yaegi-wasm/matrix.mjs`.

**Setup:** Yaegi v0.16.1, Go 1.22 stdlib generation, minimal vendored
stdlib subset (`fmt`, `strings`, `strconv`, `errors`, `math`, `sort`,
`slices`, `maps`).

## Headline

**18/20 pass — 90%**, comfortably above the 80% threshold from
04-runtime-strategy.md ("If <80% pass, we may need to invest in a
Yaegi fork or jump straight to full-gc-WASM"). **Yaegi is viable as
the primary runtime.**

| Category | Snippet | Result | t (ms) |
|---|---|---|---|
| basic-types | var decl + arithmetic | ✓ | 53 |
| basic-types | const + multi-return | ✓ | 8 |
| slices | append + len | ✓ | 26 |
| slices | range with index | ✓ | 9 |
| maps | make + insert + lookup | ✓ | 12 |
| maps | comma-ok idiom | ✓ | 7 |
| structs | literal + field access | ✓ | 11 |
| methods | value receiver | ✓ | 7 |
| methods | pointer receiver mutation | ✓ | 8 |
| interfaces | implicit satisfaction | ✓ | 5 |
| interfaces | type assertion v, ok | ✓ | 8 |
| goroutines+channels | send/recv on unbuffered chan | ✓ | 5 |
| goroutines+channels | buffered chan + close + range | ✓ | 8 |
| defer | LIFO order | ✓ | 4 |
| defer | args captured at defer-time | ✗ Yaegi quirk | 7 |
| generics-stdlib | slices.Sort on []int | ✗ undefined selector | 4 |
| generics-stdlib | slices.Contains | ✓ | 10 |
| generics-custom | type parameter with constraint | ✓ | 6 |
| errors | errors.New + errors.Is | ✓ | 6 |
| errors | fmt.Errorf with %w wrap | ✓ | 4 |

Cold-run (first snippet, includes WASM warmup): ~50 ms. Warm runs
average ~8 ms. Both well inside the design budget — 04-runtime-
strategy.md anticipated "~10 ms vs ~500 ms server."

## Findings

### F1 — `defer` arg-capture-at-statement-time deviates

```go
i := 1
defer fmt.Println("captured:", i)
i = 99
```

Real Go: prints `captured: 1` (args evaluated at the *defer* statement).
Yaegi: prints `captured: 99` (args evaluated at the *function return*).

This is a Yaegi correctness gap, not a stdlib gap. We can't author an
exercise teaching this specific gotcha on the in-browser runtime; the
learner would submit the right answer and Yaegi would mark it
incorrect. Two options when we get there:

- Tag the exercise with `runtime: "server"` so the dispatcher routes
  to the fallback (per 04-runtime-strategy.md's `runtime` field).
- Skip the exercise. The "defer in a loop" gotcha (Theme 7.1) is a
  Module-7 advanced item, not Module 1 launch material — we can
  shelve it until the fallback hosting lands.

The LIFO ordering test for `defer` passes, so most defer exercises
are still on Yaegi-friendly ground.

### F2 — `slices.Sort` not in the reflected stdlib

`slices.Sort` is a generic function (`Sort[S ~[]E, E cmp.Ordered]`).
Per the upstream extract, yaegi v0.16.1 marks several generic stdlib
functions as "not yet supported" — they're emitted as comments rather
than `reflect.ValueOf` entries. Same gap design-docs/04 called out:
"Generic stdlib functions (`slices.Sort`, `maps.Keys`, etc.) failing."

`slices.Contains` works because it isn't generics-constrained beyond
`comparable`, which yaegi handles. The boundary is roughly: yaegi
supports custom type parameters and unconstrained generics, but
generic stdlib funcs that pull in `cmp.Ordered` (`Sort`, `Min`,
`Max`, `MinFunc`, `MaxFunc`, `BinarySearch`) need the fallback.

Authoring impact: Module 4.2 "Generics" exercises can use custom
constraints freely. Exercises that *show* a generic stdlib function
need either (a) the server fallback, or (b) a hand-rolled equivalent
in the exercise (`sort.Slice` works and is on Yaegi today).

## Runtime tiering for exercise authoring

Based on the matrix, default each exercise type in Modules 1-4 to
the in-browser runtime; route to server only when an exercise lands
in F1/F2 territory:

| Exercise content involves… | Runtime tag |
|---|---|
| Module 1-4 happy path (no generic-stdlib calls) | `yaegi` |
| Generic stdlib `Sort` / `Min` / `Max` / `BinarySearch` | `server` |
| `defer` arg-capture semantics teaching | `server` |
| Goroutines, channels, buffered channels, close | `yaegi` |
| Interfaces, type assertions, methods, structs | `yaegi` |
| Errors (`errors.Is`/`As`, `fmt.Errorf` `%w`) | `yaegi` |
| Anything from `sync`, `time`, `context` | `server` until vendored |

The `runtime` field on `exerciseSchema` is already in place
(`"yaegi" | "server" | "none"`, default `"none"`). The dispatcher
(when freeform lands — task #17) reads it to pick the runtime.

## What's deferred to a future POC

- **`sync`, `time`, `context`** — *landed 2026-05-21.* All three
  vendored from `yaegi v0.16.1/stdlib/go1_22_*.go` into
  `runtime/yaegi-wasm/symbols/`, package clause rewritten
  `stdlib` → `symbols`. WASM raw size held at 10 MB. Verified
  via probe matrix: `sync.{WaitGroup,Mutex,Once,RWMutex,Map}`,
  `time.{After,Now,Millisecond,Second,Duration}`,
  `context.{Background,WithCancel,WithTimeout,Done,Err}` all
  import + use cleanly. Unlocks every Module 6 concurrency theme
  and Theme 7.3 (`idioms/context`) — those modules now ship.
  See design-docs/30 for the full upstream-tracker record.
- **Server fallback hosting** — Vercel Function vs Cloudflare Worker
  vs a small VPS, sandboxing strategy (firejail / nsjail), timeouts.
  Open in 99-open-questions.md.
- **Watchdog for runaway loops** — *shipped.* The Reset button in
  `RunResetToolbar` (mounted on Freeform and FillBlankLineInput)
  calls `useYaegiRun.reset()` → `terminateRunner()` → terminates
  and re-spawns the worker, and writes a sentinel `runResult` so
  the UI explains what happened. Auto-watchdog (kill after N
  seconds, no learner click required) is still open and would help
  learners who don't realise their loop is infinite — small
  follow-up, not blocking launch.
- **Multi-package programs** — every snippet here is a single
  `package main`. Yaegi supports multi-file but we haven't tested
  whether exercises that import their own helpers work.
