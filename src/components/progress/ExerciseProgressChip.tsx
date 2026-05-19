import { createSignal, onMount, Show } from "solid-js";
import { ProgressChip } from "~/components/ds";
import { getExerciseProgress } from "~/lib/progress";

/*
 * Per-exercise chip island. Renders "seen 3 · passed 2" beneath an
 * exercise card on the theme overview when the learner has touched
 * the exercise before. Returns null on a fresh slot so first-time
 * visitors see the cards unchanged.
 */

interface ExerciseProgressChipProps {
  exerciseId: string;
}

export function ExerciseProgressChip(props: ExerciseProgressChipProps) {
  const [slot, setSlot] = createSignal<ReturnType<typeof getExerciseProgress> | null>(null);

  onMount(() => setSlot(getExerciseProgress(props.exerciseId)));

  return (
    <Show
      when={(() => {
        const s = slot();
        return s !== null && s.instancesSeen > 0;
      })()}
      fallback={<span class="inline-block" style={{ "min-width": "16ch" }} aria-hidden="true" />}
    >
      {(() => {
        const s = slot();
        if (s === null) return null;
        return (
          <ProgressChip
            kind="exercise"
            seen={s.instancesSeen}
            passed={s.instancesPassed}
            minCh={16}
          />
        );
      })()}
    </Show>
  );
}
