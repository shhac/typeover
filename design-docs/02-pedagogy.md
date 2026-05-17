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

## Lesson anatomy

A typical lesson is ~6 exercises:

1. Recognition (1) — introduce the concept
2. Recognition (2) — reinforce
3. Tile fill-in — drill the mechanics
4. Constrained write — produce
5. Constrained write — produce harder
6. Open problem — apply

Time budget: ~8 minutes if the learner is moving steadily.

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
