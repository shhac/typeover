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
authority for MCQ, FillBlankWord, FillBlankLine, and (when it lands)
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

## P1 — FillBlankLine correctness

Added 2026-05-18 (iter-5/6). Mirrors the FillBlankWord plan with
tile-selection semantics instead of input-field semantics.

### `src/components/exercise/FillBlankLine.tsx`

- **Happy path** — render with N candidate tiles, click the canonical
  → submit → `recordInstancePassed` called once → phase `right` →
  all tiles `locked` (disabled) → "Another" advances seed AND
  reshuffles tile order (via `${seed()}::tiles` RNG namespace).
- **canSubmit gate** — submit disabled until a tile is selected
  (`selected() !== null`).
- **Wrong path** — pick non-canonical tile → submit → phase `wrong`,
  three buttons (Try again / Different exercise / Reveal correct).
  The canonical tile **does NOT** auto-light green — learner must
  click Reveal. (Matches `optionCellState` behaviour post iter-6.)
- **Try-again resets selection** without recording.
- **Reveal flow** — wrong submit → "Reveal correct" →
  `recordInstanceFailed` once → canonical tile lights via
  `correctRevealed`, picked-wrong stays in its `incorrectSubmitted`
  state (visible side-by-side).
- **Vacuous-truth guard (`blanks: []` or no blank in segments)** —
  `blankSlot()` returns undefined → `canSubmit()` returns false →
  submit button stays disabled. Parallel to FillBlankWord's iter-4
  fix. (Iter-6 guard.)
- **Candidate-pool determinism (`${seed()}::tiles` namespace)** —
  same `(exerciseId, attempt)` → same tile order across re-renders.
  Calling `another()` produces a different order with high
  probability for any pool of length ≥ 3. The `::tiles` namespace
  keeps tile-shuffle RNG independent of any future variant-pick
  RNG that may consume from the same seed.
- **Generator-kind guard** — `props.generator.kind !== "template"`
  short-circuits to `candidates: []`. The component renders the
  fallback "no candidates — authoring issue" text. Pin so the
  rendering of the fallback survives any future `Show`/`Match`
  refactor.

### `src/components/exercise/CandidateTile.tsx` — `tileState`

- **Truth table** — 16 rows over `{selected, submitted, revealed,
  isCorrect}`. Critical rows:
  - `submitted && selected && isCorrect` → `correctSubmitted`
  - `submitted && selected && !isCorrect` → `incorrectSubmitted`
  - `revealed && !selected && isCorrect` → `correctRevealed` (the
    unpicked canonical tile lights up only on explicit reveal)
  - `submitted && !selected && isCorrect` → `neutral` (matches the
    iter-6 fix in `optionCellState`; the canonical is NOT
    auto-revealed on wrong submit)
  - `!submitted && !revealed && selected` → `selected`
  - All `submitted && !selected` rows → `neutral`
  - `selected && submitted && revealed && isCorrect` →
    **`correctRevealed`** (post-iter-7 reorder; was previously
    `correctSubmitted`; both produce identical visual class and the
    row is currently unreachable through the lifecycle, but the
    truth-table test should pin the post-reorder value).
  - **Re-export `tileState`** as a Phase-1 micro-extraction so the
    truth-table test can target it directly.

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
- **fill-line branch** (iter-5) mounts `<FillBlankLine>` with the same
  `blanks` defaulting.
- **freeform branch** renders the "not built yet" placeholder until
  #17 lands.
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
