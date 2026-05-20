import { createEffect, type Accessor } from "solid-js";
import { useKeyboardInset } from "./use-keyboard-inset";
import type { RunResult } from "./use-yaegi-run";

/*
 * Move focus to the RunResultPanel when a fresh result lands, and
 * — on mobile, when the iOS soft keyboard is up — scroll the panel
 * into the visible slice above the keyboard.
 *
 * Shared between Freeform and FillBlankLineInput. Identity-tracking
 * via a closure-local `lastResultId` (rather than a Solid signal)
 * is the right shape: the tracker bookkeeping should never trigger
 * re-runs, and the reactive read is already provided by createEffect.
 *
 * Focus contract — design-docs/24 P4 (lighter variant):
 *   Sighted keyboard users land on the parsed result instead of
 *   staying stranded on the Run button; SR users land inside the
 *   labelled region.
 *
 * Scroll-into-view contract — design-docs/26 P11:
 *   On iOS Safari with the soft keyboard up, focusing the panel
 *   lands it BELOW the visualViewport cutoff — the learner has to
 *   dismiss the keyboard and scroll to see Run output. When
 *   `useKeyboardInset()` reports an occluded slice, scroll the
 *   panel's bottom edge into view (the stdout/error tail is the
 *   most informative anchor) and nudge by the inset so the panel
 *   isn't buried under the keyboard or MobileKeyBar.
 *   Respects `prefers-reduced-motion`.
 */
export function useRunResultFocus(runResult: Accessor<RunResult | null>): {
  ref: (el: HTMLDivElement) => void;
} {
  let panelRef: HTMLDivElement | undefined;
  let lastResultId: RunResult | null = null;
  const keyboardInset = useKeyboardInset();

  createEffect(() => {
    const r = runResult();
    if (r !== null && r !== lastResultId) {
      lastResultId = r;
      /* queueMicrotask waits one tick so the Show-gated panel
       * has actually mounted before we try to focus it. Same
       * pattern as ExerciseShell's feedbackRef focus. */
      queueMicrotask(() => {
        const el = panelRef;
        if (!el) return;
        el.focus();
        scrollAboveKeyboard(el, keyboardInset());
      });
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

/** When the iOS soft keyboard is up (`inset > 0`) AND the panel's
 *  bottom edge lands inside the occluded slice, bring its bottom
 *  edge into the visible viewport. Otherwise no-op — desktop and
 *  no-keyboard mobile already get acceptable focus-scroll from
 *  the browser default. */
function scrollAboveKeyboard(el: HTMLElement, inset: number): void {
  if (inset <= 0) return;
  if (typeof window === "undefined") return;
  const rect = el.getBoundingClientRect();
  const occludedTop = window.innerHeight - inset;
  /* Panel's bottom edge is above the keyboard already — nothing
   * to do. (Common when the panel is short + above the input.) */
  if (rect.bottom <= occludedTop) return;
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
  /* `block: "end"` anchors on the panel's bottom — for a tall run
   * result, the tail (stdout / error message) is the part the
   * learner needs to read first. The browser scrolls the bottom
   * edge to the viewport bottom; then we nudge UP by `inset` so
   * the panel sits ABOVE the soft keyboard, not behind it. */
  el.scrollIntoView({ block: "end", behavior });
  window.scrollBy({ top: -inset, behavior });
}
