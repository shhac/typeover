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

function read(): Progress {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Progress;
    if (parsed.version !== 1) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(p: Progress) {
  if (typeof localStorage === "undefined") return;
  p.lastSeenAt = now();
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
  slot.lastSeenAt = now();
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
