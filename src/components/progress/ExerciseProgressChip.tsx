import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { ProgressChip } from "~/components/ds";
import {
  getExerciseProgress,
  invalidateProgressCache,
  PROGRESS_CHANGED_EVENT,
  STORAGE_KEY,
} from "~/lib/progress";

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
 */

interface ExerciseProgressChipProps {
  exerciseId: string;
}

export function ExerciseProgressChip(props: ExerciseProgressChipProps) {
  const [slot, setSlot] = createSignal<ReturnType<typeof getExerciseProgress> | null>(null);

  const refresh = () => setSlot(getExerciseProgress(props.exerciseId));

  onMount(() => {
    refresh();
    /* `storage` only fires in OTHER tabs (per the spec). The cache
     * needs invalidating before re-read so we don't return the
     * snapshot captured pre-write in this tab's module-level cache. */
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        invalidateProgressCache();
        refresh();
      }
    };
    /* Same-tab — write() already updated the cache, just re-read. */
    const onSameTab = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(PROGRESS_CHANGED_EVENT, onSameTab);
    onCleanup(() => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROGRESS_CHANGED_EVENT, onSameTab);
    });
  });

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
