import { createSignal } from "solid-js";
import { recordInstanceFailed, recordInstancePassed } from "./progress";

/**
 * The three discrete phases of an exercise attempt.
 *   "picking"  — learner is composing their answer; submit not yet pressed.
 *   "wrong"    — submitted but isCorrect() returned false.
 *   "right"    — submitted and isCorrect() returned true.
 */
export type Phase = "picking" | "wrong" | "right";

export interface UseExercisePhaseArgs {
  exerciseId: string;
  /** Predicate the hook calls on submit. */
  isCorrect: () => boolean;
  /** Predicate gating the submit action. False disables the submit button. */
  canSubmit: () => boolean;
  /** Called inside nextInstance() — the consumer should advance the
   *  underlying useExerciseInstance attempt counter AND reset its own
   *  answer state. */
  onAnother: () => void;
  /** Optional extra reset when the learner clicks Try Again. The shared
   *  state (submitted, revealed) is always cleared; this hook is for
   *  per-exercise-type state like input boxes. */
  onTryAgain?: () => void;
}

/**
 * Headless lifecycle for every exercise type. Owns:
 *   - submitted / revealed signals
 *   - phase derivation from those + the consumer's isCorrect predicate
 *   - submit / tryAgain / nextInstance / revealCorrect actions
 *   - progress recording for pass / fail
 *
 * Consumer keeps ownership of *answer state* — selected option for MCQ,
 * input values for fill-word, code for freeform. The hook is agnostic
 * to that and only cares whether `isCorrect()` returns true.
 *
 * The asymmetry — `recordInstancePassed` fires from `submit`, but
 * `recordInstanceFailed` only fires from `revealCorrect` — is
 * intentional and documented in design-docs/12-test-plan.md. A wrong
 * submit that the learner then corrects is recorded as a pass; a
 * wrong submit followed by reveal is recorded as a fail. Pinned
 * behaviour, not a bug.
 */
export function useExercisePhase(args: UseExercisePhaseArgs) {
  const [submitted, setSubmitted] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);

  const phase = (): Phase => {
    if (!submitted()) return "picking";
    return args.isCorrect() ? "right" : "wrong";
  };

  function submit() {
    if (!args.canSubmit() || submitted()) return;
    setSubmitted(true);
    if (args.isCorrect()) recordInstancePassed(args.exerciseId);
  }

  function tryAgain() {
    setSubmitted(false);
    setRevealed(false);
    args.onTryAgain?.();
  }

  function nextInstance() {
    setSubmitted(false);
    setRevealed(false);
    args.onAnother();
  }

  function revealCorrect() {
    setRevealed(true);
    recordInstanceFailed(args.exerciseId);
  }

  return {
    submitted,
    revealed,
    phase,
    submit,
    tryAgain,
    nextInstance,
    revealCorrect,
  };
}
