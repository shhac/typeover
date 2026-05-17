import { createEffect, createMemo, createSignal } from "solid-js";
import { generate, type ExerciseInstance, type GeneratorSpec } from "./generator";
import { recordInstanceSeen } from "./progress";

/**
 * Drives a single exercise's instance lifecycle: attempt counter,
 * deterministic seed, derived instance, and the "another" action.
 *
 * Side effects (recording instancesSeen) fire in a createEffect tied
 * to the seed — never in the memo — so memos stay pure and seen-counts
 * don't double-fire on hydration or HMR.
 *
 * Reused by every exercise type (MCQ now; FillBlank-Word / Line /
 * Freeform when they land).
 */
export function useExerciseInstance(
  exerciseId: string,
  generator: GeneratorSpec,
) {
  const [attempt, setAttempt] = createSignal(0);

  const seed = () => `${exerciseId}::${attempt()}`;
  const instance = createMemo<ExerciseInstance>(() => generate(generator, seed()));

  createEffect(() => {
    // Re-runs whenever the seed changes (i.e. attempt advances). Records
    // exactly once per instance, on the client only.
    seed();
    recordInstanceSeen(exerciseId);
  });

  const another = () => setAttempt((a) => a + 1);

  return { attempt, seed, instance, another };
}
