import { createEffect } from "solid-js";
import type { RunResult } from "./use-yaegi-run";
import type { ExercisePhaseHandle } from "./exercise-phase";

/*
 * Auto-Submit on correct Run. Extracted from FillBlankLineInput
 * per the function-decomp lens — the choreography of "result
 * lands → was it correct → are we still picking → commit verdict"
 * mixed naturally with the rest of the component but is its own
 * state machine, with its own re-fire guard, and benefits from
 * being isolated.
 *
 * Behavioural contract:
 *
 *   1. When `runResult()` transitions from null → non-null AND
 *      `yaegi.running()` is false AND `isCorrect()` returns true
 *      AND phase is still "picking" → call `phase.submit()`.
 *   2. The same RunResult identity never re-fires submit() — we
 *      stash the last-submitted result reference and bail when
 *      it matches.
 *   3. `reset()` lets the caller drop the stash (used by both
 *      "Try a fresh variant" → onAnother and "Try again" →
 *      onTryAgain so a later identical-by-reference (test mode) or
 *      stale result doesn't get re-submitted).
 *
 * The hook re-runs phase.submit() at most once per RunResult
 * instance. It also re-tracks `yaegi.running()`: useYaegiRun sets
 * runResult BEFORE flipping running back to false, so without
 * re-tracking running the effect would fire too early and bail on
 * the canSubmit gate.
 */

export interface UseAutoSubmitOnCorrectArgs {
  /** Reactive accessor for the latest run result, or null
   *  pre-first-run / post-reset. */
  runResult: () => RunResult | null;
  /** Reactive accessor — true while a run is in flight. */
  running: () => boolean;
  /** Reactive predicate for "this result grades correct." Callers
   *  typically check stdout match OR alternate-canonical match. */
  isCorrect: () => boolean;
  /** Phase handle to commit through. */
  phase: ExercisePhaseHandle;
}

export function useAutoSubmitOnCorrect(args: UseAutoSubmitOnCorrectArgs): {
  reset: () => void;
} {
  let autoSubmittedFor: object | null = null;
  createEffect(() => {
    const r = args.runResult();
    if (args.running()) return;
    if (r === null || r === autoSubmittedFor) return;
    if (args.phase.current() !== "picking") return;
    if (args.isCorrect()) {
      autoSubmittedFor = r;
      args.phase.submit();
    }
  });
  return {
    reset: () => {
      autoSubmittedFor = null;
    },
  };
}
