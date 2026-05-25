import { createEffect, createMemo, createSignal } from "solid-js";
import { generate, type ExerciseInstance, type GenerateOptions } from "./generator-runtime";
import type { GeneratorSpec } from "./generator-schema";
import { recordInstanceSeen } from "./progress";

const LEARNER_SEED_KEY = "typeover:learner-seed";

function getLearnerSeed(): number {
  try {
    const stored = localStorage.getItem(LEARNER_SEED_KEY);
    if (stored) return parseInt(stored, 10);
  } catch {
    /* SSR or private browsing — fall back to 0. */
  }
  const seed = Math.floor(Math.random() * 1_000_000);
  try {
    localStorage.setItem(LEARNER_SEED_KEY, String(seed));
  } catch {
    /* quota / private browsing — the seed is ephemeral. */
  }
  return seed;
}

/**
 * Drives a single exercise's instance lifecycle: attempt counter,
 * deterministic seed, derived instance, and the "another" action.
 *
 * The initial attempt is offset by a per-browser "learner seed"
 * stored in localStorage so different visitors see different
 * starting variants/variable picks. Reshuffles increment from
 * that offset.
 *
 * Side effects (recording instancesSeen) fire in a createEffect tied
 * to the seed — never in the memo — so memos stay pure and seen-counts
 * don't double-fire on hydration or HMR.
 *
 * The `opts` argument is passed straight through to `generate` per
 * call. For fill-blank-word exercises, this is how the consumer
 * declares which template vars become input slots.
 *
 * Reused by every exercise type (MCQ, FillBlankWord,
 * FillBlankLineInput, Freeform).
 */
export function useExerciseInstance(
  exerciseId: string,
  generator: GeneratorSpec,
  opts: GenerateOptions = {},
) {
  const [attempt, setAttempt] = createSignal(getLearnerSeed());

  const seed = () => `${exerciseId}::${attempt()}`;
  let lastVariantId: string | undefined;
  const instance = createMemo<ExerciseInstance>(() => {
    const result = generate(generator, seed(), { ...opts, excludeVariantId: lastVariantId });
    lastVariantId = result.variantId;
    return result;
  });

  createEffect(() => {
    // Re-runs whenever the seed changes (i.e. attempt advances). Records
    // exactly once per instance, on the client only.
    seed();
    recordInstanceSeen(exerciseId);
  });

  const another = () => setAttempt((a) => a + 1);

  return { attempt, seed, instance, another };
}
