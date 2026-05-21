import {
  emptyProgress,
  parseProgressResult,
  safeParseProgress,
  type ExerciseProgress,
  type Progress,
} from "./progress-schema";
import { nowIso } from "./now-iso";

/*
 * Local progress storage. Minimal v0 — enough to power "resume" and
 * "you've seen N instances of this exercise" without locking in a
 * schema that prevents future gamification. The full schema is
 * documented in design-docs/11-progress-tracking.md.
 *
 * The four `record*` helpers all follow the same read-modify-write
 * shape, expressed once via `bumpExercise`. Pure parsing + the
 * Zod schema live in `./progress-schema.ts` so non-I/O consumers
 * (tests, type-infer) don't pull in the cache + Solid event layer.
 */

export const STORAGE_KEY = "typeover:progress";
const CORRUPT_KEY_PREFIX = "typeover:progress:corrupt-";

/** Same-tab change-notification event. The cross-tab `storage` event
 *  doesn't fire within the writing tab, so two islands on one page
 *  (e.g. the chip + the exercise component) wouldn't see each other's
 *  writes. Chips subscribe to both this event and the cross-tab
 *  `storage` event for full coverage. design-docs/19 F-20. */
export const PROGRESS_CHANGED_EVENT = "typeover:progress-changed";

/* Re-export the schema's public types + safe parser so existing
 * consumers (~/lib/progress imports) continue to work without
 * touching every call site. */
export type { ExerciseProgress, Progress };
export { safeParseProgress };

const now = nowIso;
const empty = emptyProgress;

/* Module-level cache. Every public reader (getExerciseProgress,
 * summarizeTheme, the test helpers) goes through read(); a single
 * ModuleCompleteCard render can call it 100+ times and each call
 * was JSON.parse-ing + Zod-validating the same blob. The cache
 * lives for the lifetime of a write() — every recorder bumps the
 * cache after writing — so listeners see fresh data and same-render
 * readers share one parse. design-docs/18 F-3 + design-docs/19 F-4. */
let cachedProgress: Progress | null = null;

/** Test-only escape hatch. Vitest resets localStorage between
 *  tests via the global setup; this clears the module-level cache
 *  so the next read() re-parses the new (empty) storage instead
 *  of returning the previous test's snapshot. */
export function __resetProgressCacheForTests(): void {
  cachedProgress = null;
}

/** Drop the in-memory progress cache so the next read() re-pulls
 *  from localStorage. Used by chips after a cross-tab `storage`
 *  event — without this they'd keep returning the stale snapshot
 *  the module captured before the other tab's write. */
export function invalidateProgressCache(): void {
  cachedProgress = null;
}

/**
 * Stash the raw corrupt payload under a timestamped backup key,
 * then reset the main key to an empty Progress. Pulled out of
 * read() so the corruption-recovery contract is explicit + the
 * read() body reads as a flat happy-path. design-docs/19 F-1 +
 * design-docs/18 F-5 follow-up.
 *
 * Caller MUST already have verified `reason !== "empty"` (a missing
 * key is not corruption, just a fresh user) and `raw !== null`
 * (nothing to back up).
 *
 * Critical sequencing: backup first, THEN reset the main key.
 * Without the reset, every subsequent read() in the same session
 * re-enters this branch (corrupt blob is still in storage),
 * spawning one new `typeover:progress:corrupt-<iso>` key per call
 * — and a single ModuleCompleteCard render fires 100+ reads.
 */
function handleCorruptProgress(raw: string): Progress {
  localStorage.setItem(CORRUPT_KEY_PREFIX + now(), raw);
  const fresh = empty();
  write(fresh);
  return cachedProgress ?? fresh;
}

function read(): Progress {
  if (cachedProgress !== null) return cachedProgress;
  if (typeof localStorage === "undefined") {
    cachedProgress = empty();
    return cachedProgress;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  const result = parseProgressResult(raw);
  if (result.ok) {
    cachedProgress = result.value;
    return cachedProgress;
  }
  if (result.reason !== "empty" && raw !== null) {
    return handleCorruptProgress(raw);
  }
  cachedProgress = empty();
  return cachedProgress;
}

/** Pure serializer. Caller is responsible for updating `p.lastSeenAt`
 *  before calling; write() doesn't touch timestamps. */
function write(p: Progress) {
  /* Refresh the cache to match what we just persisted so subsequent
   * reads in the same tick see the new value without parsing again. */
  cachedProgress = p;
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  /* Notify same-tab listeners (chips on the same page). The native
   * `storage` event only fires in OTHER tabs, so without this a
   * theme overview wouldn't update its chips when an exercise on the
   * same page is passed. design-docs/19 F-20. */
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT));
  }
}

/** Default slot shape — used when getExerciseProgress hits a slot
 *  that doesn't exist yet. Previously exerciseSlot mutated `p` to
 *  insert this; that hid a "create on read" footgun in a function
 *  named `getExerciseProgress`. design-docs/18 F-3. */
function emptySlot(): ExerciseProgress {
  const t = now();
  return {
    firstSeenAt: t,
    lastSeenAt: t,
    instancesSeen: 0,
    instancesPassed: 0,
    instancesFailed: 0,
    hintsUsedTotal: 0,
  };
}

/** Mutating slot helper. Only called from `bumpExercise` (which
 *  intends to mutate); other readers go through `emptySlot()`. */
function exerciseSlot(p: Progress, id: string): ExerciseProgress {
  if (!p.exercises[id]) {
    p.exercises[id] = emptySlot();
  }
  return p.exercises[id]!;
}

/**
 * Read progress, locate (or create) the exercise slot, apply `mutate`,
 * touch `lastSeenAt`, write back. Every public recorder is built on
 * this — adding a new counter is a one-liner.
 */
function bumpExercise(id: string, mutate: (slot: ExerciseProgress) => void): void {
  const p = read();
  const slot = exerciseSlot(p, id);
  mutate(slot);
  const t = now();
  slot.lastSeenAt = t;
  p.lastSeenAt = t;
  write(p);
}

export const recordInstanceSeen = (id: string) =>
  bumpExercise(id, (s) => {
    s.instancesSeen += 1;
  });

export const recordInstancePassed = (id: string) =>
  bumpExercise(id, (s) => {
    s.instancesPassed += 1;
  });

export const recordInstanceFailed = (id: string) =>
  bumpExercise(id, (s) => {
    s.instancesFailed += 1;
  });

export const recordHintUsed = (id: string) =>
  bumpExercise(id, (s) => {
    s.hintsUsedTotal += 1;
  });

export function getExerciseProgress(id: string): ExerciseProgress {
  /* Pure read — returns either the existing slot or a fresh empty
   * slot. Does NOT mutate the cached Progress; create-on-write is
   * the only path that adds slots to the persisted state (via
   * `recordInstanceSeen` → `bumpExercise` → `exerciseSlot`). */
  return read().exercises[id] ?? emptySlot();
}

/**
 * The most-recently-touched exerciseId, or null when the learner
 * has no recorded progress. Derives from existing data (max-by
 * `lastSeenAt` across the exercises map) so no schema migration
 * is needed.
 *
 * Used by the header's ResumeLink to render a "Resume — <theme>
 * · ex N" affordance. design-docs/16 F-1.
 */
export function lastTouchedExerciseId(): string | null {
  const p = read();
  let bestId: string | null = null;
  let bestAt = "";
  for (const [id, slot] of Object.entries(p.exercises)) {
    if (slot.lastSeenAt > bestAt) {
      bestAt = slot.lastSeenAt;
      bestId = id;
    }
  }
  return bestId;
}

/**
 * Aggregate a set of exercises into the theme-level summary the
 * curriculum UIs render. Single source of truth for the
 * "theme complete" predicate — both ModuleCompleteCard and the
 * ProgressChip island read from here so they can't disagree.
 *
 * `total` is the count of authored exercises in the theme — passed
 * by the caller because the storage layer doesn't know about
 * curriculum structure.
 *
 * `themeComplete` mirrors the completion-card rule: every authored
 * exercise has `instancesPassed > 0`. An empty theme (no exercises
 * authored) is NOT considered complete — that would falsely "credit"
 * a learner for a stub module 2+ theme they couldn't actually have
 * passed.
 */
export function summarizeTheme(exerciseIds: readonly string[]): {
  passed: number;
  total: number;
  themeComplete: boolean;
} {
  const total = exerciseIds.length;
  const passed = exerciseIds.filter((id) => getExerciseProgress(id).instancesPassed > 0).length;
  return { passed, total, themeComplete: total > 0 && passed === total };
}

/** Module-level aggregation used by the completion card. Pure —
 *  takes the theme structure directly so the result is testable
 *  without a Solid render harness. design-docs/20 lens-1 + lens-3
 *  finding (extracts a four-`let` loop body from ModuleCompleteCard). */
export interface ModuleProgressSummary {
  exercisesPassed: number;
  totalExercises: number;
  themesComplete: number;
  hintsUsedTotal: number;
}

export function aggregateModuleProgress(
  themes: readonly { exerciseIds: readonly string[] }[],
): ModuleProgressSummary {
  let exercisesPassed = 0;
  let totalExercises = 0;
  let themesComplete = 0;
  let hintsUsedTotal = 0;
  for (const theme of themes) {
    const summary = summarizeTheme(theme.exerciseIds);
    exercisesPassed += summary.passed;
    totalExercises += summary.total;
    if (summary.themeComplete) themesComplete += 1;
    for (const id of theme.exerciseIds) {
      hintsUsedTotal += getExerciseProgress(id).hintsUsedTotal;
    }
  }
  return { exercisesPassed, totalExercises, themesComplete, hintsUsedTotal };
}

/** First exercise across the module's themes that the learner hasn't
 *  passed yet. Used by the almost-there branch of the completion
 *  card to offer a Continue CTA. design-docs/16 F-8 + design-docs/20
 *  lens-1 finding. */
export function findNextUnfinishedExerciseId(
  themes: readonly { exerciseIds: readonly string[] }[],
): string | null {
  for (const theme of themes) {
    for (const exId of theme.exerciseIds) {
      if (getExerciseProgress(exId).instancesPassed === 0) return exId;
    }
  }
  return null;
}
