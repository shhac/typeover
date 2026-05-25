# 32 — Compile-service architecture (2026-05-24)

**Status update 2026-05-25.** The pipeline is live; Rust exercises
ship through it today. ~45 Rust exercises authored across the
foundations module and growing under an autonomous build loop. The
`/api/compile/rust.ts` handler, `bootstrap-rust-sandbox.ts`
pre-warmer, `prebake-compile-cache.ts` L1 baker, and SW + Function
cascade are all in place and tested. The "What this doc does NOT
cover — defer to a future 10c-curriculum-rust.md" promise has been
met by [10c-curriculum-rust.md](10c-curriculum-rust.md).

## Why this exists

The Yaegi (Go) and zig.wasm (Zig) tracks both run *in the learner's
browser* — the entire toolchain ships as WASM. That's only possible
because both languages have a viable in-browser execution story:
Yaegi is a pure-Go interpreter, zig.wasm is the official Zig
compiler built for the web.

Adding a Rust track breaks that property. We surveyed the landscape
on 2026-05-24:

- **rubri** (Miri compiled to WASM) — ~34 MB brotli first-load
  (8.6 MB miri.opt.wasm + 25.6 MB rlibs). 30–40× heavier than the
  Zig track. Stale (Sep 2024 last release). Upstream Miri
  maintainers explicitly state Miri-in-WASM "is not something we
  currently intend to support officially" (miri#722).
- **rubrc** (rustc compiled to WASM) — work-in-progress; author on
  hiatus; requires COOP/COEP headers. Not production-viable.
- **rust-playground / Compiler Explorer** — both forbid third-party
  use of their endpoints; would also break the all-client property.

The honest framing: Rust is the worst-fit of our three languages for
typeover's all-client model. We need a fourth runtime tier.

## The decision: server-compile, client-execute

We compile Rust source server-side to `wasm32-wasip1`, ship the
compiled wasm to the browser, and execute it client-side using
`bjorn3/browser_wasi_shim` (the same WASI shim rubri uses, but
shipped without the 30+ MB Miri payload).

The shipped artifact per exercise is **~50–200 KB** vs rubri's
**~34 MB**. The server bears the rustc cost (~2–5 s per cache miss)
once; everything else is CDN-cached or browser-cached forever.

This **does not change** Go or Zig — they remain pure in-browser.
The `runtime` field on the exercise schema (`"yaegi" | "zig" |
"server" | "none"`) was already designed for this; we're filling in
what `"server"` resolves to.

## Why Vercel Sandbox specifically

[Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) went GA on
2026-01-30. Firecracker microVMs designed for running untrusted
user code. Amazon Linux 2023 base with `sudo` + `dnf`, so we
`dnf install rust cargo` once, **snapshot the VM**, and every
subsequent request resumes from the snapshot in milliseconds.

Why this is the right primitive for typeover:

1. **The microVM IS the security boundary.** We don't have to
   reinvent Docker / Firecracker / gVisor sandboxing — Vercel ships
   the strongest tier (per-VM kernel) by default. Untrusted-code
   safety is on the box.
2. **Stays inside our stack.** typeover deploys exclusively to
   Vercel. No Fly.io / Railway / AWS surface to manage.
3. **Snapshot resume is free.** rustc is installed once. The
   per-request flow boots an already-warm VM and runs the compile.
4. **Free tier (Hobby) is plausible for early launch.** 5 hr/mo
   Active CPU, 5,000 sandbox creations, 10 concurrent. Pre-cached
   solutions never touch the sandbox. See cost envelope below.

## Architecture: two-tier cache, optional sandbox

The flow is built around making the sandbox the rare exception, not
the common case:

```
┌────────────────────────────────────────────┐
│  Browser                                   │
│  ── fetch("/api/compile/rust", { source }) │
└──────┬─────────────────────────────────────┘
       │ intercepted by Service Worker
       ▼
┌────────────────────────────────────────────┐
│  Service Worker                            │
│  ① normalize(source) → hash                │
│  ② GET /compile-cache/rust/<hash>.wasm     │ ◄── L1: static CDN
│     200 → return cached bytes              │     (free, no Function)
│     404 ▼                                  │
│  ③ POST /api/compile/rust { source }       │
└──────┬─────────────────────────────────────┘
       ▼
┌────────────────────────────────────────────┐
│  Vercel Function (Node 24)                 │
│  ① Validate exerciseId + edit              │
│  ② normalize(source) → hash (same fn)      │
│  ③ Blob lookup compile-cache/rust/<hash>   │ ◄── L2: Vercel Blob
│     hit → return + write to CDN path       │     (cheap)
│  ④ Sandbox.getOrCreate({ snapshot })       │
│  ⑤ writeFiles, runCommand rustc, readFiles │ ◄── L3: real compile
│  ⑥ Store in Blob + return                  │     (rare)
└──────┬─────────────────────────────────────┘
       ▼ wasm (50–200 KB)
┌────────────────────────────────────────────┐
│  Browser Worker                            │
│  + browser_wasi_shim                       │
│  → instantiate, run, capture stdout        │
└────────────────────────────────────────────┘
```

The three cache tiers, in cost order:

| Tier | Path | Cost | When |
|---|---|---|---|
| **L1 static** | `/compile-cache/<lang>/<hash>.wasm` | $0 (CDN) | Build-time pre-baked solutions; anything ever promoted |
| **L2 Blob** | Vercel Blob lookup in Function | ~ms; counts against Blob egress | Runtime cache; first time anyone types this canonical source |
| **L3 Sandbox** | Firecracker microVM, rustc | ~3 s + Active CPU bill | Truly novel canonical source ever seen |

The service worker tries L1 directly. The Function tries L2 then
L3. Whenever the Function compiles via L3, it writes to L2 *and*
emits the bytes — a build-time process can later promote frequent
L2 entries to L1.

## The service-worker layer is language-agnostic

The SW does not know about Rust. It knows about a **language
registry**:

```ts
// src/lib/compile-service/registry.ts
export interface LanguageEntry {
  id: string;                         // "rust", later "go-server", ...
  normalize: (src: string) => string; // pure, deterministic, no I/O
}

export const LANGUAGE_REGISTRY: Record<string, LanguageEntry> = {
  rust: { id: "rust", normalize: normalizeRust },
};
```

The SW URL contract:

- `POST /api/compile/<lang>` — request body is the source. The SW
  intercepts, computes `hash = sha256(normalize(source))`, attempts
  `GET /compile-cache/<lang>/<hash>.wasm` first, falls back to the
  POST if it misses.
- `GET /compile-cache/<lang>/<hash>.wasm` — static asset served by
  Vercel's CDN. Pre-baked at build time for canonical solutions,
  written at runtime by the Function.

Adding a future language that needs server-compile is one new
entry in `LANGUAGE_REGISTRY` plus a `normalize<Lang>` implementation
and a route at `/api/compile/<lang>`. The SW doesn't change.

## Why normalize source before hashing

Two source strings that differ only in whitespace and comments
compile to byte-identical wasm under `rustc -C strip=symbols`. A
naïve `hash(source)` would treat every cosmetic variation as a new
cache key, costing one sandbox compile per variation per learner.

`normalizeRust` strips comments and collapses whitespace runs
(except inside string/char literals), preserving exactly the
information that affects compile output. It runs identically in the
browser (SW) and the Vercel Function. Same function, same hash,
deterministic cache lookups.

We considered three alternatives:

- **Real rustfmt in the sandbox** — adds ~6 % to the Active CPU
  bill per cache miss and runs for *every* miss. Rejected: cost
  without proportional cache-hit benefit.
- **rustfmt-wasm shipped to the client** — no maintained package
  exists. `alexcrichton/rustfmt-wasm` is a 2018 experiment; the
  `@wasm-fmt` collection covers Zig, Go, Python, etc. but
  conspicuously not Rust.
- **Hash raw source, accept misses** — every whitespace variation
  pays one sandbox compile. With ~hundreds of learners and any
  formatting variance, this erodes the Hobby tier quickly.

The hand-rolled normalizer is ~3.5 KB minified, ~1.4 KB brotli.
Shipping it both sides of the cache is the cheapest path.

## Abuse-prevention stack

The sandbox boundary handles most of the threat model; the rest
is shape-locking the request surface.

| Layer | Mechanism |
|---|---|
| **Exercise scoping** | Every request carries `exerciseId`. Server has the canonical skeleton; user supplies only the edit region. Edit ≤ 8 KB. Unknown `exerciseId` → 400. |
| **Source filter** | Reject substrings `extern crate`, `std::process`, `std::env`, `std::fs`, `std::net`, `std::os::`, `unsafe`, `asm!`, `include_*!`, `#![feature(`. Cheap signal, not the boundary. |
| **rustc lock** | Server invokes rustc directly (no cargo). Target locked to `wasm32-wasip1`. No user-supplied flags reach rustc. |
| **Output cap** | Reject wasm > 2 MB before storing. |
| **Sandbox firewall** | Egress `deny-all` — rustc can't phone home, pull crates, or exfiltrate. |
| **Microvm boundary** | Firecracker per-VM kernel. Escape resistance ships with Vercel Sandbox. |
| **Rate limit** | Per-IP + per-session counter in the Function. Cloudflare Turnstile challenge on first request per session. |
| **Cache by hash** | The L1/L2/L3 cascade means popular solutions never re-bill compute. |

## Cost envelope

Vercel Hobby plan (free):

- 5 hr/mo Active CPU
- 5,000 sandbox creations/mo
- 420 GB-hr/mo provisioned memory
- 20 GB/mo data transfer
- 15 GB lifetime snapshot storage
- 10 concurrent sandboxes
- 45 min max session duration

Per-compile cost: ~3 s wall-clock × 2 vCPU = ~0.0017 vCPU-hours.
At ~3,000 cache-miss compiles per month, Hobby holds.

Cache-hit rate is the lever. The two-tier cache structure means:

- L1 hits are **free** — pure CDN.
- L2 hits cost a Function invocation + Blob egress (~ms).
- L3 (sandbox) only fires for truly novel canonical sources.

With build-time pre-baking of canonical solutions, the realistic
hit rate is >90 % once a curriculum is mature. Hobby tier holds at
the projected typeover scale; soft-fail behavior (sandbox creation
pauses, never bills) means there's no surprise.

Pro plan ($20/mo credit) covers ~5× the volume Hobby does before
any line items charge.

## Where this falls short

- **`iad1` only.** Sandbox runs in us-east-1 only today. From
  Europe/Asia the L3 path adds ~150–250 ms RTT. L1 cache hits go
  via Vercel's edge POPs, so most learner activity is unaffected.
- **rustc version pin.** The snapshot freezes the toolchain.
  Refreshing rustc means re-snapshotting and re-validating cached
  wasms — a small CI job to schedule monthly.
- **Single-file, no crates.** Same constraint rubri has. Fine for
  beginner-curriculum exercises; would bite an advanced track that
  wanted to teach `serde` or `tokio`. Defer.

## What this doc does NOT cover

- Specific Rust curriculum content — defer to a future
  `10c-curriculum-rust.md`.
- Concrete `/api/compile/rust` route implementation, the Sandbox
  bootstrap script, and the Rust client runtime (browser_wasi_shim
  wiring) — defer to follow-up work once the curriculum is
  scoped. The normalize module + service-worker skeleton land now
  because they're language-agnostic infrastructure.

## Implementation notes

### Function lives at the project root, not under `src/pages/api/`

Astro stays in `output: "static"` mode. The Function lives at
`/api/compile/rust.ts` at the project root, where Vercel's
zero-config Function detection picks it up regardless of the
framework on top. This avoids switching every existing page to
`export const prerender = true` just to add one endpoint. A
future move into the Astro tree (with `@astrojs/vercel` and
`output: "server"`) is a near-mechanical refactor when the API
surface grows past one route.

### Pool of named sandboxes, not explicit snapshot IDs

The transport addresses sandboxes by stable names —
`rust-compiler-pool-0`, `-1`, `-2` by default. Vercel Sandbox is
persistent-by-default: on first creation, `onCreate` runs the
rustup install (~30 s, one-shot); afterward the sandbox
auto-snapshots its filesystem on idle stop and the next
`getOrCreate` call resumes from snapshot in milliseconds.

Why not the explicit-snapshot-ID pattern from the SDK docs:
- No env var to manage between bootstrap and production runtime.
- No "the snapshot ID drifted out of sync" failure mode.
- The pool name is the single coordinate; the rustup install is
  baked into a `onCreate` hook colocated with the transport.

The bootstrap script (`pnpm bootstrap:rust-sandbox`) is now just
a pre-warmer — it touches each pool shard once so the first
production request doesn't pay the 30 s rustup install. Re-run
on rust-toolchain bumps after deleting the old named sandboxes.

### L2 (Blob) tier is deferred

The current Function compiles via Sandbox on every cache miss
without writing to Blob. The L1 build-time pre-bake covers the
expected long-tail (canonical solutions); novel learner code
each pays one Sandbox compile. When that proves expensive, drop
in a Blob lookup at the Function entry — the cascade contract
in the SW + transport is already shaped for it.

## Files that capture each decision

| Layer | Files |
|---|---|
| Normalizer + language registry | `src/lib/compile-service/normalize/*.ts`, tests alongside |
| Service-worker cache | `public/sw-compile-cache.js` (built from `src/service-worker/compile-cache.ts`), registration in `src/layouts/BaseLayout.astro` |
| Compile endpoint | `/api/compile/rust.ts` (project-root, Vercel auto-Function) |
| Rust client runtime | `src/runtime/rust-worker.ts` + `src/runtime/index.ts` |
| Compile transports | `src/lib/compile-service/transports/{docker,sandbox,types}.ts` |
| Sandbox pre-warmer | `scripts/bootstrap-rust-sandbox.ts` (`pnpm bootstrap:rust-sandbox`) |
| Build-time pre-cache | `scripts/prebake-compile-cache.ts` (`pnpm cache:prebake`) |
| Submission shape (per-language defaults + override) | `src/lib/freeform-shape.ts` |
