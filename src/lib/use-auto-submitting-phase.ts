import type { ExercisePhaseHandle } from "./exercise-phase";
import {
  useAutoSubmitOnCorrect,
  type UseAutoSubmitOnCorrectArgs,
} from "./use-auto-submit-on-correct";

/*
 * Compose an exercise-phase handle that auto-Runs on Submit and
 * auto-Submits on a correct Run. The two halves of the
 * design-docs/26-ux-asks "smart submit" contract used to live
 * separately in FillBlankLineInput:
 *
 *   1. `useAutoSubmitOnCorrect` — the createEffect that commits
 *      a fresh correct RunResult.
 *   2. An inline `ownPhase` plain-object wrapper that re-forwarded
 *      five phase methods just to intercept `submit()` and trigger
 *      a Run when no result was buffered yet.
 *
 * The two are useful together exactly once today (fill-line),
 * but neither half is fill-line-specific — both apply to any
 * exercise type whose grading needs a fresh Run to commit.
 * Bundled here as a single hook so the component reads:
 *
 *   const phase = useAutoSubmittingPhase({ phase: inner, ... });
 *
 * instead of plumbing the runResult/running/isCorrect args to
 * `useAutoSubmitOnCorrect` AND constructing a wrapper object that
 * re-exports 4-of-5 methods unchanged.
 */

export interface UseAutoSubmittingPhaseArgs extends UseAutoSubmitOnCorrectArgs {
  /** Predicate the wrapper enforces in BOTH `canSubmit` (so the
   *  shell's disabled state matches) and `submit()` (so a stale
   *  manual click is a no-op). Typical shape:
   *  `() => input().trim() !== ""`. */
  hasInput: () => boolean;
  /** Imperative kick-off for the runtime. Wrapper calls this when
   *  Submit is clicked but no RunResult is buffered yet — the
   *  auto-submit effect from `useAutoSubmitOnCorrect` commits the
   *  verdict if the Run grades correct; otherwise the learner
   *  stays in picking with the result panel visible. */
  startRun: () => void;
  /** Reactive accessor for the latest run result, or null
   *  pre-first-run / post-reset. Reused here from the wrapped
   *  hook's signature so `submit()` can branch on its presence
   *  without a second arg list. */
  runResult: UseAutoSubmitOnCorrectArgs["runResult"];
}

export interface UseAutoSubmittingPhase {
  /** ExercisePhaseHandle ready to hand to ExerciseShell. */
  phase: ExercisePhaseHandle;
  /** Drop the auto-submit re-fire guard. Call from inner phase's
   *  `onAnother` / `onTryAgain` so a stale RunResult identity
   *  doesn't suppress a future commit. */
  reset: () => void;
}

export function useAutoSubmittingPhase(args: UseAutoSubmittingPhaseArgs): UseAutoSubmittingPhase {
  const autoSubmit = useAutoSubmitOnCorrect({
    runResult: args.runResult,
    running: args.running,
    isCorrect: args.isCorrect,
    phase: args.phase,
  });

  const wrapped: ExercisePhaseHandle = {
    submitted: args.phase.submitted,
    revealed: args.phase.revealed,
    current: args.phase.current,
    canSubmit: () => args.hasInput() && !args.running() && args.phase.current() === "picking",
    submit: () => {
      if (args.running()) return;
      if (!args.hasInput()) return;
      if (args.runResult() === null) {
        /* No fresh Run — kick one off. The auto-submit effect
         * commits the verdict if the Run grades correct;
         * otherwise the learner stays in picking with the result
         * panel visible to inspect and iterate. */
        args.startRun();
        return;
      }
      args.phase.submit();
    },
    tryAgain: args.phase.tryAgain,
    nextInstance: args.phase.nextInstance,
    revealCorrect: args.phase.revealCorrect,
  };

  return { phase: wrapped, reset: autoSubmit.reset };
}
