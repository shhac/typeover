import { createSignal } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase, type ExercisePhaseHandle } from "~/lib/exercise-phase";
import type { ExerciseInstance } from "~/lib/generator-runtime";

export function useMcqState(exerciseId: string, generator: GeneratorSpec) {
  const { instance, another } = useExerciseInstance(exerciseId, generator);

  const [selected, setSelected] = createSignal<number | null>(null);

  const options = () => instance().options ?? [];
  const correctIndex = () => instance().correctIndex ?? -1;
  const isCorrect = () => selected() === correctIndex();
  const canSubmit = () => selected() !== null;

  const phase = useExercisePhase({
    exerciseId,
    isCorrect,
    canSubmit,
    onAnother: () => {
      another();
      setSelected(null);
    },
    onTryAgain: () => setSelected(null),
  });

  return { instance, selected, setSelected, options, correctIndex, phase };
}
