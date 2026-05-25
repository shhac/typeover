# 10b — Curriculum (Zig target)

**Status as of 2026-05-25.** Modules 1-4 (basics, types, memory,
errors) are **shipped** — 20 themes × 9 slots ≈ 180 exercises live
against the real Zig compiler. Modules 5-7 (comptime, stdlib,
idioms) are still scaffolded. The first-slice section below is
preserved as the historical "what shipped first" record; the
slot-queue below it is materially out of date but kept as
authoring-archive.

Parallel to [10-curriculum-go.md](10-curriculum-go.md). The Zig
track's module/theme spine, what shipped, and the queue of
remaining themes for future authoring sessions.

The pedagogy + ordering principles from 10 (start where TS mental
models transfer; one friction point per module; defer the natively
weird stuff until the bilingual scaffold has paid off) apply
unchanged. The differences below are about *which* concepts map and
where the friction lives.

## Ordering principle, applied to Zig

1. **Basics first** — variables, conditionals, loops, functions,
   strings — anything that translates from TS with ~one shift per
   concept.
2. **Types next** — Zig's type vocabulary (struct, enum, pointer,
   slice, optional) is similar enough to lean on TS analogues.
3. **Then the memory model** — allocators + `defer` is where Zig
   diverges hard from any TS / Go intuition. Goes here, not last,
   because everything in `errors`, `stdlib`, and `idioms` references
   allocators.
4. **Errors after memory** — Zig's `error{...}` sets + `errdefer`
   are best taught once allocators exist (so the textbook
   "alloc-then-errdefer-free" example reads naturally).
5. **Comptime before stdlib** — `ArrayList(T)` and `HashMap(K, V)`
   are comptime-generic, so the learner needs comptime fluency
   before the stdlib chapter to read the type names without
   handwaving.
6. **Stdlib then idioms** — the same shape the Go track ends on.

Concurrency intentionally **omitted** for first pass — Zig's async
story is mid-rewrite as of 0.16. Add it as Module 8 when the
upstream story stabilises.

## Pass 1 — Modules & themes

Theme IDs are stable slugs (`<lang>/<module>/<theme>`) per the
[31-multi-language-architecture-2026-05-22.md](31-multi-language-architecture-2026-05-22.md)
shape. They appear in URLs and progress keys; don't rename
post-launch.

---

### Module 1 — Basics *(translates cleanly, mostly)*

Goal: by the end, the learner can read and write trivial Zig
programs (hello-world, simple control flow, basic types) and
trusts that typeover's translation pattern works for Zig too.

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 1.1 | Hello and output ✅ | `zig/basics/hello-and-output` | — | `@import("std")`, the `pub fn main(init: std.process.Init) !void` entry shape, `try` + `writeStreamingAll`. Establishes the `@`-builtin convention + error-union return type. **Shipped 2026-05-22, 3/9 slots authored.** |
| 1.2 | Variables (`const` / `var`) | `zig/basics/variables` | 1.1 | `const` (default) vs `var` (mutable), type annotations, no `let`. The "everything's `const` until you tell me otherwise" reflex contrasts TS's `let` default. |
| 1.3 | Conditionals | `zig/basics/conditionals` | 1.2 | `if` / `else if` / `else` — parens around the condition stay (unlike Go!). `switch` as expression. The pleasant surprise: TS `if (cond)` translates directly. |
| 1.4 | `while` and `for` | `zig/basics/while-and-for` | 1.2, 1.3 | `while (cond)`, `while (cond) : (step) { ... }` for C-style update, `for (slice) |item| { ... }`. No three-clause `for`. |
| 1.5 | Functions | `zig/basics/functions` | 1.2 | `fn name(params) ReturnType { ... }`, `pub fn`, parameter passing, multiple-return via struct (or out-param). |
| 1.6 | Numeric primitives | `zig/basics/numeric-primitives` | 1.2 | `i8` / `i16` / `i32` / `i64` / `u8` / ..., `usize`, `f32` / `f64`. The big idea: no implicit numeric conversion. `@as(T, x)` for explicit. |
| 1.7 | Strings as `[]const u8` | `zig/basics/strings-as-slices` | 1.2, 1.6 | String literals are `*const [N:0]u8`, coerce to `[]const u8`. No `String` type — strings are byte slices. |
| 1.8 | Optionals (`?T`) | `zig/basics/optionals` | 1.5, 1.6 | `?T` for "maybe a T," `orelse`, `if (x) |unwrapped|`. The "`null` is a value in the type" model TS developers already know from `T | null`. |

---

### Module 2 — Types *(structural shifts)*

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 2.1 | Structs | `zig/types/structs` | 1.5, 1.6 | `const Point = struct { x: i32, y: i32 };`, methods via `pub fn (self: …)`, instantiation with `.{...}`. |
| 2.2 | Enums + tagged unions | `zig/types/enums-and-tagged-unions` | 2.1 | `enum`, `union(enum)` for sum types — TS discriminated unions analogue. `switch` exhaustiveness. |
| 2.3 | Pointers | `zig/types/pointers` | 2.1 | `*T` (single pointer), `*const T` (read-only), `[*]T` (many), `?*T` (nullable). When to use which. |
| 2.4 | Arrays vs slices | `zig/types/arrays-vs-slices` | 1.7, 2.3 | `[N]T` (fixed, length in type) vs `[]T` (slice with runtime length). `&arr` for slicing. |

---

### Module 3 — Memory *(the friction module)*

This is where Zig stops looking like Go or TS. Allocators are
explicit, `defer` is essential, ownership is by convention.

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 3.1 | Allocators intro | `zig/memory/allocators-intro` | 1.5 | `std.heap.page_allocator`, `GeneralPurposeAllocator`, arena. Why allocators are explicit; the "what allocator should I use" question. |
| 3.2 | `defer` and `errdefer` | `zig/memory/defer-and-errdefer` | 3.1 | LIFO cleanup; `errdefer` only fires on error-path returns. The canonical "alloc, then `errdefer free`" pattern. |
| 3.3 | `ArrayList` | `zig/memory/arraylist` | 3.1, 3.2 | The growable-slice container. `init(alloc)`, `deinit()`, `append`, `items`. First taste of comptime-generic types. |
| 3.4 | Ownership conventions | `zig/memory/ownership-conventions` | 3.1, 3.3 | "Whoever called `init` calls `deinit`." No borrow checker, just convention. |

---

### Module 4 — Errors

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 4.1 | Error sets | `zig/errors/error-sets` | 1.5 | `error{...}` declarations, error-set composition. |
| 4.2 | `try` and `catch` | `zig/errors/try-and-catch` | 4.1 | `try` is sugar for `catch \|err\| return err`. `catch \|err\|` for handling. |
| 4.3 | Error-union returns (`!T`) | `zig/errors/error-union-returns` | 4.1, 4.2 | `fn foo() !T`, anonymous error sets, `!void`. |
| 4.4 | Panics vs errors | `zig/errors/panics-vs-errors` | 4.3 | `@panic`, `unreachable`, when each is appropriate. |

---

### Module 5 — Comptime

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 5.1 | Comptime values | `zig/comptime/comptime-values` | 1.5, 1.6 | `comptime` keyword, compile-time-known values. |
| 5.2 | Comptime parameters | `zig/comptime/comptime-params` | 5.1 | `fn foo(comptime T: type, …)`, the "types as parameters" idea. |
| 5.3 | Generic types | `zig/comptime/generic-types` | 5.2, 2.1 | `fn List(comptime T: type) type { return struct { ... }; }` — the standard Zig generics pattern. |
| 5.4 | Type introspection | `zig/comptime/type-introspection` | 5.2 | `@TypeOf`, `@typeInfo`, `@hasField`. |

---

### Module 6 — Stdlib

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 6.1 | `io.Writer` / `io.Reader` | `zig/stdlib/io-writer-reader` | 1.7, 3.1 | The Writer interface. Building writers from anything. |
| 6.2 | `fmt` | `zig/stdlib/fmt` | 6.1 | `std.fmt.allocPrint`, `std.fmt.bufPrint`, format specifiers. |
| 6.3 | `ArrayList` + `HashMap` | `zig/stdlib/arraylist-and-hashmap` | 3.3, 5.3 | Hash maps; the API parallels ArrayList. |
| 6.4 | `sort` | `zig/stdlib/sort` | 5.3 | `std.mem.sort`, comparators. |
| 6.5 | Testing | `zig/stdlib/testing` | 4.3 | `test "name" { try … }`, `std.testing.expect`, running with `zig test`. |

---

### Module 7 — Idioms

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 7.1 | `build.zig` basics | `zig/idioms/build-zig-basics` | — | What a `build.zig` does. `b.addExecutable`, dependencies. |
| 7.2 | Project layout | `zig/idioms/project-layout` | 7.1 | `src/main.zig` + `build.zig` + `build.zig.zon`. |
| 7.3 | Gotchas | `zig/idioms/gotchas` | varies | No implicit casts; integer overflow checks; no operator overloading; tagged-union exhaustiveness. |
| 7.4 | Zig-isms | `zig/idioms/zig-isms` | varies | Things that surprise C / Rust / TS refugees: `.{...}` anonymous structs, `inline for`, `comptime` everywhere. |

---

## First slice — what shipped

**`zig/basics/hello-and-output`** — 3 of 9 slots, 2026-05-22:

| # | Type | Title | Notes |
|---|---|---|---|
| 01 | mcq | `const std = @import("std");` | Variant-form with `std` + `fs` examples. Distractors cover TS/JS/Rust/Go reflexes. |
| 02 | fill-word | The `@import` builtin | Single blank for the builtin name; drills the `@`-prefix convention. |
| 03 | fill-line | `writeStreamingAll` to stdout | Graded by the Zig runtime via stdout match. Distractors include the `std.debug.print` stderr trap with `explain`. |

All three canonicals verified against the real Zig WASM compiler
via `runtime/zig-wasm/smoke.mjs` before commit; browser e2e
confirmed all three render + grade correctly on 2026-05-22.

## Slot queue (highest-value first)

For the next authoring session(s):

1. **Fill out `zig/basics/hello-and-output` slots 4-9** so the
   first theme hits the 9-slot target. Suggestions: more
   fill-word drills on `try` / `init.io` / the `!void` return,
   one MCQ on the entry-point signature, one freeform that
   prints a personalised greeting (introduces variables).
2. **Author `zig/basics/variables`** (theme 1.2) — the
   `const` / `var` distinction. Strongest TS-developer hook in
   the basics module (TS uses `let` by default; Zig defaults
   the other way).
3. **Author `zig/basics/conditionals`** — explicit comparison to
   Go's no-parens rule. The TS reflex actually *matches* Zig
   here; surface that as the lesson.
4. **Build a parallel `32-zig-upstream-tracker-*.md`** the first
   time a compiler limitation blocks an exercise.

## Done is when

A full Module 1 (basics) lands — 8 themes × 9 slots ≈ 72
exercises — and is end-to-end exerciseable. Then Module 2
(types), and so on. The Go track took many sessions to build up
from 1 module to 7 with 288 exercises; expect the same arc for
Zig.

## Status update (2026-05-25)

Modules 1-4 are complete: ~180 exercises shipped against the real
Zig compiler. Specifically:

- **Module 1 (Basics)** — all 8 themes × ~9 slots authored:
  hello-and-output, variables, conditionals, while-and-for,
  functions, numeric-primitives, strings-as-slices, optionals.
- **Module 2 (Types)** — structs, enums-and-tagged-unions,
  pointers, arrays-vs-slices.
- **Module 3 (Memory)** — allocators-intro, defer-and-errdefer,
  arraylist, ownership-conventions.
- **Module 4 (Errors)** — error-sets, try-and-catch,
  error-union-returns, panics-vs-errors.

Modules 5-7 (comptime, stdlib, idioms) remain on the slot queue.
Every shipped canonical was smoke-tested against
`runtime/zig-wasm/smoke.mjs` before commit.
