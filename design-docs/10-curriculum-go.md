# 10 — Curriculum (Go target)

This is the curriculum tree. Pass 1 established modules, Pass 2 drills
each module into themes with prerequisite chains, Pass 3+ will break
themes into exercise-level content (9 slots per theme by default).

## Ordering principle

1. Start where TS mental models transfer almost unchanged — build trust
   in the translation pattern.
2. Introduce *one* friction point per module, building up.
3. Group related friction (structs + methods + pointers + nil all live
   in one module).
4. Defer Go-native concepts (goroutines, channels, defer, embedding)
   until the bilingual scaffold has paid off — when they arrive, the
   learner is fluent enough to engage with them as pure Go content.

## Pass 2 — Modules & themes

The Pass-1 "Module 3 — Types you define" was split into two modules to
keep weighting even. Module 4 used to be "Errors & packaging" and is now
slot 5. The launch gate (Module 1 complete and polished) is unchanged.

Theme IDs are stable slugs (`<module>/<theme>`); they appear in URLs and
in localStorage progress keys, so don't rename them post-launch.

---

### Module 1 — Foundations *(translates cleanly)*

Goal: by the end, the learner trusts that typeover's translation
pattern works, and writing trivial Go feels familiar.

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 1.1 | Variables & declarations | `foundations/variables` | — | `:=` vs `var` vs `const`; type inference; shadowing. The TS `let`/`const` → Go translation pattern is established here, then reused everywhere. |
| 1.2 | Numeric primitives | `foundations/numeric-primitives` | 1.1 | `int`, `int32`, `int64`, `uint*`, `float64`, `float32`. The big idea: Go has no implicit numeric conversion. |
| 1.3 | Strings, bytes, runes | `foundations/strings-bytes-runes` | 1.1, 1.2 | String literals, `fmt.Sprintf` instead of template literals, `byte` vs `rune` vs `string`. |
| 1.4 | Conditionals & switch | `foundations/conditionals` | 1.1 | `if`/`else`, the short-statement form `if err := ...; err != nil`, no ternary, `switch` with no fallthrough by default. |
| 1.5 | Loops | `foundations/loops` | 1.1 | `for` is the only loop. Three forms: classic, while-style, infinite. No `while`, no `do`. `break`, `continue`, labels. |
| 1.6 | Functions & multi-return | `foundations/functions-and-multi-return` | 1.1, 1.4 | `func` definition, the big new idea: tuple-style returns. The `(T, error)` shape is introduced here as the canonical Go convention. |

---

### Module 2 — Collections *(translates with wrinkles)*

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 2.1 | Arrays vs slices | `collections/arrays-and-slices` | 1.1, 1.2 | `[N]T` (fixed-size array) vs `[]T` (slice, the one you actually use). Slices are views over arrays — capacity, `len`, `cap`, `append`, `make`. |
| 2.2 | Maps | `collections/maps` | 1.1, 2.1 | `map[K]V`, `make(map[K]V)`, comma-ok lookup, deletion, iteration order is undefined. |
| 2.3 | Iteration with range | `collections/iteration` | 1.5, 2.1, 2.2 | `for i, v := range`, blank identifier `_`, ranging over slices vs maps vs strings (bytes vs runes). |

---

### Module 3 — Types & methods *(the structural shift)*

The biggest mental-model change so far. TS object literals carry
methods; Go structs don't. Methods are functions with a receiver. Once
this clicks, everything from Module 4 onward falls into place.

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 3.1 | Structs | `types/structs` | 1.1 | `type Foo struct { ... }`, struct literals (positional vs named), field access, zero values for each field type. |
| 3.2 | Methods | `types/methods` | 3.1 | `func (r Receiver) Foo()` — methods are functions with a receiver, not struct members. Value vs pointer receivers and when to use each. |
| 3.3 | Pointers | `types/pointers` | 3.1 | `&` (address-of) and `*` (dereference). The explicit version of "by reference" — TS hides this behind objects-are-references; Go makes it visible. |
| 3.4 | Nil & zero values | `types/nil-and-zero-values` | 3.1, 3.3 | The zero value for every type, the special `nil` for pointers, interfaces, maps, slices, channels, functions. `nil != undefined`. |

---

### Module 4 — Interfaces & generics *(structural typing in Go's shape)*

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 4.1 | Interfaces | `interfaces/interfaces` | 3.2 | `interface { Foo() }`, **implicit satisfaction** (no `implements` keyword), interface composition, the empty interface `any`. The key TS→Go shift: Go inherits structural typing but drops the explicit declaration. |
| 4.2 | Generics | `interfaces/generics` | 3.2, 4.1 | `[T any]`, type constraints, the `comparable` constraint, the `~T` underlying-type form. Familiar from TS; mostly just syntax to learn. |

---

### Module 5 — Errors & packaging *(Go's distinctive conventions)*

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 5.1 | The error pattern | `errors/the-error-pattern` | 1.6 | The `(T, error)` return shape made explicit, sentinel errors, `fmt.Errorf` and `%w` for wrapping. |
| 5.2 | errors.Is / errors.As | `errors/is-and-as` | 5.1, 4.1 | Inspecting errors: `errors.Is` for sentinel match, `errors.As` for type unwrap. Why this is better than `instanceof`. |
| 5.3 | Type assertions & switches | `errors/type-assertions` | 4.1 | `v.(T)` and `v, ok := v.(T)`, the `switch v := i.(type)` form. Adjacent to error inspection, useful generally. |
| 5.4 | Packages & imports | `errors/packages-and-imports` | 1.6 | Package vs file scope, the export-by-capitalisation rule, import aliases, blank import. |
| 5.5 | Modules & go.mod | `errors/modules-and-gomod` | 5.4 | `go.mod`, import paths, module path conventions, `go get` basics. |

---

### Module 6 — Concurrency *(native Go territory — no bilingual crutch)*

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 6.1 | Goroutines | `concurrency/goroutines` | 1.6 | `go fn()`. Concurrency as a built-in. Why you (almost) never want a bare unsynchronised goroutine. |
| 6.2 | Channels | `concurrency/channels` | 6.1 | `chan T`, send/receive, direction (`<-chan` / `chan<-`), buffered vs unbuffered as a synchronisation primitive. |
| 6.3 | Select | `concurrency/select` | 6.2 | Multi-channel coordination, `default` branch for non-blocking, timeout via `time.After`. |
| 6.4 | Sync primitives | `concurrency/sync` | 6.2 | `sync.Mutex`, `sync.RWMutex`, `sync.WaitGroup`. When to reach for `sync` vs channels. |

---

### Module 7 — Idioms & ecosystem *(graduating to "real Go")*

| # | Theme | Slug | Prereqs | Pedagogical purpose |
|---|---|---|---|---|
| 7.1 | Defer | `idioms/defer` | 1.6 | The cleanup pattern, evaluation order (LIFO + args captured at defer-time), common gotcha: defer in a loop. |
| 7.2 | Embedding | `idioms/embedding` | 3.2 | Struct embedding for composition; method promotion. Why Go has no inheritance and what you do instead. |
| 7.3 | Context | `idioms/context` | 6.1, 5.1 | `context.Context`, propagating cancellation, request lifecycle. Why the first arg is conventionally `ctx`. |
| 7.4 | Testing | `idioms/testing` | 5.1, 1.6 | The `testing` package, table-driven tests, `t.Run` subtests, `t.Helper`. |
| 7.5 | The small-interface idiom | `idioms/small-interfaces` | 4.1 | `io.Reader`, `io.Writer`, the "accept interfaces, return structs" principle. Why Go interfaces are tiny. |
| 7.6 | Project layout | `idioms/project-layout` | 5.4, 5.5 | `cmd/`, `internal/`, conventions, when to use what. |
| 7.7 | Common gotchas | `idioms/gotchas` | several | Loop-variable capture, nil interface vs nil concrete, slice aliasing, goroutine leaks. The "what bit me in code review" survival kit. |

---

## Things explicitly **not** in v0

- Reflection (`reflect`). Rarely needed; complicates more than it teaches.
- CGo. Different audience.
- Unsafe pointers. Same.
- Go assembly. Same.
- Specific frameworks (gin, echo, etcd, kubernetes). Per-project decisions.
- `net/http` deep dive, `encoding/json` deep dive. Both worth a theme each
  eventually; deferred from launch because they expand Module 7 past the
  "graduating" character.
- Build tags, conditional compilation, embedding files (`//go:embed`). Edge.

---

## What Pass 2 commits

- Module 3 split into "Types & methods" (3.x) and "Interfaces & generics"
  (4.x). Previous "Module 3" was overweight at 6 themes; now it's 4+2.
- Generics positioned *after* interfaces (4.2 after 4.1). The structural-
  typing mental shift is the harder one; once interfaces are in, generics
  is mostly TS-familiar syntax.
- Conditionals and loops split into two themes (1.4 + 1.5). The Pass-1
  bullet "Conditionals & loops" did too much work in one theme.
- Module 7 (Idioms) slimmed to 7 themes by deferring `net/http` and
  `encoding/json` deep-dives.

Total: **7 modules, 31 themes**. At 9 exercises per theme (default
slot allocation), that's ~280 exercises end-to-end. Launch gate is
Module 1 only: 6 themes × 9 = 54 exercises.

## What Pass 3 looks like (still pending)

For each theme, break into the 9-slot exercise progression with
concrete TS↔Go content per slot, hints, and notes. Example for
`foundations/variables`:

```
 1. MCQ "let x = 5;" → which Go is idiomatic?              (shipped)
 2. MCQ typed decl "let x: number = 5;" → which Go form?   (shipped)
 3. MCQ "const PI = 3.14;" → which Go preserves const-ness? (shipped, variant kind)
 4. MCQ multi-decl "let a = 1, b = 2;" → which Go form?    (shipped 2026-05-20)
 5. fill-blank-word: produce `name := value` (blanks at op) (shipped)
 6. fill-blank-word: produce `var name int = value`        (shipped, blanks at kw + type)
 7. fill-blank-line: pick the right line for a Go translation (shipped)
 8. fill-blank-line: multi-variable short decl `a, b := 1, 2` (shipped)
 9. freeform: declare three vars from a TS snippet         (shipped)
10. freeform: open problem with type+const+:= constraints  (shipped)
```

(All ten slots above reflect the actual shipped progression in
`src/content/exercises/foundations/variables/`.)

**MCQ-first pedagogy gap — fixed 2026-05-20.** The previous
9-slot progression introduced the multi-declaration shape `a, b
:= 1, 2` as a fill-line at the original slot 7 without any
prior MCQ exposure. Per
[02-pedagogy.md](02-pedagogy.md#introducing-a-new-pattern-rule),
a new MCQ slot was inserted at position 4 introducing the
multi-decl shape as recognition; the old slots 4-9 shifted down
to 5-10. The fill-line that violated the rule now follows the
introducing-MCQ by four slots.

The theme grew from 9 to 10 slots — the rule explicitly permits
this: "Better a slightly longer theme than a learner who has to
guess." A full per-theme audit for "new shape introduced inside
fill-line/freeform without prior MCQ" remains part of Module 1's
pre-launch QA and is applied to every Module 2+ theme as it lands.

Pass 3 is per-theme work; doesn't have to land all at once. Each theme's
Pass 3 lives in `design-docs/lessons/<module>/<theme>.md` (planned —
not yet a directory).
