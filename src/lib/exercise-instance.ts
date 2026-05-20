import { createEffect, createMemo, createSignal } from "solid-js";
import { generate, type ExerciseInstance, type GenerateOptions } from "./generator-runtime";
import type { GeneratorSpec } from "./generator-schema";
import { recordInstanceSeen } from "./progress";

/**
 * Drives a single exercise's instance lifecycle: attempt counter,
 * deterministic seed, derived instance, and the "another" action.
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
  const [attempt, setAttempt] = createSignal(0);

  const seed = () => `${exerciseId}::${attempt()}`;
  const instance = createMemo<ExerciseInstance>(() => generate(generator, seed(), opts));

  createEffect(() => {
    // Re-runs whenever the seed changes (i.e. attempt advances). Records
    // exactly once per instance, on the client only.
    seed();
    recordInstanceSeen(exerciseId);
  });

  const another = () => setAttempt((a) => a + 1);

  return { attempt, seed, instance, another };
}
