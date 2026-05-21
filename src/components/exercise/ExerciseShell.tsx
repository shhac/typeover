import {
  createEffect,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  type JSX,
} from "solid-js";
import { Button, ButtonLink } from "../ds/Button";
import { Feedback } from "../ds/Feedback";
import { HintButton } from "../ds/HintButton";
import { RevealButton } from "../ds/RevealButton";
import { Stack } from "../ds/Stack";
import { Text } from "../ds/Text";
import { CodeMirrorEditor } from "./CodeMirrorEditor";
import {
  getExerciseProgress,
  invalidateProgressCache,
  PROGRESS_CHANGED_EVENT,
  recordHintUsed,
  STORAGE_KEY,
} from "~/lib/progress";
import { formatInline } from "~/lib/format-inline";
import type { ExercisePhaseHandle } from "~/lib/exercise-phase";

/* Right-phase nav anchors use <ButtonLink> from the DS. Earlier
 * versions hand-rolled the primary-anchor class string here;
 * ButtonLink consolidates the spec into one place
 * (design-docs/17 F-1). */

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
   *  shows a "Next exercise →" button in the right-phase toolbar. When
   *  absent (last exercise in theme), the right-phase falls back to a
   *  "back to theme" link.
   *
   *  Also drives the picking-phase "Skip ahead →" button, which only
   *  appears when (a) this exercise has been previously passed AND
   *  (b) a next href exists. Lets a returning learner skip past an
   *  exercise they've already solved without re-submitting. */
  nextExerciseHref?: string;
  /** URL of the previous exercise — symmetric to nextExerciseHref.
   *  Renders a "← Previous" ghost link in every phase so a learner who
   *  isn't ready to move on can back up. Omitted when this is the
   *  first exercise in the curriculum. */
  prevExerciseHref?: string;
  /** URL of the parent theme's overview page. Always passed by the
   *  route; used as the right-phase fallback when nextExerciseHref is
   *  absent. */
  themeHref?: string;

  /** When true, the shell's footer RevealButton is hidden — the
   *  consumer is rendering its own reveal surface inline near the
   *  input area. fill-line + freeform set this; MCQ does not. */
  ownsReveal?: boolean;

  /** Optional disclosure rendered in the right-phase success area
   *  alongside the standard correct-feedback. Used when the
   *  graded canonical is intentionally a step behind the modern
   *  idiom (e.g. typeover's Yaegi runtime can't run Go 1.21
   *  generic-stdlib functions yet). Plain markdown-inline via
   *  `formatInline`. Empty / undefined → no extra surface. */
  successNote?: string;

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

  /* Focus management on phase transition. Without this, hitting
   * Submit on a keyboard-only nav drops focus to <body> when the
   * Submit button is removed from the toolbar — keyboard / screen-
   * reader users lose their place. The Feedback panel is
   * tabindex=-1 so it's programmatically focusable but not in the
   * tab order; we focus it on transition so a Tab forward from
   * there reaches the new primary action. design-docs/19 F-12. */
  let feedbackRef: HTMLDivElement | undefined;
  let lastPhase: string = "picking";
  createEffect(() => {
    const current = phase();
    if ((current === "wrong" || current === "right") && current !== lastPhase) {
      queueMicrotask(() => feedbackRef?.focus());
    }
    lastPhase = current;
  });

  /* Track whether this exercise has been previously passed (across
   * sessions / re-visits). When true AND a next href exists, the
   * picking phase surfaces a "Skip ahead →" button so a returning
   * learner can jump past an exercise they've already solved
   * without re-submitting. User-asked feature 2026-05-21. */
  const [previouslyPassed, setPreviouslyPassed] = createSignal(false);
  const refreshPreviouslyPassed = () => {
    setPreviouslyPassed(getExerciseProgress(props.exerciseId).instancesPassed > 0);
  };
  onMount(() => {
    refreshPreviouslyPassed();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        invalidateProgressCache();
        refreshPreviouslyPassed();
      }
    };
    const onSameTab = () => refreshPreviouslyPassed();
    window.addEventListener("storage", onStorage);
    window.addEventListener(PROGRESS_CHANGED_EVENT, onSameTab);
    onCleanup(() => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROGRESS_CHANGED_EVENT, onSameTab);
    });
  });
  return (
    <Stack gap="lg">
      {/* Prompt stays visible while the learner works.
       * `sticky top-0` with a backdrop-blurred surface so the
       * prompt rides above the page as they scroll into the
       * answer region. design-docs/16 F-21. */}
      <div class="sticky top-0 z-10 -mx-2 px-2 py-2 bg-bg-base/85 backdrop-blur-sm border-b border-border-default/60">
        <Text tone="secondary" size="sm" family="mono">
          <span innerHTML={formatInline(props.prompt)} />
        </Text>
      </div>
      <Stack gap="sm">
        {/* TS-source pane: read-only CodeMirror so syntax tokens
         * match the live editor below (palette-themed via
         * design-docs/16 F-19 follow-up). Renders as a static
         * <pre> inside vitest per the editor's test-env fallback. */}
        <div class="text-micro uppercase tracking-widest text-fg-muted">
          TypeScript reference
        </div>
        <CodeMirrorEditor
          value={props.ts}
          readOnly
          language="ts"
          ariaLabel="TypeScript reference snippet"
        />
      </Stack>

      {props.children}

      <Show when={phase() !== "picking"}>
        <Feedback
          status={phase() === "right" ? "correct" : "incorrect"}
          ref={(el) => {
            feedbackRef = el;
          }}
        >
          <Show
            when={phase() === "right"}
            fallback={
              props.wrongMessage ?? (
                <span>
                  Not quite. Try again, reshuffle this exercise, or reveal the answer.
                </span>
              )
            }
          >
            {props.correctMessage ?? <span>Correct — and idiomatic.</span>}
          </Show>
        </Feedback>
        <Show when={phase() === "right" && props.successNote}>
          {(note) => (
            <Text tone="secondary" size="sm">
              <span innerHTML={formatInline(note())} />
            </Text>
          )}
        </Show>
      </Show>

      <Stack direction="row" gap="sm" wrap>
        {/* "← Previous" lives in every phase as a quiet ghost link.
         * A learner who lost their thread can back up without
         * committing to anything; the Submit / Try-again / Next
         * primary actions stay where they were. Omitted when this
         * is the first exercise in the curriculum
         * (prevExerciseHref is undefined). User-asked 2026-05-21. */}
        <Show when={props.prevExerciseHref}>
          {(href) => (
            <ButtonLink href={href()} variant="ghost">
              ← Previous
            </ButtonLink>
          )}
        </Show>
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
            {/* "Skip ahead →" — only when the learner has previously
             * passed this exercise. Lets a returning visitor jump
             * past solved exercises without re-submitting. The
             * action is intentionally a secondary button (not
             * primary) so a first-time visitor sees a clean
             * Submit-led toolbar; only the previously-passed state
             * surfaces the extra control. */}
            <Show when={previouslyPassed() && props.nextExerciseHref}>
              {(href) => (
                <ButtonLink href={href()} variant="secondary">
                  Skip ahead →
                </ButtonLink>
              )}
            </Show>
          </Match>
          <Match when={phase() === "wrong"}>
            <Button variant="secondary" onClick={() => props.phase.tryAgain()}>
              Try again
            </Button>
            {props.extraWrongActions}
            <Button variant="ghost" onClick={() => props.phase.nextInstance()}>
              Reshuffle this exercise
            </Button>
            <Show when={!props.phase.revealed()}>
              {/* Reveal records the exercise as failed (per the
               * canonical pedagogy contract in design-docs/12).
               * Earlier copy was just "Reveal correct" with no
               * disclosure — a learner clicking it for help got
               * silently penalised. design-docs/16 F-6. */}
              <Button
                variant="ghost"
                onClick={() => props.phase.revealCorrect()}
                title="Reveals the answer and records this exercise as failed."
              >
                Reveal answer (counts as fail)
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
              Try a fresh variant
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
          {/* Footer reveal records the same way Hint does — a peek
           * at the canonical pre-submit is a hint-equivalent.
           * Without this, a learner who clicked "Show canonical"
           * before picking an MCQ got no progress signal, while a
           * learner who tried and failed and THEN revealed paid a
           * full failure — same surface, different cost. design-
           * docs/19 F-15. */}
          <RevealButton
            canonical={props.canonical}
            lang="go"
            onReveal={() => recordHintUsed(props.exerciseId)}
          />
        </Show>
      </Stack>
    </Stack>
  );
}
