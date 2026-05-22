/*
 * Shared test helpers for the four exercise component test files
 * (Mcq, FillBlankWord, FillBlankLineInput, Freeform).
 *
 * Each suite needs to read the per-exercise progress slot that the
 * component wrote to localStorage and assert on counters (seen,
 * passed, failed). Before this helper existed each file
 * re-implemented the same `STORAGE_KEY` + `RawProgress` shape +
 * `readProgress()` + `slot(exId)` block, byte-identical except for
 * the exercise ID literal — ~35 lines × 4 files = ~140 lines of
 * drift-prone duplication.
 *
 * The component code under test owns the storage key + write shape;
 * these helpers are the read-side mirror, intentionally kept dumb
 * (no Zod parse, no caching, no event listeners) so a test
 * regression points at the recorder logic, not at this file.
 */

import { STORAGE_KEY as PROGRESS_STORAGE_KEY } from "~/lib/progress";

/* Mirror of the storage key from `~/lib/progress`. Internal; tests
 * that need to seed fixtures directly should import the key from
 * the source module. */
const STORAGE_KEY = PROGRESS_STORAGE_KEY;

/** Conventional three-tier hint tuple every exercise component
 *  expects. The values are placeholders the tests don't assert on;
 *  they only need to be three non-empty strings. */
export const HINTS: readonly [string, string, string] = ["c1", "c2", "c3"];

/** Minimal counters shape for the per-exercise progress slot. Mirrors
 *  the schema's `ExerciseProgress` but typed locally so the helper
 *  doesn't depend on the schema module's transitive imports. */
export interface ProgressSlot {
  instancesSeen: number;
  instancesPassed: number;
  instancesFailed: number;
  hintsUsedTotal: number;
}

/** Storage envelope as it lands in localStorage. Loose typing —
 *  tests asserting on slot counters don't need the full envelope. */
export interface RawProgress {
  exercises: Record<string, ProgressSlot>;
}

/* Read whatever the recorder wrote to localStorage. Returns `null`
 * when no record exists yet (fresh test). The test suite's
 * `vitest.setup.ts` clears localStorage between cases. Internal;
 * callers consume `makeProgressReader().readProgress` instead. */
function readProgress(): RawProgress | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as RawProgress);
}

/** Bundle the read + per-id slot accessor for one exercise. Each
 *  component test file does `const { slot, readProgress } =
 *  makeProgressReader(EX_ID)` once at top-level, then `slot()?.x`
 *  inside individual `it()` cases. */
export function makeProgressReader(exerciseId: string): {
  readProgress: () => RawProgress | null;
  slot: () => ProgressSlot | undefined;
} {
  return {
    readProgress,
    slot: () => readProgress()?.exercises[exerciseId],
  };
}
