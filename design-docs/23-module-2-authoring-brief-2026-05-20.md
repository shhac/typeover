# 23 — Module 2 (Collections) authoring brief

Module 1 (Foundations) ships 58 exercises across 6 themes. Module 2
(Collections) is the next authoring push. Three themes per
[`10-curriculum-go.md`](10-curriculum-go.md):

- **2.1** `collections/arrays-and-slices`
- **2.2** `collections/maps`
- **2.3** `collections/iteration`

Three lens-grounded research agents (one per theme) read the
official Go docs (go.dev/blog, go.dev/ref/spec, gobyexample.com)
and the existing typeover authoring style, then proposed 9-10
slot progressions. This doc is the synthesis — the canonical brief
the next authoring session works from. **Not exercise YAMLs yet**;
those land per-slot in `src/content/exercises/collections/*/*.yaml`
when Paul is ready to anchor the pedagogy decisions.

## Source material

Three subagent transcripts:
- `tmp/.../tasks/<a>` — arrays + slices research
- `tmp/.../tasks/<b>` — maps research
- `tmp/.../tasks/<c>` — iteration research

Sources cited across all three: go.dev/blog/slices-intro,
go.dev/blog/slices, go.dev/blog/maps, go.dev/blog/strings,
go.dev/blog/range-functions (Go 1.23 iter), the spec sections on
Array/Slice/Map types and `for-range`, plus gobyexample's
arrays/slices/maps/range/range-over-iterators pages.

## Module-level arc

The Module 1 → Module 2 progression is **"types you already think
you know, but the surface lies."** A TS dev arrives with
`number[]`, `Record<string, V>`, and `for…of` — and each one maps to
a Go shape that diverges in a way that bites silently.

| theme | central surprise |
|---|---|
| 2.1 slices | slicing returns a **view**, not a copy — mutations leak through `[a:b]`. `make` separates length from capacity. `append` returns; you must assign back. |
| 2.2 maps | missing-key lookup returns the **zero value**, not `undefined`. Comma-ok is the antidote. `delete`/`len` are builtins, not methods. Nil-map writes panic; reference semantics mean callees mutate caller state. |
| 2.3 iteration | `range` on a string yields **byte indices + rune values** (the byte index *skips* over multi-byte runes). One-variable `range` means index on a slice but key on a map. |

Each theme picks 9-10 slots that drill one divergence per slot,
following the introducing-a-new-pattern rule from
[`02-pedagogy.md`](02-pedagogy.md) (MCQ-first for every novel
shape) and the bilingual-phrasebook contract (every prompt names
the TS shape the learner already knows).

## Theme 2.1 — `collections/arrays-and-slices` (10 slots)

Central reality: **`[]T` (slice) is what you use; `[N]T` (array)
is what slices are built on**. The separation leaks into function
calls, `append`, and aliasing.

| # | type | concept | TS side | Go canonical | distractor that teaches against |
|---|---|---|---|---|---|
| 1 | MCQ | slice literal `[]T{...}` vs array literal `[N]T{...}` | `const xs = [1,2,3]` | `xs := []int{1,2,3}` | `xs := [3]int{1,2,3}` — compiles but locks length into type |
| 2 | MCQ | `[N]T` fixed-size; zero value is the zeroed buffer | TS tuple `[number, number, number, number]` | `var digest [4]int` | `var digest []int` (nil slice, not 4 zeros) |
| 3 | MCQ | `make([]T, n)` for a sized slice | `new Array<number>(5).fill(0)` | `make([]int, 5)` | `[]int{5}` — one-element, not five |
| 4 | MCQ | `make([]T, len, cap)` — capacity ≠ length | `// reserve 100, start empty` | `make([]int, 0, 100)` | `make([]int, 100)` — length 100, not capacity |
| 5 | fill-word | `append` is a builtin, returns; must assign back | `xs.push(4)` | `xs = append(xs, 4)` | `xs.append(4)` / `append(xs, 4)` (drops return) |
| 6 | fill-word | slicing `s[a:b]` with omitted defaults | `xs.slice(0, 3); xs.slice(3)` | `xs[:3]; xs[3:]` | filling `0` / `len(xs)` explicitly |
| 7 | fill-line | aliasing: slicing shares storage; `copy` breaks the share | `xs.slice(1,4)` (independent in TS) | `make + copy(ys, xs[1:4])` | `ys = xs[1:4]` (aliases — mutation leaks) |
| 8 | fill-line | pass-by-value: array copies, slice header shares | TS array always shares | `func zero(xs []int)` | `xs [3]int` (would copy, mutation lost) |
| 9 | freeform | `append` loop — bread-and-butter builder | `for-push` building `evens(n)` | `make + for + append` | (graded by stdout match) |
| 10 | freeform | `slices.Contains` from stdlib (Go 1.21+) | `names.includes("alan")` | `slices.Contains(names, "alan")` | TS-style method (`names.contains(...)`) |

**Forward-reference clean.** Every novel shape (slice literal,
`[N]T`, `make`, `make(_,len,cap)`, `append`, slicing, `copy`,
slice-as-param, `slices.*`) gets MCQ or fill-word exposure before
any later slot demands productive use.

**Out of scope (deferred):** 3-index slice form `s[a:b:c]`, nil-vs-
empty as its own slot (lives as distractor explainer in slot 2),
multi-dimensional slices, `slices.Sort` / `slices.Index` (mentioned
only in slot 10's canonical comment).

## Theme 2.2 — `collections/maps` (10 slots)

Central reality: **missing keys return the zero value**, which is
indistinguishable from a present-but-zero value. Comma-ok lookup
is the load-bearing idiom. `delete`/`len` are builtins. Nil maps
panic on write.

| # | type | concept | TS side | Go canonical | distractor |
|---|---|---|---|---|---|
| 1 | MCQ | declaring a map type — `make(map[K]V)` | `const counts: Record<string,number> = {}` | `counts := make(map[string]int)` | `counts := map[string]int` (type, not value) |
| 2 | MCQ | map literal with initial entries | `const ages = {alice:30, bob:25}` | `ages := map[string]int{"alice":30,"bob":25}` | `ages := {"alice":30,"bob":25}` (no type) |
| 3 | MCQ | **missing-key returns zero value** (the trap) | `scores["nope"] // undefined` | `v := scores["nope"]` evaluates to `0` | `v == nil`, runtime panic, compile error |
| 4 | MCQ | comma-ok lookup for presence | `k in scores` / `scores[k] !== undefined` | `v, ok := scores[k]; if ok { ... }` | `scores[k] != 0` (false negative for present-zero) |
| 5 | fill-word | `delete(m, k)` is a builtin, not a method | `delete scores[name]` | `delete(scores, name)` | `scores.delete(name)` |
| 6 | fill-word | `len(m)` for size (uniform with slices/strings) | `Object.keys(s).length` | `len(scores)` | `scores.size` / `scores.length` |
| 7 | fill-line | comma-ok in productive use | `getScore(name) { return scores[name] ?? -1 }` | `if v, ok := scores[name]; ok { return v }; return -1` | present-zero bug |
| 8 | fill-line | nil-map write panics; `make` fixes it | TS habit lets bare declaration work | `m = make(map[string]int)` | `m := make(...)` (re-declares, shadows) |
| 9 | freeform | word-count: end-to-end (`make`, write, increment, `len`) | `counts[w] = (counts[w] ?? 0) + 1` | `counts[words[i]]++` works because zero+1 | (graded by stdout) |
| 10 | freeform | reference semantics: callee mutates caller's map | TS analog: object param sharing | `clearScore(m, name)` mutates outside | `clearScore` taking pointer (overkill) |

**Audit flag carried from research**: slot 8's nil-map panic is a
novel runtime behavior arriving as fill-line; slot 1's distractor
explainer pre-introduces the nil-map shape with a callout. Slot 10's
reference semantics is preceded by a one-line callout in slot 9's
hints. Cheaper than a 10th MCQ.

**Out of scope:** map iteration order (deferred to 2.3's range
slots), comparable-keys-only constraint (mentioned in slot 1's
hint, not its own slot).

## Theme 2.3 — `collections/iteration` (10 slots)

Central reality: **the same `range` keyword produces different
shapes per collection type**, and ranging a string yields
byte-indices + rune values (the byte index *skips* over multi-byte
runes).

| # | type | concept | TS side | Go canonical | distractor |
|---|---|---|---|---|---|
| 1 | MCQ | `for i, v := range s` — two-value over a slice | TS `for (let i=0; i<nums.length; i++)` | `for i, v := range nums { ... }` | `for v, i := range nums` (TS-forEach order) |
| 2 | MCQ | value-only via blank `_` | `for (const n of nums)` | `for _, n := range nums { ... }` | `for n := range nums` — the trap: gives INDEX, not value |
| 3 | MCQ | index-only over slice (one-value form) | `for (let i=0; i<items.length; i++)` | `for i := range items { ... }` | `for _, i := range items` (swap) |
| 4 | MCQ | `range` over map: `for k, v := range m` | `for ([k,v] of Object.entries(prices))` | `for k, v := range prices { ... }` | `for v, k := range prices` |
| 5 | MCQ | one-value `range` over a map yields the **key** | `for (const k of Object.keys(cache))` | `for k := range cache { ... }` | `for _, k := range cache` (gives the value!) |
| 6 | fill-word | sum a slice (productive `_` + range) | `for-of` sum | `for _, n := range nums { sum += n }` | `i` instead of `_` |
| 7 | fill-word | map keys+values printout (order reinforcement) | `Object.entries` foreach | `for k, v := range kvs { ... }` | reversed `v, k` |
| 8 | fill-line | **string ranging: byte-index + rune** | `for (let i; i<s.length; i++) charCodeAt(i)` | `for i, r := range s { ... }` | `for i, b := range []byte(s)` — different output for multi-byte |
| 9 | fill-line | loop-var scoping (Go 1.22+ fix; historical-context) | `for-of with closure capture` | `for _, x := range xs { ... }` (each iter gets fresh `x`) | old `x := x` shadow workaround |
| 10 | freeform | rune-aware string reverser (capstone) | `[...s].reverse().join("")` | `r := []rune(s); swap i,j` | byte-reverse via `[]byte(s)` (mojibake on multi-byte) |

**The headline beat**: slot 5's note reminds learners that
one-value `range` means index on a slice but key on a map. This is
the single most confusable cross-type asymmetry in the theme.
Slot 8 builds on it: same keyword, third shape, third semantics.

**Hidden-test capstone** (slot 10): the reverser is graded against
ASCII (`"hello"`), accented (`"héllo"`), CJK (`"日本語"`), empty, and
single rune. Byte-loop submissions pass ASCII but fail the rest,
so the test set itself enforces the lesson.

**Out of scope (deferred):**
- `range func` (Go 1.23 `iter.Seq`) — advanced topic, save for a
  later module.
- Ranging over channels — covered in Module 6 (concurrency).
- `range over int` (Go 1.22 — `for i := range 10`) — could land
  here, but defer to a Module 1.5 follow-up if pedagogy decides
  it belongs with the `for` axis.

## Headline divergences this module captures

Across all three themes the module forces three habit changes:

1. **Reference-shared types act like reference-shared types.**
   Slices are headers over shared backing arrays; maps are
   reference values. Mutations through aliases / parameters /
   loop captures are real and visible.
2. **Builtins, not methods.** `append`, `len`, `delete`, `copy`,
   `make` are all top-level functions, not method calls on the
   collection. TS dev reflexes for `xs.push`, `m.size`,
   `m.delete(k)` get retrained slot-by-slot.
3. **Zero values are the absence signal.** Missing map keys
   return the type's zero value, not `undefined`. The comma-ok
   spine in theme 2.2 (slots 3 → 4 → 7) drills the antidote.

## Authoring plan

The infra is ready:
- `pnpm content:new theme collections/<theme>` stamps 9 valid
  exercise stubs (per `09-authoring.md`).
- `pnpm content:lint` validates the graph layer.
- `pnpm runtime:verify --filter collections/<theme>` runs every
  fill-line + freeform canonical through Yaegi.
- The Zod schema in `src/lib/content-schema.ts` rejects malformed
  YAML before build.

Recommended sequence (per `02-pedagogy.md` and previous module
authoring experience):

1. **Theme 2.1 first** — slices are the most-foundational; 2.2
   and 2.3 both reference slice types. Author end-to-end (10
   slots), `runtime:verify --filter collections/arrays-and-slices`
   green before moving on. Estimated 4-6 hours of focused
   authoring per the design-docs/20 estimates.
2. **Theme 2.2 second** — depends only on 1.1 (syntax) + 2.1
   (slice primer). Map specifics are independent.
3. **Theme 2.3 last** — depends on 2.1 + 2.2 so all slice/map
   types are available as canonicals. Slot 10 (reverser) is the
   capstone; hidden tests catch byte-loop bugs.

Per-slot the workflow is:
1. Draft prompt + TS-side example.
2. Write Go canonical; `runtime:verify` confirms it runs.
3. Write 3 distractors that fail in distinct ways; the wrong-
   pattern explainer captures the teaching beat per
   `99-open-questions.md` (targeted wrong-pattern feedback —
   fill-line YAMLs in Module 1 use the `{match, explain}` shape).
4. Write 3-layer hints (conceptual → structural → near-answer).
5. Add 1-2 notes for the author (rarely surfaced to learners).

**Estimated total: ~15-30 focused authoring hours across the three
themes**, matching the design-docs/99 entry on Module 2 velocity.

## What's NOT in this brief

- Concrete YAML drafts. Those land per-slot when Paul is at the
  keyboard or in a paired session — pedagogy quality is human-
  judgement work, not Claude-autonomous.
- Distractor explainer copy for every slot. The brief names the
  load-bearing wrong-pattern per slot; the prose ("Use := inside
  a function" etc.) is written at authoring time.
- Hint copy. Conceptual / structural / near-answer sketches are
  in the per-theme research transcripts; final voice is written
  during authoring.
- Notes / metadata. Author-facing distractor rationale per
  `foundations/variables/01.yaml`'s pattern.

## Decisions (locked with Paul, 2026-05-20)

1. **Slot count** — overrun is fine when content earns it.
   Three themes at 10 slots = 30 exercises (vs the 27 default);
   each +1 has been justified. Trigger for splitting a theme
   into theme + theme-advanced: roughly **2x the target**
   (≥18 slots). All three Module 2 themes stay well under that.
2. **`range over int`** (Go 1.22 `for i := range 10`) — **add
   to theme 2.3**. Best Go practice treats it as a natural part
   of the iteration vocabulary alongside slice/map/string range.
   Lands as a new MCQ slot — see updated 2.3 below (now 11
   slots).
3. **`slices.Sort` and `slices.Index`** — **own slot**, added
   to theme 2.1 (now 11 slots). The `slices` package is the
   ecosystem's pivot from methods to package functions; one
   capstone slot per primary operation drives the pattern home.
4. **Distractor shape** — use `{match, explain}` from day 1 on
   every fill-line slot. Best practice; module 1's back-fill
   experience proved the explainer copy is the load-bearing
   teaching beat (per design-docs/99 wrong-pattern entries).

Updated slot counts:

| theme | original | locked |
|---|---|---|
| 2.1 arrays-and-slices | 10 | **11** (added `slices.Sort` / `Index` slot) |
| 2.2 maps              | 10 | **10** |
| 2.3 iteration         | 10 | **11** (added `range over int`) |

Module 2 total: **32 exercises** across 3 themes.

## Slot additions from decisions #2 and #3

### Theme 2.1 — add slot 11 (fill-line or freeform): `slices.Sort` + `slices.Index`

- **Concept:** The two next most-common `slices.*` operations after
  `Contains`. Sort in place, find an index.
- **TS:** `xs.sort((a,b) => a-b); xs.indexOf(7);`
- **Go canonical:**
  ```go
  xs := []int{3, 1, 7, 4, 1}
  slices.Sort(xs)
  i := slices.Index(xs, 7)
  fmt.Println(xs, i)
  ```
- **Expected stdout:** `[1 1 3 4 7] 4`
- **Key teaching beat:** `slices.Sort` mutates in place (returns
  nothing); `slices.Index` returns `-1` if not present — mirrors
  the TS `indexOf` contract, which is friendly.
- **Distractors:** `xs = slices.Sort(xs)` (Sort returns nothing —
  this assigns the empty value); `slices.Sort(xs, less)` (Sort is
  built-in-comparable; only `SortFunc` takes a comparator);
  `slices.IndexOf` (TS-style name).

### Theme 2.3 — add slot 6 (MCQ): `range` over an integer

- **Concept:** `for i := range 10` iterates `0..9`. Go 1.22+
  feature; the modern way to write a count-up loop.
- **TS:** `for (let i = 0; i < 10; i++) { ... }`
- **Go canonical:** `for i := range 10 { ... }`
- **Distractors:** `for i := 0; i < range 10; i++` (range as
  expression); `for i in 10 { ... }` (Python); `for i, _ := range
  10 { ... }` (two-value form — int range emits one value).
- **Hints:** (1) Modern Go (1.22+) lets you range an integer
  directly — no upper-bound expression needed. (2) Same `range`
  keyword, one-value form, emits the loop counter `0..N-1`.
  (3) `for i := range 10`.

The renumbering for theme 2.3 shifts every subsequent slot by 1
(old slot 6 becomes slot 7, etc.). Net: 11 slots, headline
divergences unchanged.

## Authoring plan (updated)

The infra is ready (no change):
- `pnpm content:new theme collections/<theme>`
- `pnpm content:lint`
- `pnpm runtime:verify --filter collections/<theme>`
- Zod schema rejects malformed YAML at build

Recommended sequence (per `02-pedagogy.md`):

1. **Theme 2.1 first** (11 slots, ~5-7h focused).
2. **Theme 2.2 second** (10 slots, ~4-6h).
3. **Theme 2.3 last** (11 slots, ~5-7h, includes string-rune
   freeform capstone).

**Estimated total: ~15-30 focused authoring hours**.

Per-slot workflow remains: draft prompt + TS side → write Go
canonical → `runtime:verify` confirms → 3 distinctly-failing
distractors with `{match, explain}` shape on fill-line → 3-layer
hints → optional author notes.

Once Paul is ready, the recommended next action is
`pnpm content:new theme collections/arrays-and-slices` followed by
a paired slot-by-slot authoring session.

## Authoring complete (2026-05-20)

All three themes authored and shipped:
- 2.1 `collections/arrays-and-slices` — 11 slots (commit `b1134e9`
  series).
- 2.2 `collections/maps` — 10 slots (commit `5c466db`).
- 2.3 `collections/iteration` — 11 slots (commit `35adb5b`).

Total: 32 exercises, 11 runnable canonicals Yaegi-verified, content
lint + build green.

### New infra landed during authoring

- **`successNote` + `alternateCanonicals`** (commit `d2084ac`) —
  schema fields and component plumbing so the grader can accept the
  modern canonical even when Yaegi can't run it, paired with a
  disclosure surface for the learner. First production use: theme
  2.1 slot 11 (`slices.Sort` modern accepted) and theme 2.3 slot 10
  (Go 1.22+ loop-var fix accepted while Yaegi runs pre-1.22).

### Follow-ups / roadmap items surfaced

1. **Multi-input freeform grading.** Theme 2.3 slot 11 (rune-aware
   reverser) wants hidden-test grading against `"héllo"`, `"日本語"`,
   `""`, and single-rune inputs. v0 grader is single-stdout-match,
   so the slot lands with just `"héllo"`. The byte-reverse trap is
   still caught by the `é` mojibake, but the test set could enforce
   it more rigorously. Would need a structured grader (list of
   `(input, expectedStdout)` pairs) in `content-schema.ts` and
   verification loop. Defer to a Module 3+ authoring cycle when
   higher-value freeform exercises appear.
2. **Yaegi upgrade tracking.** `successNote` is a workaround for
   the specific limitations of typeover's vendored Yaegi build
   (no generic stdlib, pre-1.22 loop-var semantics, no `range
   int`). When Yaegi catches up, the `successNote` text in slots
   that use the alternateCanonicals path can be retired and the
   canonical swapped to the modern form. Slots currently flagged:
   `arrays-and-slices/11`, `iteration/10`. Slot `iteration/06`
   stays MCQ (recognition) regardless.
3. **`pnpm content:new` exercise-type defaults.** Stamping
   `iteration` produced 6 stub types that didn't match the brief's
   slot type mix (6 MCQs + 2 fill-words + 2 fill-lines + 1
   freeform vs the script's default 3+2+2+2). Authors currently
   overwrite the `type:` field in each YAML. Cheap improvement:
   the script could accept a `--types mcq:5,fill-word:2,fill-
   line:2,freeform:1` flag to mint stubs matching the brief's
   shape. Defer to next authoring cycle when the pain is fresh.
