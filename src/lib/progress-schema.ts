import { z } from "zod";

/**
 * Storage schema for progress.ts's localStorage blob. Extracted so
 * consumers that only need the SHAPE (test fixtures, type
 * inference, hypothetical analytics readers) don't pull in the I/O
 * layer + Solid event listeners. Mirrors the pattern of
 * generator-schema vs generator-runtime.
 *
 * The actual I/O (read/write/cache, corrupt-blob backup,
 * PROGRESS_CHANGED_EVENT dispatch) stays in progress.ts.
 */

export const ExerciseProgressSchema = z.object({
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  instancesSeen: z.number(),
  instancesPassed: z.number(),
  instancesFailed: z.number(),
  hintsUsedTotal: z.number(),
});

export const ProgressSchema = z.object({
  version: z.literal(1),
  startedAt: z.string(),
  lastSeenAt: z.string(),
  exercises: z.record(z.string(), ExerciseProgressSchema),
});

export type ExerciseProgress = z.infer<typeof ExerciseProgressSchema>;
export type Progress = z.infer<typeof ProgressSchema>;

/**
 * Tagged-result parser. `empty` means the slot was never written
 * (no backup needed); `invalid-json` and `schema-mismatch` are
 * corrupt-blob outcomes the caller may want to preserve before
 * resetting.
 */
export type ParseResult =
  | { ok: true; value: Progress }
  | { ok: false; reason: "empty" | "invalid-json" | "schema-mismatch" };

/* Small wrapper around JSON.parse so the caller can stay `const`
 * and read top-to-bottom — the previous `let parsed; try {...} catch`
 * smell is the exact shape lens-3 flagged in design-docs/20. */
const JSON_PARSE_FAILED = Symbol("json-parse-failed");

function tryJsonParse(raw: string): unknown | typeof JSON_PARSE_FAILED {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON_PARSE_FAILED;
  }
}

export function parseProgressResult(raw: string | null): ParseResult {
  if (raw === null) return { ok: false, reason: "empty" };
  const parsed = tryJsonParse(raw);
  if (parsed === JSON_PARSE_FAILED) return { ok: false, reason: "invalid-json" };
  const result = ProgressSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: "schema-mismatch" };
  return { ok: true, value: result.data };
}

/** Pure: parse + validate, or return an empty Progress on any
 *  failure. Callers that need to KNOW about the failure (to back
 *  up a corrupt blob) should call `parseProgressResult` directly. */
export function safeParseProgress(raw: string | null): Progress {
  const result = parseProgressResult(raw);
  return result.ok ? result.value : emptyProgress();
}

const now = () => new Date().toISOString();

export function emptyProgress(): Progress {
  return {
    version: 1,
    startedAt: now(),
    lastSeenAt: now(),
    exercises: {},
  };
}
