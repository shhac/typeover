import { Match, Show, Switch, type JSX } from "solid-js";
import { Button, ButtonLink } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { Feedback } from "../ds/Feedback";
import { HintButton } from "../ds/HintButton";
import { RevealButton } from "../ds/RevealButton";
import { Stack } from "../ds/Stack";
import { Text } from "../ds/Text";
import { recordHintUsed } from "~/lib/progress";
import { formatInline } from "~/lib/format-inline";
import type { ExercisePhaseHandle } from "~/lib/exercise-phase";

/* Anchor styled to match Button's primary variant + md size. Inlined
 * here rather than via a polymorphic Button to keep the scope of the
 * Next-exercise nav small; if a third site needs an anchor-button,
 * extract a ButtonLink. */
/* Right-phase nav anchors use <ButtonLink> from the DS. Earlier
 * versions hand-rolled the primary-anchor class string here;
 * ButtonLink consolidates the spec into one place. */

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
  /** Resolved instance values, passed to HintButton so a hint like
   *  `${name} := ${value}` renders with the learner's current values
   *  substituted rather than as the literal placeholders. Optional —
   *  template generators populate it; variant / procedural don't. */
  hintValues?: Record<string, string>;

  /** The full lifecycle handle produced by useExercisePhase. The shell
   *  reads the current phase, the canSubmit gate, and dispatches every
   *  action through this one object; consumers pass `phase={phase}`
   *  once. */
  phase: ExercisePhaseHandle;

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

  /** URL of the next exercise in this theme. When present, ExerciseShell
   *  shows a "Next exercise →" button in the right-phase toolbar (and a
   *  secondary "skip ahead" link in the picking-phase footer). When
   *  absent (last exercise in theme), the right-phase Falls back to a
   *  "back to theme" link. */
  nextExerciseHref?: string;
  /** URL of the parent theme's overview page. Always passed by the
   *  route; used as the right-phase fallback when nextExerciseHref is
   *  absent. */
  themeHref?: string;

  /** When true, the shell's footer RevealButton is hidden — the
   *  consumer is rendering its own reveal surface inline near the
   *  input area. fill-line + freeform set this; MCQ does not. */
  ownsReveal?: boolean;

  /** The answer region — radio fieldset, blank inputs, code editor. */
  children: JSX.Element;
}

/**
 * Shared chrome for every exercise type. Owns the prompt header, the
 * Feedback panel, the action toolbar, and the Hint+Reveal footer.
 * Exercise-type-specific UI (the answer region) lives in `children`.
 *
 * State is supplied via the phase handle from useExercisePhase. The
 * shell never reads or mutates exercise state directly — it just
 * dispatches through the handle.
 */
export function ExerciseShell(props: ExerciseShellProps) {
  // Local accessor — `props.phase.current()` reads heavy at 6 call
  // sites. Solid's reactivity is preserved as long as we keep it as
  // a function (don't destructure props.phase here).
  const phase = () => props.phase.current();
  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Text tone="secondary" size="sm" family="mono">
          <span innerHTML={formatInline(props.prompt)} />
        </Text>
        <CodeBlock lang="ts" filename="typescript">
          {props.ts}
        </CodeBlock>
      </Stack>

      {props.children}

      <Show when={phase() !== "picking"}>
        <Feedback status={phase() === "right" ? "correct" : "incorrect"}>
          <Show
            when={phase() === "right"}
            fallback={
              props.wrongMessage ?? (
                <span>
                  Not quite. Try again, grab a different exercise, or reveal the canonical answer.
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
          <Match when={phase() === "picking"}>
            <Button
              variant="primary"
              onClick={() => props.phase.submit()}
              disabled={!props.phase.canSubmit()}
            >
              Submit
            </Button>
            {props.extraPickingActions}
          </Match>
          <Match when={phase() === "wrong"}>
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
          <Match when={phase() === "right"}>
            <Show
              when={props.nextExerciseHref}
              fallback={
                <Show when={props.themeHref}>
                  {(href) => (
                    <ButtonLink href={href()} variant="primary">
                      Back to theme overview
                    </ButtonLink>
                  )}
                </Show>
              }
            >
              {(href) => (
                <ButtonLink href={href()} variant="primary">
                  Next exercise →
                </ButtonLink>
              )}
            </Show>
            <Button variant="ghost" onClick={() => props.phase.nextInstance()}>
              Try again with a different instance
            </Button>
          </Match>
        </Switch>
      </Stack>

      <Stack direction="row" gap="lg" wrap>
        <HintButton
          hints={props.hints}
          values={props.hintValues}
          onReveal={() => recordHintUsed(props.exerciseId)}
        />
        <Show when={!props.ownsReveal}>
          <RevealButton canonical={props.canonical} lang="go" />
        </Show>
      </Stack>
    </Stack>
  );
}
