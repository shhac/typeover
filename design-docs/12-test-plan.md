# 12 — Test plan

This is the **target test checklist** for when the Vitest setup task (#36)
lands. It's organised by critical path so each test has a clear "what
contract am I pinning?" framing. Not all of it has to land at once —
prioritise determinism + correctness first.

Compiled from the iteration-2 code-structure review's test-coverage lens
findings (2026-05-17). Each item is paired with a one-line "what breaks
if this regresses" so future-us remembers why the test exists.

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
  shipped `03.yaml` "PI" variant with a known seed → known
  `{ts, canonical, options, correctIndex}`. Pin the full output. The
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
- **`generate({kind:"procedural"}, ...)`** — throws the
  "not implemented" message.
- **Template with `distractors: []`** — returns no `options`/
  `correctIndex` fields (the MCQ wouldn't render).

## P1 — Progress storage

The progress blob is the only thing protecting "you've passed 47 of 54
exercises" from corruption.

### `src/lib/progress.ts`

- **SSR path** — when `localStorage === undefined`, every recorder is a
  no-op and doesn't throw.
- **`read()` with malformed JSON** in storage → returns `empty()`
  without throwing.
- **`read()` with `version: 2` payload** → returns `empty()` (current
  behaviour: silent data loss; task #37 may revisit but at minimum this
  should be pinned).
- **`read()` with `{ version: 1 }` and missing `exercises` field** →
  currently crashes downstream at `exerciseSlot`. Either harden read()
  or document this as expected and have a test that reproduces the
  crash so the eventual fix lands deliberately.
- **`bumpExercise` idempotency of slot creation** — calling
  `recordInstanceSeen("x")` on a fresh blob creates the slot with
  `firstSeenAt` set; calling again preserves `firstSeenAt`, advances
  `lastSeenAt`, increments `instancesSeen`.
- **`lastSeenAt` advances on every recorder** including
  `recordHintUsed` (the latent bug fixed in iter-1 — pin it so it
  doesn't reappear).
- **Sequential counter accumulation** — `seen` + `pass` + `seen` again
  results in `instancesSeen: 2, instancesPassed: 1`.

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
authority for MCQ, FillBlankWord, and (when they land) FillBlankLine
and Freeform. One set of tests covers the contract for all of them.

### `src/lib/exercise-phase.ts` — `useExercisePhase`

- **Initial state** — `submitted` false, `revealed` false,
  `phase()` returns `"picking"`.
- **`submit()` with `canSubmit` false** — no-op; state unchanged.
- **`submit()` with `isCorrect` true** — `submitted` becomes true,
  `phase()` returns `"right"`, `recordInstancePassed(exerciseId)`
  called once.
- **`submit()` with `isCorrect` false** — `submitted` becomes true,
  `phase()` returns `"wrong"`, **`recordInstanceFailed` NOT called**
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

## P1 — FillBlankWord correctness

Added 2026-05-18. The component's per-blank match + `allCorrect` +
`allFilled` predicates decide pass/fail and gate the submit button.

### `src/components/exercise/FillBlankWord.tsx`

- **Happy path** — render with two blanks, type the expected values
  into both inputs, submit → `recordInstancePassed` called once,
  phase becomes `right`, inputs lock (per `phase() === "right"`),
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
- **fill-line / freeform branches** render the "not built yet"
  placeholder until #16 / #17 land.
- **Future:** when refactored to an exhaustive `switch` (or a
  `Record<ExerciseType, ComponentFn>` lookup), TS narrowing should
  fail compilation if a new enum value is added without a branch.

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

### `src/content.config.ts`

- **MCQ exercise with `hints: ["one", "two"]`** — rejected (hints is a
  tuple of 3).
- **Exercise with `order: 0`** — rejected (positive int constraint).
- **Exercise with unknown `type`** — rejected.
- **Template generator with no `vars`** — accepted today; once task #38
  lands, rejected.
- **Template referencing `${undeclared}`** — accepted today; once task
  #38 lands, rejected with `${undeclared}` in the error path.
- **Variant generator with empty `variants: []`** — accepted today;
  document whether this should be rejected.

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
