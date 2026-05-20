import { createEffect, type Accessor } from "solid-js";
import type { RunResult } from "./use-yaegi-run";

/*
 * Move focus to the RunResultPanel when a fresh result lands.
 * Sighted keyboard users land on the parsed result instead of
 * staying stranded on the Run button; SR users land inside the
 * labelled region.
 *
 * Shared between Freeform and FillBlankLineInput — both react the
 * same way to a fresh `yaegi.runResult()` reference. Identity-
 * tracking via a closure-local `lastResultId` (rather than a Solid
 * signal) is the right shape here: the tracker bookkeeping should
 * never trigger re-runs, and the reactive read is already provided
 * by createEffect.
 *
 * Lighter variant of design-docs/24 P4. Replaces the verbatim
 * duplication that was in Freeform.tsx + FillBlankLineInput.tsx.
 */
export function useRunResultFocus(runResult: Accessor<RunResult | null>): {
  ref: (el: HTMLDivElement) => void;
} {
  let panelRef: HTMLDivElement | undefined;
  let lastResultId: RunResult | null = null;

  createEffect(() => {
    const r = runResult();
    if (r !== null && r !== lastResultId) {
      lastResultId = r;
      /* queueMicrotask waits one tick so the Show-gated panel
       * has actually mounted before we try to focus it. Same
       * pattern as ExerciseShell's feedbackRef focus. */
      queueMicrotask(() => panelRef?.focus());
    } else if (r === null) {
      lastResultId = null;
    }
  });

  return {
    ref: (el) => {
      panelRef = el;
    },
  };
}
