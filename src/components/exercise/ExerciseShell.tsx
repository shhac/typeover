import { Match, Show, Switch, type JSX } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { Feedback } from "../ds/Feedback";
import { HintButton } from "../ds/HintButton";
import { RevealButton } from "../ds/RevealButton";
import { Stack } from "../ds/Stack";
import { Text } from "../ds/Text";
import { recordHintUsed } from "~/lib/progress";
import type { ExercisePhaseHandle } from "~/lib/exercise-phase";

interface ExerciseShellProps {
  /** For progress recording from the Hint button. */
  exerciseId: string;
  /** Top-of-exercise instruction text. */
  prompt: string;
  /** TS snippet shown above the answer region. */
  ts: string;
  /** Canonical Go answer. Surfaced by the on-demand RevealButton. */
  canonical: string;
  /** Three-layer hint stack. */
  hints: readonly [string, string, string];

  /** The full lifecycle handle produced by useExercisePhase. The shell
   *  reads the current phase and dispatches every action through this
   *  one object; consumers pass `phase={phase}` once instead of
   *  plumbing six accessors individually. */
  phase: ExercisePhaseHandle;
  /** Predicate gating the Submit button. Supplied by the consumer
   *  (each exercise type has its own readiness rule) rather than
   *  living on the phase handle, since the hook doesn't know about
   *  the answer state. */
  canSubmit: () => boolean;

  /** Inserted between Submit and the rest of the picking-phase row.
   *  e.g. FillBlankWord's "Clear" button. */
  extraPickingActions?: JSX.Element;
  /** Inserted between Try-again and Different-exercise in the wrong-phase
   *  row. e.g. FillBlankWord's "Clear" button. */
  extraWrongActions?: JSX.Element;

  /** Override the default "Correct — and idiomatic." message. */
  correctMessage?: JSX.Element;
  /** Override the default "Not quite — try again or reveal." message. */
  wrongMessage?: JSX.Element;

  /** The answer region — radio fieldset, blank inputs, code editor. */
  children: JSX.Element;
}

/**
 * Shared chrome for every exercise type. Owns the prompt header, the
 * Feedback panel, the action toolbar, and the Hint+Reveal footer.
 * Exercise-type-specific UI (the answer region) lives in `children`.
 *
 * State is supplied via the phase handle from useExercisePhase plus a
 * `canSubmit` predicate. The shell never reads or mutates exercise
 * state directly — it just dispatches through the handle.
 */
export function ExerciseShell(props: ExerciseShellProps) {
  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Text tone="secondary" size="sm" family="mono">
          {props.prompt}
        </Text>
        <CodeBlock lang="ts" filename="typescript">
          {props.ts}
        </CodeBlock>
      </Stack>

      {props.children}

      <Show when={props.phase.current() !== "picking"}>
        <Feedback status={props.phase.current() === "right" ? "correct" : "incorrect"}>
          <Show
            when={props.phase.current() === "right"}
            fallback={
              props.wrongMessage ?? (
                <span>
                  Not quite. Try again, grab a different exercise, or reveal the
                  canonical answer.
                </span>
              )
            }
          >
            {props.correctMessage ?? <span>Correct — and idiomatic.</span>}
          </Show>
        </Feedback>
      </Show>

      <Stack direction="row" gap="sm" wrap>
        <Switch>
          <Match when={props.phase.current() === "picking"}>
            <Button
              variant="primary"
              onClick={() => props.phase.submit()}
              disabled={!props.canSubmit()}
            >
              Submit
            </Button>
            {props.extraPickingActions}
          </Match>
          <Match when={props.phase.current() === "wrong"}>
            <Button variant="secondary" onClick={() => props.phase.tryAgain()}>
              Try again
            </Button>
            {props.extraWrongActions}
            <Button variant="ghost" onClick={() => props.phase.nextInstance()}>
              Different exercise
            </Button>
            <Show when={!props.phase.revealed()}>
              <Button variant="ghost" onClick={() => props.phase.revealCorrect()}>
                Reveal correct
              </Button>
            </Show>
          </Match>
          <Match when={props.phase.current() === "right"}>
            <Button variant="primary" onClick={() => props.phase.nextInstance()}>
              Another
            </Button>
          </Match>
        </Switch>
      </Stack>

      <Stack direction="row" gap="lg" wrap>
        <HintButton
          hints={props.hints}
          onReveal={() => recordHintUsed(props.exerciseId)}
        />
        <RevealButton canonical={props.canonical} lang="go" />
      </Stack>
    </Stack>
  );
}
