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
