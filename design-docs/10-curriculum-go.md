# 10 — Curriculum (Go target) — Pass 1

This is the **top-level outline** of the Go curriculum, ordered for a TS
developer. Subsequent passes drill each module into themes, then themes
into exercises. We validate at each pass before going deeper.

## Ordering principle

1. Start where TS mental models transfer almost unchanged — build trust
   in the translation pattern.
2. Introduce *one* friction point per module, building up.
3. Group related friction (structs + methods + pointers + interfaces all
   live in one module).
4. Defer Go-native concepts (goroutines, channels, defer, embedding)
   until the bilingual scaffold has paid off — when they arrive, the
   learner is fluent enough to engage with them as pure Go content.

## Modules (Pass 1)

### Module 1 — Foundations *(translates cleanly)*
The "you already know this, just spelled differently" module. Goal: by
the end, the learner trusts that typeover's translation pattern works,
and writing trivial Go feels familiar.

- Variables and types (`:=`, `var`, `const`, type inference)
- Primitives and arithmetic (`int`/`int32`/`int64`, `float64`, no
  implicit conversions)
- Strings, bytes, runes (`fmt.Sprintf` instead of template literals)
- Conditionals and loops (`if/else`, the one-and-only `for`)
- Functions and multiple returns (the first idea TS doesn't quite
  have — tuple-style returns)

### Module 2 — Collections *(translates with wrinkles)*
- Arrays vs slices (`[N]T` vs `[]T`, length vs capacity, `append`,
  `make`)
- Maps (`map[K]V`, comma-ok lookup, iteration order is undefined)
- Iteration (`for-range`, blank identifier `_`)

### Module 3 — Types you define *(the structural shift)*
The biggest mental-model change. TS object literals carry methods; Go
structs don't. Methods are functions with a receiver. Once this clicks,
the rest of Go's type system falls into place.

- Structs (definition, struct literals, zero values, field access)
- Methods (value vs pointer receivers, when each)
- Pointers (`&`, `*`, why and when — the explicit version of "by
  reference")
- Nil (zero value for pointers, interfaces, maps, slices, channels)
- Interfaces (structural like TS, but implicit — no `implements`)
- Generics (`[T any]`, constraints — familiar from TS)

### Module 4 — Errors and packaging *(Go's distinctive conventions)*
- The `(T, error)` return pattern
- `errors.Is`, `errors.As`, error wrapping with `%w`
- Type assertions and type switches
- Packages, imports, and the export-by-capitalisation rule
- Modules and `go.mod`

### Module 5 — Concurrency *(native Go territory — no bilingual crutch)*
- Goroutines
- Channels (unbuffered, buffered, direction)
- Select and common patterns
- Sync primitives (`Mutex`, `WaitGroup`)

### Module 6 — Idioms and ecosystem *(graduating to "real Go")*
- Defer (cleanup, evaluation order)
- Embedding (composition over inheritance)
- Context and cancellation
- Testing (table-driven, `t.Run` subtests)
- Standard library tour (`net/http`, `encoding/json`, `os`, `time`,
  `io`)
- Project layout (`cmd/`, `internal/`, module conventions)
- Common gotchas (loop var capture, nil interface, slice aliasing,
  goroutine leaks)

## Things deliberately *not* in v0

- Reflection (`reflect`). Rarely needed; complicates more than it
  teaches.
- CGo. Different audience.
- Unsafe pointers. Same.
- Go assembly. Same.
- Specific frameworks (gin, echo, etcd, kubernetes). The stdlib tour is
  enough; framework choice is a per-project decision.

## What to validate at this pass

Before drilling Pass 2:

1. **Modules are ordered correctly for a TS dev.** Is "Collections"
   really easier than "Types you define"? Should "Generics" be earlier
   because TS devs already know the concept?
2. **No module is overweight.** Module 3 currently bundles 6 themes —
   may want to split structs+methods from interfaces+generics.
3. **No critical concept is missing.** What did I forget?
4. **The Go-native modules (5, 6) land at the right time.** A learner
   reaching them should already feel fluent in everything earlier.

## What Pass 2 looks like

For each module, break the bullets above into **themes** with rationale,
estimated theme count, and prerequisite chain. Example for Module 1:

```
Theme 1.1: Declaring variables
  - := vs var vs const
  - Type inference
  - Shadowing rules
  prerequisites: none

Theme 1.2: Primitive types
  - Integer types (int, int32, int64, uint*)
  - Floating point (float32, float64)
  - bool, byte
  - No implicit conversion
  prerequisites: 1.1

...
```

Pass 3 then breaks each theme into the 9-slot exercise progression with
concrete TS↔Go content per slot.
