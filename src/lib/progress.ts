import { z } from "zod";

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
const CORRUPT_KEY_PREFIX = "typeover:progress:corrupt-";

const ExerciseProgressSchema = z.object({
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  instancesSeen: z.number(),
  instancesPassed: z.number(),
  instancesFailed: z.number(),
  hintsUsedTotal: z.number(),
});

const ProgressSchema = z.object({
  version: z.literal(1),
  startedAt: z.string(),
  lastSeenAt: z.string(),
  exercises: z.record(z.string(), ExerciseProgressSchema),
});

export type ExerciseProgress = z.infer<typeof ExerciseProgressSchema>;
export type Progress = z.infer<typeof ProgressSchema>;

const now = () => new Date().toISOString();

const empty = (): Progress => ({
  version: 1,
  startedAt: now(),
  lastSeenAt: now(),
  exercises: {},
});

/** Parse + validate a raw storage payload into a Progress. Pure —
 *  no localStorage access. Any reject path returns empty(); callers
 *  that need to know *whether* parsing rejected (e.g. to back up the
 *  corrupt raw value) should call `parseProgressResult` instead. */
export function safeParseProgress(raw: string | null): Progress {
  const result = parseProgressResult(raw);
  return result.ok ? result.value : empty();
}

type ParseResult =
  | { ok: true; value: Progress }
  | { ok: false; reason: "empty" | "invalid-json" | "schema-mismatch" };

/** Tagged-result parser. `empty` means the slot was never written
 *  (no backup needed); `invalid-json` and `schema-mismatch` are
 *  corrupt-blob outcomes the caller may want to preserve. */
function parseProgressResult(raw: string | null): ParseResult {
  if (raw === null) return { ok: false, reason: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  const result = ProgressSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: "schema-mismatch" };
  return { ok: true, value: result.data };
}

function read(): Progress {
  if (typeof localStorage === "undefined") return empty();
  const raw = localStorage.getItem(STORAGE_KEY);
  const result = parseProgressResult(raw);
  if (result.ok) return result.value;
  /* Back up any non-empty payload that failed validation so a future
   * migration / forensic pass can recover the learner's history.
   * design-docs/99 calls this out explicitly: do not silently destroy
   * progress on a parse failure. */
  if (result.reason !== "empty" && raw !== null) {
    localStorage.setItem(CORRUPT_KEY_PREFIX + now(), raw);
  }
  return empty();
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
