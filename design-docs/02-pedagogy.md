# 02 — Pedagogy

## The bilingual-phrasebook model

Each lesson presents a small TS snippet alongside its idiomatic Go
counterpart. The learner doesn't read a wall of prose; they engage with one
of four exercise formats. The formats escalate in cognitive load:

### 1. Recognition (multiple choice)

**Format:** "Here is a TS snippet. Which of these is the equivalent Go?"
Four options, one correct.

**Cognitive load:** lowest. Pattern matching.
**Use case:** introducing a new concept; warm-up at the start of a lesson.
**Grading:** ID match — trivial.

### 2. Tile fill-in

**Format:** "Here is the TS. Here is the Go with several pieces missing.
Drag the tiles below into the right slots."

**Cognitive load:** medium. The learner must understand *why* a piece goes
where, not just recognise the whole.
**Use case:** drilling syntax differences (e.g. `:=` vs `let`, struct tags,
explicit error returns).
**Grading:** tile-position match.

### 3. Constrained write

**Format:** "Translate this TS function to Go. Write the answer."
The exercise is shaped so that idiomatic Go has only one reasonable form,
so we can detect correctness deterministically.

**Cognitive load:** high. The learner has to produce, not just recognise.
**Use case:** consolidating after recognition + fill-in for a concept.
**Grading:** gofmt-normalised string match, or AST equivalence for tolerance
to harmless variation.

### 4. Open problem

**Format:** "Here is a problem statement. Write Go that solves it."
The exercise comes with hidden test inputs and expected outputs.

**Cognitive load:** highest. Real programming.
**Use case:** end-of-section capstones.
**Grading:** run user code (via Yaegi or fallback runtime) against test
cases; compare returns.

## Progression principles

- **Translate before introducing.** New Go concepts are first shown as
  translations of TS the learner already knows. The bridge comes before the
  thing being bridged to.
- **Strip the scaffold gradually.** Early exercises show both TS and Go side
  by side. Later exercises hide the TS — the learner is doing Go on its own.
- **Concepts without a TS analogue get extra airtime.** Goroutines, channels,
  defer, named returns, embedding: these get introduction lessons that don't
  use the translation format, because there's nothing to translate from.
- **One concept per lesson.** A lesson that drifts becomes hard to grade and
  hard to resume after a break.

## Lesson and theme anatomy

Two structural units:

- **Theme:** one concept, drilled across a difficulty progression (~9
  exercise slots). A theme is the pedagogical unit — a learner who
  finishes a theme has mastered the concept.
- **Lesson:** a UX unit. 3–4 exercises in a single sitting (~3 minutes).
  Lessons are dense and chainable: if the learner has more time, they
  flow into the next lesson without ceremony.

A theme spans 2–3 lessons. The lesson boundary is a natural pause point,
not a hard pedagogical break.

### Theme progression (default)

Within a theme, exercises escalate in cognitive load:

| Step | Type | Count | Why |
|---|---|---|---|
| 1 | Multiple choice (4+ opts) | 3 | Recognition; lowest barrier; establish the pattern. |
| 2 | Fill-in-the-blank word (≥1 blanks) | 2 | Small productive step; mechanics of syntax. |
| 3 | Fill-in-the-blank line | 2 | Bigger productive step; whole-line composition. |
| 4 | Freeform code | 2 | Full production; test-case grading. |

Total: 9 exercise slots per theme. The mix is tunable per-theme — some
concepts justify more recognition (anything counter-intuitive); some
benefit from extra freeform (anything mechanical).

## Parameterised exercises (replayability)

**No exercise is 100% static.** Every exercise is a *generator* that
produces fresh instances on demand. The learner can ask "give me another
of these" without advancing in the curriculum.

This serves two goals:

1. **Replayability.** Coming back to a theme isn't memorisation — the
   exercise is materially different the second time.
2. **Drilling.** A learner who's struggling can do extra reps of the
   same skill without moving on.

Generator strategies, in order of authoring cost:

- **Template substitution.** Hand-author the template with `${name}`,
  `${type}`, etc. placeholders, plus a small value pool. Generator
  picks values, computes the answer deterministically from the
  template. Cheap, covers ~60% of exercises.
- **Variant set.** Author N hand-crafted variants of the same skill.
  Generator picks one at random. Used when template substitution can't
  capture meaningful variation.
- **Procedural.** Algorithmically construct snippets within constraints
  (e.g. "generate a struct with 2–4 fields, ask for the zero value").
  Highest authoring cost; used for the most-drilled themes.

The "another" button is part of the UX on every exercise. So is a
counter showing how many instances of this exercise the learner has
seen and passed.

## Progress tracking

Three levels of state, kept in localStorage:

- **Topic-level:** module ID → `{status: locked | in_progress | done,
  lastSeen}`. Drives the recommended path.
- **Theme-level:** theme ID → `{status, exercisesSeen, exercisesPassed,
  lastSeen}`. Drives "you've done 4 of 9 here."
- **Exercise-level:** exercise ID → `{instancesSeen, instancesPassed,
  lastInstanceSeed, lastAttemptCorrect}`. Drives "another" and
  re-attempt UX.

Design constraint: a learner can drop in, attempt one exercise, and
leave. The next session resumes exactly where they left off. They can
also re-do a theme they've already passed and have it counted
separately from the original completion (a "passes" counter that
increments on each clean run).

## Grading philosophy

- **Be generous with whitespace, capitalisation in comments, and import order.**
  gofmt normalisation handles most of this. The learner shouldn't be wrong
  because they typed two spaces.
- **Be strict with idiom.** If the exercise is teaching idiomatic Go, mark
  unidiomatic-but-working answers as "passes tests but not idiomatic" and
  show the canonical form. Don't fail them; teach them.
- **Show the canonical answer on submission, always.** Even on correct
  submissions, show the reference solution. Comparison is part of the
  learning.
