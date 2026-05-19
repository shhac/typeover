/**
 * Pure helpers extracted out of the FillBlank exercise components so
 * their critical contracts (vacuous-truth guards, ::tiles seed
 * namespacing) can be unit-tested directly rather than only through
 * Solid-rendering tests.
 */

import type { FillSegment, GeneratorSpec } from "./generator";
import { rngFromSeed, shuffle } from "./seed";

/**
 * A blank segment with the index it occupied in the original segment
 * stream. FillBlankWord renders one input per occurrence (the same
 * blank var can appear multiple times in the canonical, e.g.
 * `${x} == ${x}`), so the segment index is the slot key.
 */
export type BlankPosition = {
  idx: number;
  seg: FillSegment & { kind: "blank" };
};

/** Pick the blank segments out of a segment list and tag each with its
 *  original index. The index is the slot key the component renders
 *  against. */
export function extractBlankPositions(segments: readonly FillSegment[]): BlankPosition[] {
  return segments
    .map((seg, idx) => ({ seg, idx }))
    .filter((b): b is BlankPosition => b.seg.kind === "blank");
}

/**
 * Evaluate the current input map against the blank positions. Returns
 * a (filled, correct) pair so the component can drive both Submit's
 * disabled state and the isCorrect predicate from one source of truth.
 *
 * The vacuous-truth guard — empty positions → both false — pins the
 * iter-4 fix (commit 7fc01bc). `Array.prototype.every` returns true on
 * an empty array, which would silently auto-pass any fill-word
 * exercise authored with `blanks: []`.
 */
export function evaluateBlanks(
  positions: readonly BlankPosition[],
  inputs: Record<number, string>,
): { allFilled: boolean; allCorrect: boolean } {
  if (positions.length === 0) return { allFilled: false, allCorrect: false };
  const valueFor = (idx: number) => inputs[idx] ?? "";
  return {
    allFilled: positions.every((b) => valueFor(b.idx) !== ""),
    allCorrect: positions.every((b) => valueFor(b.idx) === b.seg.expected),
  };
}

/**
 * Build the candidate-tile pool for a fill-line exercise. The pool is
 * the template var's value list, shuffled deterministically per seed.
 *
 * The `::tiles` seed-namespace suffix is load-bearing: it keeps the
 * tile-shuffle RNG independent of any future variant-pick RNG that
 * might reuse the same `seed()`. A typo to `:tiles` or `::tile` would
 * silently still work but lose the namespace contract.
 *
 * Returns [] for non-template generators (variant/procedural don't
 * carry a vars pool today) and for empty `blanks` (the schema doesn't
 * yet enforce non-empty blanks — task #38 will).
 */
export function buildCandidatePool(
  generator: GeneratorSpec,
  blanks: readonly string[],
  seed: string,
): string[] {
  if (generator.kind !== "template") return [];
  if (blanks.length === 0) return [];
  const pool = generator.vars[blanks[0]!] ?? [];
  return shuffle(rngFromSeed(`${seed}::tiles`), [...pool]);
}
