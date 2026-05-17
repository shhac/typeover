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

- Module/theme-level progress on the curriculum page: "Foundations —
  3 of 5 themes complete."
- Theme overview: "8 of 9 exercises passed at least once."
- Per-exercise: "You've seen 3 instances, passed 2."
- Resume button on the homepage if `currentLesson` is set.

That's it. No streaks, no badges, no XP, no leaderboards. Information,
not motivation.

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
