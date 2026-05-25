# 10c — Curriculum (Rust target)

**Created 2026-05-25.** Parallel to
[10-curriculum-go.md](10-curriculum-go.md) and
[10b-curriculum-zig.md](10b-curriculum-zig.md). Captures the Rust
track's module/theme spine, what's authored today, and the
autonomous-build-loop pattern that's grinding the remaining slots
out tick-by-tick.

Rust is the third first-class track and the first one that doesn't
run in the browser end-to-end. The runtime story lives in
[32-compile-service-architecture-2026-05-24.md](32-compile-service-architecture-2026-05-24.md);
this doc is about *what* we teach, not *how* it executes.

## Ordering principle, applied to Rust

The Go and Zig tracks both delay their friction module until the
bilingual scaffold has paid off. Rust's friction is **ownership** —
move/borrow/lifetime intuition is the thing that makes the language
feel alien even to seasoned TS engineers. We respect that by:

1. **Foundations first** — variables, scalar types, control flow,
   functions, expressions — anything that translates from TS with
   ~one shift per concept. Including a deliberate "Compiler
   feedback" theme that teaches reading rustc errors *before*
   ownership lessons start producing them.
2. **Ownership next** — the alien module. Moves, references,
   mutable borrows, slices, `String` vs `&str`, enough lifetime
   intuition to read function signatures.
3. **Data modeling** — structs with `impl`, enums as tagged unions,
   pattern matching, `Option`. Recovers familiar territory for TS
   developers used to discriminated unions.
4. **Collections & iteration** — `Vec`, `HashMap`, iterator
   adapters, closures, the ownership rules collections enforce.
5. **Errors, crates & tests** — `Result`, `?`, custom error enums,
   modules, Cargo packages, visibility, tests. The "snippets become
   crates" graduation moment.
6. **Traits & generics** — trait bounds, derives, generic functions,
   `impl Trait`, dynamic dispatch via `dyn Trait`. TS-developer
   familiar territory in new syntax.
7. **Production Rust** — smart pointers, interior mutability,
   concurrency, async fundamentals, common stdlib traits, project
   layout, formatting, Clippy.

## Module & theme spine — 7 modules × 32 themes

Theme IDs are stable slugs (`rust/<module>/<theme>`) per the
[31-multi-language-architecture](31-multi-language-architecture-2026-05-22.md)
shape. They appear in URLs and progress keys; don't rename
post-launch.

---

### Module 1 — Foundations *(translates cleanly)*

The "you already know this, just spelled differently" module.

| # | Theme | Slug | Notes |
|---|---|---|---|
| 1.1 | Hello and printing | `rust/foundations/hello-and-printing` | `fn main()`, `println!`, the `!` macro convention. |
| 1.2 | Bindings and mutability | `rust/foundations/variables` | `let` (immutable default) vs `let mut`, type annotations after the name, shadowing. The strongest TS-developer hook in the module — TS uses `let` mutable by default; Rust flips it. |
| 1.3 | Scalar types | `rust/foundations/scalar-types` | `i32`/`i64`/`u32`/…/`f64`, `bool`, `char`. No implicit numeric conversion. |
| 1.4 | Control flow | `rust/foundations/control-flow` | `if` as expression, `loop` / `while` / `for`, `match` preview. |
| 1.5 | Functions and expressions | `rust/foundations/functions-and-expressions` | `fn name(p: T) -> U`, expressions-vs-statements (trailing semicolon flips the type to `()`), early return. |
| 1.6 | Compiler feedback | `rust/foundations/compiler-feedback` | Reading rustc errors. Deliberately placed *before* ownership lessons so the learner has a vocabulary for the borrow-checker errors that follow. |

---

### Module 2 — Ownership & borrowing *(the alien module)*

| # | Theme | Slug |
|---|---|---|
| 2.1 | Moves and Copy | `rust/ownership/moves-and-copy` |
| 2.2 | Borrowing | `rust/ownership/borrowing` |
| 2.3 | Mutable borrows | `rust/ownership/mutable-borrows` |
| 2.4 | Strings and slices | `rust/ownership/strings-and-slices` |
| 2.5 | Lifetime intuition | `rust/ownership/lifetime-intuition` |

---

### Module 3 — Data modeling

| # | Theme | Slug |
|---|---|---|
| 3.1 | Structs and `impl` | `rust/data/structs-and-impl` |
| 3.2 | Enums | `rust/data/enums` |
| 3.3 | Pattern matching | `rust/data/pattern-matching` |
| 3.4 | `Option` | `rust/data/option` |

---

### Module 4 — Collections & iteration

| # | Theme | Slug |
|---|---|---|
| 4.1 | Vectors | `rust/collections/vectors` |
| 4.2 | Hash maps | `rust/collections/hash-maps` |
| 4.3 | Iterators | `rust/collections/iterators` |
| 4.4 | Closures | `rust/collections/closures` |

---

### Module 5 — Errors, crates & tests

| # | Theme | Slug |
|---|---|---|
| 5.1 | `Result` and `?` | `rust/errors/result-and-question-mark` |
| 5.2 | Custom errors | `rust/errors/custom-errors` |
| 5.3 | Modules and visibility | `rust/errors/modules-and-visibility` |
| 5.4 | Cargo and testing | `rust/errors/cargo-and-testing` |

---

### Module 6 — Traits & generics

| # | Theme | Slug |
|---|---|---|
| 6.1 | Traits | `rust/abstractions/traits` |
| 6.2 | Generics | `rust/abstractions/generics` |
| 6.3 | Derive and common traits | `rust/abstractions/derive-and-common-traits` |
| 6.4 | `impl Trait` and trait objects | `rust/abstractions/impl-trait-and-trait-objects` |

---

### Module 7 — Production Rust

| # | Theme | Slug |
|---|---|---|
| 7.1 | Smart pointers | `rust/production/smart-pointers` |
| 7.2 | Interior mutability | `rust/production/interior-mutability` |
| 7.3 | Concurrency | `rust/production/concurrency` |
| 7.4 | Async basics | `rust/production/async-basics` |
| 7.5 | Idioms and tooling | `rust/production/idioms-and-tooling` |

---

## What's shipped (2026-05-25)

**Module 1 — Foundations is mid-build.** Five of six themes have
full 9-slot progressions authored and verified against the
compile-service: hello-and-printing, variables (bindings-and-mutability),
scalar-types, control-flow, and functions-and-expressions. The
compiler-feedback theme is queued next.

Theme metadata stubs exist for all 32 themes across all 7 modules —
that's the spine. Exercise content lands theme-by-theme.

Total exercises today: ~45. Target end-state: 32 × 9 ≈ 288.

## Quality bar

Same bar as Go and Zig:

- Every freeform + fill-line canonical actually compiles + runs
  through the server-compile pipeline (Vercel Sandbox or local
  Docker transport). Verified via `pnpm runtime:verify`-equivalent
  (the Rust pipeline runs through `validate-rust-source` + the L1
  pre-bake; a canonical that doesn't compile fails the build).
- 3-tuple hints, distractor explanations on fill-line, full MCQ
  recognition coverage before any productive slot per the
  introducing-a-new-pattern rule (02-pedagogy.md).
- Pre-baked L1 cache for every canonical (`pnpm cache:prebake`) so
  the learner's first Run hits a CDN file, not the sandbox.

## Authoring loop

Rust exercises are being authored by an **autonomous build loop**
running tick-by-tick rather than in big curated bursts. The loop:

1. Picks the next-priority slot from the spine.
2. Drafts prompt + canonical + 3 hints + distractors with
   per-pattern explanations against the design-docs/02 +
   06 + 09 bars.
3. Runs the canonical through the compile-service to verify it
   compiles + produces expected stdout.
4. Pre-bakes the L1 cache entry.
5. Commits with a `content[rust/<theme>]:` prefix.

The loop produces uneven authoring velocity by design — quality
bar trumps cadence. Recent ticks: `605d981` variables (9
exercises), `c0e4fa4` scalar-types (9), `5ca13c8` control-flow (9),
`ccb8df2` functions-and-expressions (9).

## Pedagogical decisions specific to Rust

### Where ownership lands

Module 2, not Module 1. The temptation was to introduce moves
immediately ("Rust is the language where assignment moves") but
that buries the lede on what a Rust program *looks* like before the
learner can read one. Module 1 builds the surface fluency; Module 2
introduces the model that changes how every later module's signatures
read.

### Why "Compiler feedback" is its own theme (1.6)

rustc errors carry a lot of vocabulary — `borrowed`, `moved`,
`E0382`, "consider cloning". A learner first meeting these inside a
borrow-checker error has *two* problems at once: the rust ownership
issue, and reading the error format. Giving compiler feedback its
own theme — at the end of Module 1, before the ownership module —
front-loads the vocabulary so Module 2 lessons can lean on it.

### Why MCQs lead every theme harder than Go/Zig

Rust's productive exercises (fill-line, freeform) round-trip to the
compile-service. That's ~ms once cached, but ~3 s on a cache miss.
We over-weight MCQ slots at the start of each Rust theme so the
learner sees the new pattern via recognition (zero-latency) before
any productive slot that might hit a sandbox compile. The 02-pedagogy
"introducing a new pattern" rule applies even more strictly here.

### TS analogues we lean on hardest

- `let mut` vs `let` ↔ TS `let` vs `const` (with the default flipped).
- `Option<T>` ↔ TS `T | undefined`, then unwrapping discipline.
- `Result<T, E>` ↔ TS discriminated unions for error returns.
- Traits ↔ TS structural interfaces + `implements` keyword, with the
  catch that Rust trait coherence rules don't exist in TS.
- `match` exhaustiveness ↔ TS discriminated-union exhaustiveness
  checks.

### TS analogues that *don't* hold

- Ownership / borrowing — no TS analogue. Teach as native Rust.
- Lifetimes — no TS analogue. Teach as a reading discipline first,
  not a writing one (most learner code never names a lifetime).
- Macros (`println!`, `vec!`) — flag the `!` as "this is a macro"
  but don't teach macro authoring in v0.

## Cross-references

- Runtime details (server-compile, SW cache, normaliser): [32](32-compile-service-architecture-2026-05-24.md).
- Multi-language architecture this slots into: [31](31-multi-language-architecture-2026-05-22.md).
- Companion curriculum docs: [10](10-curriculum-go.md), [10b](10b-curriculum-zig.md).
