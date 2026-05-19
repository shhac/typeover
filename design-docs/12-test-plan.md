# 12 — Test plan

This is the **target test checklist** for when the Vitest setup task (#36)
lands. It's organised by critical path so each test has a clear "what
contract am I pinning?" framing. Not all of it has to land at once —
prioritise determinism + correctness first.

Compiled from the iteration-2 code-structure review's test-coverage lens
findings (2026-05-17). Each item is paired with a one-line "what breaks
if this regresses" so future-us remembers why the test exists.

**Status (2026-05-19):** Vitest is wired (`pnpm test`). **345 tests
live across 29 files** covering: P0 seed determinism, P0 generator
parsing + `generate()` golden cases, all three cellState truth
tables, P1 progress-storage invariants (SSR / malformed /
single-`now()` / corrupt-blob backup), the `useExercisePhase` hook
contract, MCQ / FillBlankWord / FillBlankLineInput / Freeform
component integration tests via `@solidjs/testing-library`,
`useYaegiRun` lifecycle, theme/density/radius helpers,
`summarizeTheme`, and the DS-layer primitives `<Eyebrow>` /
`<Compare>` / `<ProgressChip>` / `<HintButton>` / `<RevealButton>`.
Route/page smoke tests are still pending; axe-core a11y runs at the
DS layer via `src/a11y.test.tsx`.

## P0 — Determinism chain *(must land first)*

These pin the contract that makes "Try again with the same instance"
and "deterministic exercise URL" work at all.

### `src/lib/seed.ts`

- **`xmur3("")`** — empty input still hashes (regression for "I'll just
  add a length check"); breaks the only-on-empty path of `rngFromSeed`.
- **`rngFromSeed("ex-001::0")`** — golden test of the first 5 floats.
  Locks the contract that any future refactor of `xmur3`/`mulberry32`
  doesn't silently reshuffle every learner's saved progress.
- **`pickFrom(rng, [])`** — throws.
- **`shuffle(rng, [])`** — returns `[]` (currently silent; document
  expected behaviour either way).
- **`shuffle(rng, [x])`** — returns `[x]` (no swaps).

### `src/lib/generator.ts`

- **`substitute("hi ${name}", { name: "go" })`** → `"hi go"`.
- **`substitute("$name", ...)`** — only `${name}` form is substituted;
  bare `$name` is left alone.
- **`substitute("${x}", {})`** — throws with the var name in the
  message.
- **`substitute("${x} ${x}", { x: "v" })`** → `"v v"` (multiple
  occurrences of same var).
- **`substitute` with regex-special chars in value** — `{ x: "$&" }`
  is rendered literally (the current replacement uses a function form
  so this is safe today; a switch to string-replacement would break
  it silently).
- **`buildShuffledOptions(rng, "ans", [])`** — returns
  `{ options: ["ans"], correctIndex: 0 }`.
- **`buildShuffledOptions` with all distractors === canonical** — dedupe
  collapses to length-1 options.
- **`buildShuffledOptions` with one distractor === canonical** — that
  distractor is dropped; others remain; `correctIndex` still points to
  the canonical.
- **Same seed → same shuffle** across two calls.
- **`generate(template, seed)`** — golden fixture for a hand-written
  spec + seed → known `{ts, canonical, options, correctIndex}`. Pin
  the full output, not just shapes.
- **`generate({kind:"variant"}, seed)`** — golden fixture for the
  shipped `foundations/variables/03.yaml` ("PI" variant — `id: pi`,
  `const PI = 3.14`) with a known seed → known
  `{ts, canonical, options, correctIndex}`. Pin the full output.
  (Six themes now ship a `03.yaml`; the test must reference the
  explicit path so it doesn't drift as more exercises land.) The
  variant path has its own RNG-consumption pattern (`pickFrom` over
  variants, then another shuffle inside `buildShuffledOptions`); a
  regression here would silently reshuffle which variant a learner
  sees on a given seed.
- **Same `(variant-spec, seed)` → same chosen variant** across calls.
  Determinism guard against a future "use a different RNG for variant
  pick" regression.
- **`generateVariant` with `distractors: undefined` or `[]`** —
  returns no `options`/`correctIndex` (mirrors the template-with-no-
  distractors case).
- **`generateVariant` with two variants sharing the same
  `canonical` but different `ts`** — the seed still picks one
  stably. Covers the easy authoring mistake of near-duplicate
  variants.
- **`generate(variantSpec, seed, { blanks: ["x"] })`** — throws
  with `"variant"` in the message. Pinned safety guard from
  iter-5 commit `f3072a7`.
- **`generate(variantSpec, seed, { blanks: [] })`** — does *not*
  throw. The guard checks `length > 0`, not just truthy. Pinned
  so the route's `blanks: ex.blanks ?? []` default keeps working
  for MCQ variants.
- **`generate({kind:"procedural"}, ...)`** — throws the
  "not implemented" message.
- **Template with `distractors: []`** — returns no `options`/
  `correctIndex` fields (the MCQ wouldn't render).

## P1 — Progress storage

The progress blob is the only thing protecting "you've passed 47 of 54
exercises" from corruption. The `summarizeTheme` aggregator
(`progress.summarize.test.ts`, *landed 2026-05-19*) pins the shared
"theme complete" predicate that both `ModuleCompleteCard` and
`<ProgressChip>` consume, so the two surfaces can't disagree on
whether a theme reads as done.

### `src/lib/progress.ts`

- **SSR path** — when `localStorage === undefined`, every recorder is a
  no-op and doesn't throw.
- **`read()` with malformed JSON** in storage → returns `empty()`
  without throwing.
- **`read()` with `version: 2` payload** → returns `empty()` (current
  behaviour: silent data loss; task #37 may revisit but at minimum this
  should be pinned).
- **`read()` with `{ version: 1 }` and missing `exercises` field** →
  returns `empty()`. Zod schema rejects the payload (since `exercises`
  is required); the raw value is backed up to
  `typeover:progress:corrupt-<ts>`.
- **Corrupt-blob backup (task #37 — landed)** — when storage holds a
  non-null payload that fails Zod validation (invalid JSON, schema
  mismatch, corrupt slot), `read()` copies the raw value to
  `typeover:progress:corrupt-<iso>` before returning `empty()`.
  - **No backup** when storage is empty (null raw).
  - **No backup** on the SSR path (no `localStorage`).
  - Pinned per design-docs/99 — a learner never silently loses
    history; a future migration / forensic pass can recover.
- **`bumpExercise` idempotency of slot creation** — calling
  `recordInstanceSeen("x")` on a fresh blob creates the slot with
  `firstSeenAt` set; calling again preserves `firstSeenAt`, advances
  `lastSeenAt`, increments `instancesSeen`.
- **`lastSeenAt` advances on every recorder** including
  `recordHintUsed` (the latent bug fixed in iter-1 — pin it so it
  doesn't reappear).
- **Sequential counter accumulation** — `seen` + `pass` + `seen` again
  results in `instancesSeen: 2, instancesPassed: 1`.
- **Single `now()` per bump (iter-18)** — after any `record*` call,
  `progress.exercises[id].lastSeenAt === progress.lastSeenAt`
  (byte-equal string compare). Pins commit `73bdbdc`'s contract that
  `bumpExercise` is the single timestamp authority and the two
  fields stay in sync; catches a future "convenient" extra
  `now()` call in `write()` or a recorder.
- **`write()` is a pure serializer** — construct a `Progress` with a
  fixed `lastSeenAt`, call `write()` (via a test-only re-export),
  re-read from storage, confirm `lastSeenAt` equals the input.
  Pins the iter-18 doc-contract at `progress.ts:51` so a future
  refactor can't quietly turn `write()` back into a hidden mutator.

## P0 — Fill-blank segment building

Added 2026-05-18. The `buildBlankSegments` walker is now the single
source of truth for `${var}` parsing (substitute is implemented in
terms of it). Tests pin the placeholder grammar in one place.

### `src/lib/generator.ts` — `buildBlankSegments`

- **Basic case** — `buildBlankSegments("name = ${value}", { value: "42" }, ["value"])`
  → `[{kind:"text", text:"name = "}, {kind:"blank", varName:"value", expected:"42"}]`.
- **Vars not in `blanks`** substitute as text: `("${a} = ${b}", {a:"x", b:"1"}, ["b"])`
  → `[text:"x", text:" = ", blank:"b" expected:"1"]`.
- **Same blank var twice** — `("${x} + ${x}", {x:"v"}, ["x"])` produces
  **two** independent blank segments with the same `varName`/`expected`.
  Pins the contract that FillBlankWord's per-occurrence input slots rely on.
- **Adjacent placeholders, no text between** — `"${a}${b}"` doesn't
  emit a zero-length text segment (cursor guard).
- **Leading placeholder** — `"${a}"` produces one segment, no
  zero-length text before.
- **Trailing placeholder** — `"${a}y"` produces blank + " y" text.
- **Unknown var** — `buildBlankSegments("${gone}", {}, [])` throws
  with `gone` in the message.
- **Empty `blanks` array but template has vars** — every `${...}`
  substitutes to a text segment; output has no blank segments. (This
  is the path `substitute` takes; if it regresses, every template
  exercise breaks.)
- **Empty canonical** — returns `[]`.

## P1 — Exercise lifecycle (shared)

Added 2026-05-18. The `useExercisePhase` hook is now the lifecycle
authority for MCQ, FillBlankWord, FillBlankLineInput, and (when it lands)
Freeform. One set of tests covers the contract for all of them.

### `src/lib/exercise-phase.ts` — `useExercisePhase`

- **Handle surface** — `Object.keys(useExercisePhase(args))` returns
  exactly `["submitted", "revealed", "current", "canSubmit",
  "submit", "tryAgain", "nextInstance", "revealCorrect"]` (in some
  order). A snapshot pins the public API of `ExercisePhaseHandle`
  so a silent field rename (e.g. someone restoring `phase` over
  `current`) or accidental new field surfaces in the diff. The
  `canSubmit` field is the same accessor passed in as `args.canSubmit`
  — re-exposed by the handle so the shell's disable-state and the
  hook's submit-guard read one source of truth.
- **Initial state** — `submitted` false, `revealed` false,
  `current()` returns `"picking"`.
- **`submit()` with `canSubmit` false** — no-op; state unchanged.
- **`submit()` with `isCorrect` true** — `submitted` becomes true,
  `current()` returns `"right"`, `recordInstancePassed(exerciseId)`
  called once.
- **`submit()` with `isCorrect` false** — `submitted` becomes true,
  `current()` returns `"wrong"`, **`recordInstanceFailed` NOT called**
  (failure is only recorded via `revealCorrect`).
- **`submit()` after already submitted** — no-op; no second progress
  call.
- **`tryAgain()`** — resets `submitted` + `revealed`, calls
  `onTryAgain` if provided. No progress recording.
- **`nextInstance()`** — resets `submitted` + `revealed`, calls
  `onAnother` exactly once. No progress recording.
- **`revealCorrect()`** — sets `revealed` true,
  `recordInstanceFailed(exerciseId)` called once.
- **Recorded-pass asymmetry** — pin the behaviour: a learner who
  submits wrong, clicks "Try again", then submits correct is counted
  as `passed` (not `failed`). Wrong submits are only counted as
  failed when the learner reveals.

## P1 — MCQ correctness

The component that decides whether a learner passed.

### `src/components/exercise/McqOption.tsx`

- **Truth table for `optionCellState`** — 16 rows covering all combinations
  of `{selected, submitted, revealed, isCorrect}`. Critical rows:
  - `revealed && !selected && isCorrect` → `showCorrect` (reveal flow)
  - `revealed && selected && !isCorrect` → `neutral` (the picked-but-
    wrong option is NOT styled wrong on reveal — only the canonical is)
  - `submitted && !selected && !isCorrect` → `neutral` (sibling options
    after wrong submit are not highlighted)
  - `submitted && !selected && isCorrect` → **`neutral`** (the canonical
    is NOT auto-revealed on wrong submit — learner-controls-reveal per
    design-docs/06-voice-and-feedback.md. Fixed iter-6; the old
    behaviour returned `showCorrect` here and spoiled the answer.)
  - `submitted && selected && isCorrect` → `showCorrect`
  - `submitted && selected && !isCorrect` → `showIncorrect`
  - **Re-export `optionCellState`** as a Phase-1 micro-extraction so the
    truth-table test can target it directly.

### `src/components/exercise/Mcq.tsx`

Component-level test via `@solidjs/testing-library`. Cover the
phase-transition contract:

- **Happy path** — render → select correct → submit → phase becomes
  "right" → `recordInstancePassed` called exactly once → "Another"
  advances the seed and resets to "picking".
- **Wrong path** — render → select wrong → submit → phase becomes
  "wrong" → three buttons visible (Try again / Different exercise /
  Reveal correct) → "Try again" resets without recording.
- **Reveal flow** — wrong submit → click "Reveal correct" →
  `recordInstanceFailed` called exactly once → the canonical option
  styles to `showCorrect` → "Reveal correct" button disappears.
- **Hint usage tracked** — clicking the hint button increments
  `hintsUsedTotal` on the right exercise ID, three times max.

**Asymmetry to either pin or fix:** a learner who submits wrong, clicks
"Try again," then submits correct gets counted as `passed`. The first
wrong submit is *not* counted as `failed` (only `Reveal correct` does
that). This is by design today — Lens 5 flagged it as worth a test +
design conversation. Pin behaviour OR change it, but don't leave it
silent.

## P1 — FillBlankLine correctness (input + Yaegi grading)

*Retired 2026-05-19.* The MCQ-as-tile UX with its `tileState` truth
table is gone — all 12 fill-line exercises migrated to the
input+Yaegi grading model and the legacy `FillBlankLine.tsx` +
`CandidateTile.tsx` (and their truth-table tests) were removed in
the /improve-code-structure dead-code sweep.

The new surface is `src/components/exercise/FillBlankLineInput.tsx`.
It composes `useYaegiRun` (the shared hook covered by
`src/lib/use-yaegi-run.test.ts`) with `substituteAtBlank` (covered
by `src/lib/fill-blank.test.ts`). **Component-level integration
tests landed 2026-05-19** — `FillBlankLineInput.test.tsx` mocks
`~/runtime` (same pattern as `use-yaegi-run.test.ts`) and pins the
contract end-to-end through the real progress chain. Sister suite
`Freeform.test.tsx` lands the same coverage for freeform (scaffold
seed, happy / wrong / reveal / Another-resets-scaffold).

Pinned scenarios:

- Happy path: type the canonical line → Run → stdout match → Submit
  records pass once → input locks in the right phase.
- Wrong path: stdout mismatch → three wrong-phase buttons surface,
  no pass and no fail recorded (asymmetry pinned by useExercisePhase).
- Reveal: explicit reveal records failure exactly once.
- canSubmit gate: empty input + running flag both keep Submit
  disabled.
- Enter-to-Run: triggers `run()` only when input is non-empty and
  not currently running.
- `another()`: clears input AND runResult.

## P1 — FillBlankWord correctness

Added 2026-05-18. The component's per-blank match + `allCorrect` +
`allFilled` predicates decide pass/fail and gate the submit button.

### `src/components/exercise/FillBlankWord.tsx`

- **Happy path** — render with two blanks, type the expected values
  into both inputs, submit → `recordInstancePassed` called once,
  phase becomes `right`, inputs lock (per `phase.current() === "right"`),
  "Another" button visible.
- **Partial fill** — only one of two blanks filled → submit button
  disabled (`allFilled()` false).
- **Wrong submit** — one blank wrong → phase `wrong`, three buttons
  visible (Try again / Clear / Different exercise / Reveal correct).
- **"Same var twice" determinism** — canonical `"${x} == ${x}"` with
  `blanks: ["x"]`: typing the correct value into only one of the
  two inputs leaves submit disabled; filling both makes the inputs
  pass independently.
- **Vacuous-truth guard (`blanks: []`)** — an exercise authored
  with `blanks: []` cannot be submitted. `allFilled()` returns
  false explicitly when there are no blank positions; the submit
  button stays disabled. (Iter-4 fix; was a real auto-pass bug.)
- **Reveal flow** — submit wrong → click "Reveal correct" →
  `recordInstanceFailed` called once, inputs gain correct/error
  styling via `inputCellState` `revealed` states, "Reveal correct"
  button disappears.
- **Clear** — clicking "Clear" empties all inputs and resets
  `submitted`/`revealed`. Available in both picking and wrong phases.

### `src/components/exercise/BlankInput.tsx` — `inputCellState`

- **Truth table** — for every combination of `{value === expected,
  submitted, revealed}`, the returned state matches the documented
  contract:
  - `!submitted && !revealed` → `neutral` (regardless of value match).
  - `submitted && !revealed && match` → `correctSubmitted`.
  - `submitted && !revealed && !match` → `incorrectSubmitted`.
  - `revealed && match` → `correctRevealed`.
  - `revealed && !match` → `incorrectRevealed`.
- **Export `inputCellState`** as a Phase-1 micro-extraction (same
  as `optionCellState` for MCQ) so the truth-table test can target it
  directly without rendering Solid components.

## P2 — Route dispatch

Added 2026-05-18.

### `src/pages/go/[module]/[theme]/[index].astro`

- **MCQ branch** mounts `<Mcq>` with the right props.
- **fill-word branch** mounts `<FillBlankWord>` with `blanks` defaulted
  via `?? []` when the YAML omits it.
- **fill-line branch** mounts `<FillBlankLineInput>` (input + Yaegi
  grading) when `expectStdout` is set and `runtime === "yaegi"`,
  with `blanks` defaulted via `?? []`. The pre-redesign tile-picker
  branch was retired in the /improve-code-structure pass after all
  12 fill-line exercises migrated.
- **freeform branch** mounts `<Freeform>` when `expectStdout` is set
  and `runtime !== "none"`.
- **Exhaustiveness guard (iter-5)** — the frontmatter declares
  `_exhaustiveExerciseType: Record<typeof ex.type, true>`. Adding
  a fifth value to `content.config.ts`'s `z.enum(["mcq", "fill-word",
  "fill-line", "freeform"])` without a key here fails `astro check`
  / `tsc --noEmit`. Pin via a type-only "expect-error" test once
  Vitest lands.

## P1 — `useExerciseInstance` hook

The seed → instance → record bridge that all exercise types depend on.

### `src/lib/exercise-instance.ts`

- **Determinism** — same `(exerciseId, attempt)` produces the same
  `instance.ts` across re-renders and across full unmount/remount.
- **`another()` advances seed exactly once** — `n` calls produce `n+1`
  distinct seeds and `n+1` `recordInstanceSeen` calls (spy on
  `progress`).
- **Side effect in `createEffect`, not `createMemo`** — the regression
  guard that locks in the iter-1 refactor. Test that double-mounting
  the hook with the same exerciseId doesn't double-count
  `instancesSeen`.

## P2 — Content schema

Cheap to write, catches authoring drift before it hits a PR.

### `src/lib/content-schema.ts`

Schemas moved out of `content.config.ts` so they're testable under
vitest (Astro's `astro:content` import isn't available outside the
Astro runtime).

Field-shape rejections (built into the base `z.object`):

- **MCQ exercise with `hints: ["one", "two"]`** — rejected (hints is a
  tuple of 3).
- **Exercise with `order: 0`** — rejected (positive int constraint).
- **Exercise with unknown `type`** — rejected.

Cross-field rejections (task #38 — landed; `content-schema.test.ts`):

- **Empty value pool** `vars: { x: [] }` → rejected; issue path
  `vars.x`. Pinned per `Template generator empty pool` test.
- **Undeclared placeholder** `ts: "${y}"` with `vars: { x: [...] }` →
  rejected; issue path `ts` (or `canonical` / `distractors.N`); error
  message contains `${y}`.
- **Variant generator with `variants: []`** → rejected.
- **Duplicate variant IDs** → rejected; issue path
  `variants.<dup-index>.id` and the error message names the prior
  index.
- **`fill-word` / `fill-line` without `blanks`** → rejected; issue
  path `blanks`. Prevents the iter-4/6 vacuous-truth auto-pass bug.
- **`fill-word` / `fill-line` with a variant generator** → rejected
  with `generator.kind` path (variant kind doesn't produce
  `blankSegments`).
- **Blank name not declared in `generator.vars`** → rejected with
  `blanks.<i>` path.
- **MCQ template with `distractors: []`** → rejected with
  `generator.distractors` path. Without this an MCQ renders as a
  single-option "quiz".
- **MCQ variant with any variant missing `distractors`** → rejected
  with `generator.variants.<i>.distractors` path.
- **`blanks` on non-fill type (mcq / freeform)** → rejected (likely
  copy-paste from a fill exercise).

Happy paths:

- Well-formed fill-word, mcq (template & variant), and freeform
  exercises all parse without issues.
- A template with `vars: {}` and no `${refs}` in `ts`/`canonical`
  is accepted (legal-but-boring static exercise).

## P2 — Curriculum tree

Pure function over collection entries; trivial to test in isolation.

### `src/lib/curriculum.ts`

- **`byOrder`** — stable sort key.
- **`truncateIntro` boundary cases** — exactly at limit, under, over,
  whitespace at the cut.
- **`buildCurriculumTree`** — modules sorted by order; themes sorted by
  order within each module; exercises sorted by order within each
  theme; missing themes/exercises produce empty arrays not undefined.

## Setup notes for task #36

When Vitest goes in:

- `@solidjs/testing-library` for component tests; `jsdom` environment.
- A `Map`-backed `localStorage` shim assigned to `globalThis.localStorage`
  before each test; `beforeEach(() => globalThis.localStorage = new Shim())`.
- Test files co-located with the code: `src/lib/seed.test.ts` next to
  `src/lib/seed.ts`. (Astro's content collections won't try to load
  `*.test.ts` from the content tree.)
- `pnpm test` script in `package.json`, plus `pnpm test:watch`.
- Coverage reports optional in v0 — the goal is the contract pin, not a
  number to brag about.

When complete, this doc is preserved as the "what tests cover what
contracts" reference, not deleted.
