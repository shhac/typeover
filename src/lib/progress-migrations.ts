import type { ExerciseProgress, Progress } from "./progress-schema";

/*
 * One-shot data migrations for the `Progress` blob in localStorage.
 *
 * Called from `progress.ts`'s `read()` after a successful schema
 * parse. Each function takes a `Progress` and returns either the
 * same reference (no change → no write-back) or a new `Progress`
 * with the rewritten data. The reference-equality is the signal
 * the caller uses to decide whether to persist.
 *
 * Pulled out of `progress.ts` so future migrations have an obvious
 * home next to their siblings. Storage / cache / event-dispatch
 * stays in the main module; this file is pure data transforms.
 */

/** Migration 1 (2026-05-22): rewrite legacy 3-segment exercise IDs
 *  (`<module>/<theme>/<index>`) to the multi-language 4-segment form
 *  (`go/<module>/<theme>/<index>`). The only language at the time of
 *  the reorg was Go, so legacy keys always belong to that track.
 *
 *  Returns the SAME reference when nothing changed, so the caller
 *  can skip the write back to localStorage. When at least one key
 *  was rewritten, returns a new `Progress` with the merged map.
 *
 *  Conflict policy: if both a legacy `foundations/variables/01` AND
 *  a modern `go/foundations/variables/01` exist (rare — would mean
 *  the learner ran a build between the schema bump and the content
 *  reorg), the modern entry wins. No backup blob — the data isn't
 *  precious enough to warrant a separate stash key. */
export function migrateLegacyIds(p: Progress): Progress {
  let migratedCount = 0;
  const exercises: Record<string, ExerciseProgress> = { ...p.exercises };
  for (const [id, slot] of Object.entries(p.exercises)) {
    if (!needsLegacyPrefix(id)) continue;
    const newId = `go/${id}`;
    if (newId in exercises) {
      /* Modern entry already exists — drop the legacy one rather
       * than clobbering a newer record with an older one. */
      delete exercises[id];
    } else {
      exercises[newId] = slot;
      delete exercises[id];
    }
    migratedCount++;
  }
  if (migratedCount === 0) return p;
  return { ...p, exercises };
}

/** Predicate: does this exercise ID need the legacy → 4-segment
 *  rewrite? Internal helper; the public surface is just
 *  `migrateLegacyIds`. Re-export if a test ever needs to call it
 *  directly. */
function needsLegacyPrefix(id: string): boolean {
  const parts = id.split("/");
  if (parts.length !== 3) return false;
  /* Reject empty segments — those are corrupt rather than legacy. */
  if (parts.some((s) => s === "")) return false;
  /* Defensive: if a 3-segment id somehow starts with a known lang
   * slug, leave it alone (it's malformed but not "legacy Go"). */
  if (parts[0] === "go" || parts[0] === "zig") return false;
  return true;
}
