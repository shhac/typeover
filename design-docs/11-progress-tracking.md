# 11 — Progress tracking

## Posture

typeover tracks learner progress **locally** (no accounts in v0), at a
**granularity sufficient to add gamification later** without retro-fits.

What we display to the user is minimal; what we *record* internally is
rich enough to support streaks, badges, time-on-task analytics, and
social-share text composition when we want them.

## Storage

- **localStorage**, single key `typeover:progress` containing a JSON
  blob.
- Schema versioned (`version: 1`) so we can migrate without losing
  data.
- IndexedDB upgrade path when the blob exceeds ~1 MB (later, not v0).

## Schema (three levels)

```ts
type Progress = {
  version: 1,
  startedAt: ISO8601,           // when the learner first arrived
  lastSeenAt: ISO8601,          // for resume UX
  currentLesson?: LessonRef,    // for "resume" button

  topics: Record<TopicId, TopicProgress>,
  themes: Record<ThemeId, ThemeProgress>,
  exercises: Record<ExerciseId, ExerciseProgress>,
};

type TopicProgress = {
  status: "locked" | "available" | "in-progress" | "complete",
  firstSeenAt: ISO8601,
  completedAt?: ISO8601,
};

type ThemeProgress = {
  status: "available" | "in-progress" | "complete",
  firstSeenAt: ISO8601,
  completedAt?: ISO8601,
  exercisesAttempted: number,   // unique exercises in theme
  exercisesPassed: number,
  passes: number,               // how many full clean runs of the theme
};

type ExerciseProgress = {
  firstSeenAt: ISO8601,
  lastSeenAt: ISO8601,
  instancesSeen: number,
  instancesPassed: number,
  instancesFailed: number,      // user pressed "reveal diff"
  hintsUsedTotal: number,       // ever (across instances)
  // Per-instance log, capped at the last 20 instances:
  recentInstances: Array<{
    seed: string,
    outcome: "passed" | "failed" | "abandoned",
    hintsUsed: number,          // 0, 1, 2, or 3
    attempts: number,           // submissions before outcome
    durationMs: number,
    at: ISO8601,
  }>,
};
```

## Status transitions

### Topic

- `locked` → `available` when the previous topic is `complete` (along
  the recommended path) **or** when the user free-browses into it.
- `available` → `in-progress` when the user opens any theme in the
  topic.
- `in-progress` → `complete` when every theme in the topic is
  `complete`.

### Theme

- `available` → `in-progress` on first exercise attempt.
- `in-progress` → `complete` when every exercise in the theme has
  `instancesPassed ≥ 1`.
- A `complete` theme can be re-done; the `passes` counter increments
  when the learner does a fresh clean run.

### Exercise instance

- The "another" button doesn't change persistent status; it requests a
  new instance.
- `revealDiff` records `failed` for that instance; the learner can
  still pass other instances of the same exercise.
- A learner who finishes all 9 exercises in a theme without ever
  revealing a diff is recorded — useful for "perfect run" badges later.

## What we display in v0

- **Module-completion screen** (`/go/<module>/complete`) —
  themes / exercises / hint totals. *Landed 2026-05-19 (#30).*
- **Theme overview chip** (`/go/<module>/<theme>`):
  "8 of 9 exercises passed at least once" beside the "exercises"
  eyebrow. *Picked 2026-05-19 via design-goal round (validated);
  implementation queued.*
- **Per-exercise chip** on the theme-overview's exercise cards:
  "seen 3 · passed 2" rendered only when prior instances exist.
  *Picked 2026-05-19; bundled with the theme-overview chip.*
- Resume button on the homepage if `currentLesson` is set.
  *Not built; not blocking launch.*

That's it. No streaks, no badges, no XP, no leaderboards. Information,
not motivation.

### Deferred: module/theme-level chip on the curriculum index

A 2026-05-19 design-goal proposal floated aggregating progress
into chips on `/go` itself ("· 1 theme complete · 14/45 passed"
beside each module heading). The devil's-advocate validator
pushed back on two grounds:

1. **Action-adjacency.** Theme-overview chips sit next to the
   action they inform ("which exercise to drill next?"). Index
   chips sit beside "which theme to pick" — that re-frames the
   page as a scoreboard.
2. **Zero-JS regression.** `/go` and `/go/<module>/<theme>`
   currently ship no client directives. Mounting Solid for
   chip hydration costs Lighthouse score on the page that
   carries the launch-gate ≥95 commitment.

Decision: park the curriculum-index variant until a returning
learner asks for it. Theme-overview chips are still the scoped
v0 ship.

### Implementation contract

To honour the validator's architecture refinement, the chip is
split in two:

- **`<ProgressChip passed total>`** — pure presentational
  primitive in `src/components/ds/`. No localStorage, no Solid
  signal subscription. Reads two props, renders mono text + an
  `aria-label="N of M exercises passed"`. Trivially testable.
- **`<ThemeProgressIsland exerciseIds>`** — wrapper in
  `src/components/progress/`. Mounts `client:only="solid-js"`,
  reads `getExerciseProgress(id)` for each exercise on mount,
  computes the summary, renders the chip. Layout shift mitigated
  with a `min-w` placeholder that matches the chip's resolved
  width during the pre-mount window.

The shared `summarizeTheme(exerciseIds): {passed, total,
themeComplete}` helper sits next to `progress.ts` so the
completion card and the chip can't drift on the
"theme complete" rule. Refactoring `ModuleCompleteCard` to
consume the helper happens in the same commit that introduces
it — otherwise the duplication that prompted the helper stays.

The whole feature is 3–5 commits per the validator's honest
estimate; "1–3" in the original proposal was optimistic.

## What we record for later

We record everything in the schema above even though we don't show it.
With that data we can later add (without retro-fitting storage):

- **Streaks** — consecutive days with at least one `instancesPassed`.
- **Mastery badges** — passing every exercise in a theme without
  hints / without failures.
- **Theme leaderboards** — fastest mean attempt time (if we ever go
  social).
- **Topic-level analytics** — where learners get stuck (high
  hintsUsedTotal correlated with high failures).

The decision to surface any of this is deferred.

## Social share

At the end of a module, a learner sees a one-tap share:

```
typeover · MODULE COMPLETE
─────────────────────────
Foundations of Go for TypeScript devs.

5 themes, 45 exercises.
[Share]  [Continue]
```

The share composes a pre-filled message:

> Just finished Module 1 of typeover — Go for TypeScript devs. 5 themes
> down, 5 to go. <typeover.dev>

Plus an OG image rendered from the module name + completion timestamp.

The share is the **single growth mechanism** baked into the product.
It's deliberately tied to a learner-celebrated milestone, not to
arbitrary streaks.

## Privacy

- Nothing leaves the device in v0.
- No telemetry, no analytics pings.
- If we later add accounts or cloud sync, it'll be opt-in with a
  privacy doc explaining exactly what we keep server-side.
- The privacy posture is itself a feature; we say so in the README.
