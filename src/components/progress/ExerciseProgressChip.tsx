import { createMemo, createSignal, Show } from "solid-js";
import { ProgressChip } from "~/components/ds";
import { getExerciseProgress } from "~/lib/progress";
import { useProgressListener } from "~/lib/use-progress-listener";

/*
 * Per-exercise chip island. Renders "seen 3 · passed 2" beneath an
 * exercise card on the theme overview when the learner has touched
 * the exercise before. Returns null on a fresh slot so first-time
 * visitors see the cards unchanged.
 *
 * Reacts to both the cross-tab `storage` event and the same-tab
 * PROGRESS_CHANGED_EVENT so chips on a theme overview update when
 * the learner passes an exercise without leaving the tab — and the
 * other-tab case the QA review called out in design-docs/19 F-20.
 *
 * design-docs/20 lens-5 — the earlier `<Show>` body used an IIFE
 * `{(() => { ... })()}` for children which is evaluated ONCE at
 * render and never reactive. The function-child pattern below
 * receives an accessor to the non-null slot and re-renders the chip
 * each time slot() updates.
 */

interface ExerciseProgressChipProps {
  exerciseId: string;
}

export function ExerciseProgressChip(props: ExerciseProgressChipProps) {
  const [slot, setSlot] = createSignal<ReturnType<typeof getExerciseProgress> | null>(null);

  /* Clone the returned slot so subsequent writes — which mutate
   * `cachedProgress.exercises[id]` in place via `bumpExercise` —
   * land on a fresh object reference. Without the clone, Solid's
   * default `===` equality short-circuits the second setSlot and
   * the chip stalls on the first post-mount update. */
  const refresh = () => setSlot({ ...getExerciseProgress(props.exerciseId) });

  /* Memo gates `<Show>` on "non-null slot with at least one seen
   * instance"; returning the slot itself lets the function-child
   * receive a typed accessor instead of a boolean. */
  const visibleSlot = createMemo(() => {
    const s = slot();
    return s !== null && s.instancesSeen > 0 ? s : null;
  });

  useProgressListener(refresh);

  return (
    <Show
      when={visibleSlot()}
      fallback={<span class="inline-block" style={{ "min-width": "16ch" }} aria-hidden="true" />}
    >
      {(s) => (
        <ProgressChip
          kind="exercise"
          seen={s().instancesSeen}
          passed={s().instancesPassed}
          minCh={16}
        />
      )}
    </Show>
  );
}
