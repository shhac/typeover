/*
 * Local progress storage. Minimal v0 — enough to power "resume" and
 * "you've seen N instances of this exercise" without locking in a
 * schema that prevents future gamification. The full schema is
 * documented in design-docs/11-progress-tracking.md.
 *
 * The four `record*` helpers all follow the same read-modify-write
 * shape, expressed once via `bumpExercise`.
 */

const STORAGE_KEY = "typeover:progress";

export type ExerciseProgress = {
  firstSeenAt: string;
  lastSeenAt: string;
  instancesSeen: number;
  instancesPassed: number;
  instancesFailed: number;
  hintsUsedTotal: number;
};

export type Progress = {
  version: 1;
  startedAt: string;
  lastSeenAt: string;
  exercises: Record<string, ExerciseProgress>;
};

const now = () => new Date().toISOString();

const empty = (): Progress => ({
  version: 1,
  startedAt: now(),
  lastSeenAt: now(),
  exercises: {},
});

function isValidExerciseProgress(v: unknown): v is ExerciseProgress {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.firstSeenAt === "string" &&
    typeof s.lastSeenAt === "string" &&
    Number.isFinite(s.instancesSeen) &&
    Number.isFinite(s.instancesPassed) &&
    Number.isFinite(s.instancesFailed) &&
    Number.isFinite(s.hintsUsedTotal)
  );
}

/** Parse + validate a raw storage payload into a Progress. Pure —
 *  no localStorage access. Any reject path returns empty(); the
 *  caller can't tell why and doesn't need to. Task #37 will swap
 *  this for a Zod parser without touching the SSR path or callers. */
export function safeParseProgress(raw: string | null): Progress {
  if (raw === null) return empty();
  try {
    const parsed = JSON.parse(raw) as Partial<Progress>;
    if (parsed.version !== 1) return empty();
    /* Harden against a partial write (browser killed mid-quota-error)
     * that leaves the blob without `exercises`. Downstream callers
     * read `p.exercises[id]` and would crash. */
    if (!parsed.exercises || typeof parsed.exercises !== "object") {
      return empty();
    }
    /* Per-slot validation: a corrupt slot (null, string counters,
     * missing timestamps) would either crash bumpExercise or write
     * `NaN + 1 === NaN` back to storage and silently brick the
     * learner's counters forever. Drop the whole blob to empty()
     * if any slot is malformed — safer to lose progress than to
     * persist NaN. */
    for (const slot of Object.values(parsed.exercises)) {
      if (!isValidExerciseProgress(slot)) return empty();
    }
    return parsed as Progress;
  } catch {
    return empty();
  }
}

function read(): Progress {
  if (typeof localStorage === "undefined") return empty();
  return safeParseProgress(localStorage.getItem(STORAGE_KEY));
}

/** Pure serializer. Caller is responsible for updating `p.lastSeenAt`
 *  before calling; write() doesn't touch timestamps. */
function write(p: Progress) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function exerciseSlot(p: Progress, id: string): ExerciseProgress {
  if (!p.exercises[id]) {
    const t = now();
    p.exercises[id] = {
      firstSeenAt: t,
      lastSeenAt: t,
      instancesSeen: 0,
      instancesPassed: 0,
      instancesFailed: 0,
      hintsUsedTotal: 0,
    };
  }
  return p.exercises[id]!;
}

/**
 * Read progress, locate (or create) the exercise slot, apply `mutate`,
 * touch `lastSeenAt`, write back. Every public recorder is built on
 * this — adding a new counter is a one-liner.
 */
function bumpExercise(
  id: string,
  mutate: (slot: ExerciseProgress) => void,
): void {
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
  return exerciseSlot(read(), id);
}
