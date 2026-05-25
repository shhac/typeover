import { createEffect, createSignal, Match, Show, Switch, type JSX } from "solid-js";
import { Button, ButtonLink } from "../ds/Button";
import { Feedback } from "../ds/Feedback";
import { HintButton } from "../ds/HintButton";
import { InstructionLine } from "../ds/InstructionLine";
import { RevealButton } from "../ds/RevealButton";
import { Stack } from "../ds/Stack";
import { Text } from "../ds/Text";
import { CodeMirrorEditor } from "../ds/CodeMirrorEditor";
import { LANG_DISPLAY } from "~/lib/lang";
import { recordHintUsed } from "~/lib/progress";
import { formatInline } from "~/lib/format-inline";
import type { ExercisePhaseHandle } from "~/lib/exercise-phase";
import { cn } from "../ds/_internal";

/* Right-phase nav anchors use <ButtonLink> from the DS. Earlier
 * versions hand-rolled the primary-anchor class string here;
 * ButtonLink consolidates the spec into one place
 * (design-docs/17 F-1). */

/** Source pane on the exercise workbench. TS-only by default; when
 *  `source` + `sourceLang` are supplied, renders a tab strip so the
 *  learner can flip between the TS reference and the target-language
 *  source the question asks ABOUT (used by `mcq-explain`). */
function SourcePane(props: {
  ts: string;
  source: string | undefined;
  sourceLang: "go" | "zig" | "rust" | undefined;
}) {
  /* Inline view-state — the parent shell doesn't need to know which
   *  tab is active, and the tab switch shouldn't trigger any
   *  exercise lifecycle effects. */
  const [active, setActive] = createSignal<"ts" | "target">("ts");
  const hasToggle = () => props.source !== undefined && props.sourceLang !== undefined;
  const targetLabel = () => (props.sourceLang ? LANG_DISPLAY[props.sourceLang] : "");

  return (
    <Show
      when={hasToggle()}
      fallback={
        <Stack gap="sm">
          <InstructionLine class="mb-0">TypeScript reference</InstructionLine>
          {/* Read-only CodeMirror so syntax tokens match the live
           * editor below (palette-themed via design-docs/16 F-19
           * follow-up). Renders as a static <pre> inside vitest
           * per the editor's test-env fallback. */}
          <CodeMirrorEditor
            value={props.ts}
            readOnly
            language="ts"
            ariaLabel="TypeScript reference snippet"
          />
        </Stack>
      }
    >
      <Stack gap="sm">
        <div
          class="flex flex-row gap-1 -mb-px"
          role="tablist"
          aria-label="Source language"
        >
          <button
            type="button"
            role="tab"
            aria-selected={active() === "ts" ? "true" : "false"}
            class={tabButtonClass(active() === "ts")}
            onClick={() => setActive("ts")}
          >
            TypeScript
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active() === "target" ? "true" : "false"}
            class={tabButtonClass(active() === "target")}
            onClick={() => setActive("target")}
          >
            {targetLabel()}
          </button>
        </div>
        <Show
          when={active() === "ts"}
          fallback={
            <CodeMirrorEditor
              value={props.source!}
              readOnly
              language={props.sourceLang!}
              ariaLabel={`${targetLabel()} reference snippet`}
            />
          }
        >
          <CodeMirrorEditor
            value={props.ts}
            readOnly
            language="ts"
            ariaLabel="TypeScript reference snippet"
          />
        </Show>
      </Stack>
    </Show>
  );
}

/** Tab-strip button styling. Mirrors `interactiveTabClass` in
 *  CodeBlock so the exercise pane reads as the same visual idiom
 *  as the homepage's translation-drill tabs. */
function tabButtonClass(selected: boolean): string {
  return cn(
    "inline-flex items-center gap-2 max-w-full px-3 py-1.5 border rounded-t-sm font-sans text-sm transition-colors focus-ring",
    selected
      ? "bg-bg-inset border-border-default border-b-bg-inset text-fg-primary"
      : "bg-bg-panel border-transparent text-fg-muted hover:bg-bg-elevated hover:text-fg-secondary",
  );
}

interface ExerciseShellProps {
  /** For progress recording from the Hint button. */
  exerciseId: string;
  /** Top-of-exercise instruction text. */
  prompt: string;
  /** TS snippet shown above the answer region. */
  ts: string;
  /** Optional target-language source the exercise asks ABOUT. When
   *  set, the source pane renders TWO tabs ("TypeScript" + the
   *  target language) instead of TS-only. Used by mcq-explain
   *  whose answers are prose explanations of this source. The
   *  language is inferred from the `sourceLang` prop. */
  source?: string;
  /** Language label + syntax highlight for the `source` pane.
   *  Required when `source` is set; ignored otherwise. */
  sourceLang?: "go" | "zig" | "rust";
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

  /** Inserted between Submit and the rest of the picking-phase row,
   *  AND between Try-again and Different-exercise in the wrong-phase
   *  row. e.g. FillBlankWord's "Clear" button, Freeform/FillBlankLineInput's
   *  RunToolbar. Every existing caller passes the same JSX to both
   *  rows, so one prop covers both slots; the shell renders it twice.
   *  If a future surface needs different actions per phase, accept a
   *  `{ picking, wrong }` object — until then the single prop saves
   *  the "did I remember both?" footgun. */
  extraActions?: JSX.Element;

  /** Override the default "Correct — and idiomatic." message. */
  correctMessage?: JSX.Element;
  /** Override the default "Not quite — try again or reveal." message. */
  wrongMessage?: JSX.Element;

  /** URL of the next exercise in this theme. When present, ExerciseShell
   *  shows a "Next exercise →" button in the right-phase toolbar. When
   *  absent (last exercise in theme), the right-phase falls back to a
   *  "back to theme" link. Cross-exercise nav for the picking + wrong
   *  phases lives in the header (BaseLayout's ← / → arrows) rather
   *  than the toolbar — the toolbar focuses on the active workflow. */
  nextExerciseHref?: string;
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

  return (
    <section
      class="ds-panel overflow-hidden border border-border-default rounded-sm bg-bg-panel"
      aria-label="Exercise workbench"
    >
      {/* Prompt stays visible while the learner works. The prompt is
       * the work order for the bench, not a decorative page heading. */}
      <div class="sticky top-0 z-10 px-4 sm:px-6 py-3 bg-bg-base/90 backdrop-blur-sm border-b border-border-default">
        <Text tone="secondary" size="sm" family="mono">
          <span innerHTML={formatInline(props.prompt)} />
        </Text>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-b border-border-default">
        <section class="p-4 sm:p-6 lg:border-r lg:border-border-default bg-bg-panel">
          {/* Source pane. Default: TS-only (single read-only
           *  CodeMirror). When `source` + `sourceLang` are supplied
           *  (mcq-explain), render a tab strip so the learner can
           *  toggle between TS and the target-language source the
           *  question asks ABOUT. */}
          <SourcePane
            ts={props.ts}
            source={props.source}
            sourceLang={props.sourceLang}
          />
        </section>

        <section class="p-4 sm:p-6 bg-bg-base/30">
          <Stack gap="lg">{props.children}</Stack>
        </section>
      </div>

      <div class="p-4 sm:p-6">
        <Stack gap="lg">
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
            {/* Cross-exercise navigation (Previous + Skip-ahead) used
             * to live here as toolbar buttons; moved to the header's
             * ← / → arrow chrome (BaseLayout) per the 2026-05-21
             * screenshot review — the toolbar is now reserved for the
             * active workflow (Submit / Run / Try-again / Reveal /
             * Next-exercise) and never holds cross-exercise nav. */}
            <Switch>
              <Match when={phase() === "picking"}>
                <Button
                  variant="primary"
                  onClick={() => props.phase.submit()}
                  disabled={!props.phase.canSubmit()}
                >
                  Submit
                </Button>
                {props.extraActions}
              </Match>
              <Match when={phase() === "wrong"}>
                <Button variant="secondary" onClick={() => props.phase.tryAgain()}>
                  Try again
                </Button>
                {props.extraActions}
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
               * Without this, a learner who clicked "Show answer"
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
      </div>
    </section>
  );
}
