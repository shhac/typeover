/**
 * Pure helpers extracted out of the FillBlank exercise components so
 * their critical contracts (vacuous-truth guards, ::tiles seed
 * namespacing) can be unit-tested directly rather than only through
 * Solid-rendering tests.
 */

import { distractorMatchText, type GeneratorSpec } from "./generator-schema";
import { type ExerciseInstance, type FillSegment, substitute } from "./generator-runtime";
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
 * The vacuous-truth guard — empty positions → both false — is
 * load-bearing. `Array.prototype.every` returns true on an empty
 * array, which would silently auto-pass any fill-word exercise
 * authored with `blanks: []`.
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
 * Build the candidate-tile pool for a fill-line exercise.
 *
 * Pool = [the substituted value of the blank's template var] +
 *        [each substituted distractor].
 *
 * The substituted blank value is THE correct tile for this instance
 * (the same string the BlankInput's `expected` reads). Distractors
 * are alternative lines authored at the generator level — same
 * `generator.distractors` field MCQ exercises use, just interpreted
 * as "alternative line content" rather than "alternative full
 * canonical" since fill-line's canonical is the blanked template
 * itself.
 *
 * Pre-fix history: this used to be `shuffle(generator.vars[blank])`
 * which meant the random pick from `vars` could land on a distractor,
 * and the user-visible "correct tile" rotated unpredictably per seed.
 * See `design-docs/12-test-plan.md` P1 — FillBlankLine correctness
 * for the contract this restores.
 *
 * The `::tiles` seed-namespace suffix is load-bearing: it keeps the
 * tile-shuffle RNG independent of the variant-pick RNG that consumes
 * the same `seed()`. A typo to `:tiles` or `::tile` would silently
 * still work but lose the namespace contract.
 *
 * Returns [] for non-template generators (variant/procedural don't
 * carry a vars pool) and for empty `blanks`.
 */
export function buildCandidatePool(
  generator: GeneratorSpec,
  values: Record<string, string> | undefined,
  blanks: readonly string[],
  seed: string,
): string[] {
  if (generator.kind !== "template") return [];
  if (blanks.length === 0) return [];
  const blank = blanks[0]!;
  /* The picked-and-substituted value for the blank — exactly what
   * BlankInput's expected resolves to, so the learner picking this
   * tile is guaranteed to grade correct. Falls back to vars[blank][0]
   * for tests that build a generator without going through
   * useExerciseInstance. */
  const expected = values?.[blank] ?? generator.vars[blank]?.[0];
  if (expected === undefined) return [];

  /* Distractors are template strings; substitute against the same
   * values map so any ${refs} they contain resolve consistently.
   * For exercises whose distractors are static strings (the v0
   * shape), substitute is a no-op. Structured `{match, explain}`
   * entries collapse to their `.match` text — the pool only ever
   * shows match strings, never the explanations. */
  const distractors = (generator.distractors ?? []).map((d) => {
    const match = distractorMatchText(d);
    return values ? substitute(match, values) : match;
  });

  /* Dedupe — defends against an author accidentally listing the
   * correct line in distractors too. */
  const all = [expected, ...distractors].filter((v, i, a) => a.indexOf(v) === i);
  return shuffle(rngFromSeed(`${seed}::tiles`), all);
}

/**
 * Substitute the learner's typed line into an instance at the blank
 * position. Rebuilds from the segment stream rather than from the
 * raw canonical template so the scaffold (already-substituted vars
 * + non-blank text) is preserved exactly.
 *
 * Used by FillBlankLineInput to assemble the program text sent to
 * Yaegi for grading. Extracted from the component so it can be
 * unit-tested without rendering and so future fill-* surfaces (or
 * a future "validate the typed line against the canonical without
 * running it" feature) can reuse the helper.
 *
 * For an instance without blank segments, the segments fallback to
 * [] and the result is "" — defence in depth; the schema rejects a
 * fill-line authored without a blank, but components carry their
 * own guards too.
 */
export function substituteAtBlank(instance: ExerciseInstance, userLine: string): string {
  const segments = instance.blankSegments ?? [];
  return segments.map((seg) => (seg.kind === "blank" ? userLine : seg.text)).join("");
}
