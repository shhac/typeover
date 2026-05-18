import type { GeneratorSpec } from "./generator";
import { rngFromSeed, shuffle } from "./seed";

/**
 * Pure helpers extracted out of the FillBlank exercise components so
 * their critical contracts (vacuous-truth guards, ::tiles seed
 * namespacing) can be unit-tested directly rather than only through
 * Solid-rendering tests.
 */

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
