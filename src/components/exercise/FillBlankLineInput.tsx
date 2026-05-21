import { createEffect, createSignal, onMount, Show } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase, type ExercisePhaseHandle } from "~/lib/exercise-phase";
import { substituteAtBlank } from "~/lib/fill-blank";
import { normaliseSubmission } from "~/lib/submission-normalise";
import { useRunResultFocus } from "~/lib/use-run-result-focus";
import { insertAtFocused } from "~/lib/textarea-insert";
import { useYaegiRun } from "~/lib/use-yaegi-run";
import { matchWrongPattern } from "~/lib/wrong-pattern";
import { MobileKeyBar } from "../ds/MobileKeyBar";
import { Text } from "../ds/Text";
import { ExerciseShell } from "./ExerciseShell";
import { BlankInput } from "./BlankInput";
import { CodeMirrorFillBlanks } from "../ds/CodeMirrorFillBlanks";
import { InlineCanonicalReveal } from "./InlineCanonicalReveal";
import { RunResetToolbar } from "./RunResetToolbar";
import { RunResultPanel } from "./RunResultPanel";

interface FillBlankLineInputProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  blanks: string[];
  hints: readonly [string, string, string];
  /** The exact stdout the substituted canonical should produce when
   *  the learner's input is correct. */
  expectStdout: string;
  /** Must be "yaegi" for the input+Yaegi grading mode (schema enforces). */
  runtime: "yaegi";
  /** Alternate submission strings that grade correct even when
   *  Yaegi can't run them (e.g. Go 1.21+ generic-stdlib forms our
   *  Yaegi build doesn't support yet). Whitespace-normalised match.
   *  Paired with `successNote` so the UI explains why a perfect
   *  modern answer passed despite Yaegi's failure. */
  alternateCanonicals?: readonly string[];
  /** Disclosure shown alongside the correct-feedback. Surfaces the
   *  modern canonical when the graded one is intentionally a step
   *  behind for runtime-limitation reasons. */
  successNote?: string;
  nextExerciseHref?: string;
  themeHref?: string;
}

/*
 * fill-line UX — "type the code for this one line." Single text
 * input embedded in the canonical scaffold, Run via Yaegi, grade
 * stdout against expectStdout.
 *
 * The run lifecycle lives in `useYaegiRun`; the result panel + run
 * toolbar are shared components in this directory. Everything left
 * here is fill-line-specific: the input signal, the
 * substitute-at-blank → program text wiring, the Enter-to-Run
 * keybind, and the canSubmit predicate.
 */
export function FillBlankLineInput(props: FillBlankLineInputProps) {
  const { instance, another } = useExerciseInstance(props.exerciseId, props.generator, {
    blanks: props.blanks,
  });

  const [input, setInput] = createSignal("");

  const yaegi = useYaegiRun({
    buildProgram: () => substituteAtBlank(instance(), input()),
  });

  /* Preflight WASM on mount — fill-line is always Yaegi-runtime per
   * schema, so there's no `runtime === "yaegi"` gate here. Surfaces
   * the cold-start as a "Booting Go runtime…" badge instead of a
   * frozen Run button. design-docs/16 F-4. */
  onMount(() => yaegi.preflight());

  /* Submission matches one of the authored alternate canonicals
   * (whitespace-normalised). Used to grade a "perfect" modern answer
   * correct when Yaegi can't run it — e.g. `slices.Sort` under a
   * Yaegi build without generic-stdlib support. design-docs/23. */
  const matchesAlternateCanonical = () => {
    if (!props.alternateCanonicals || props.alternateCanonicals.length === 0) return false;
    const target = normaliseSubmission(input());
    if (target === "") return false;
    return props.alternateCanonicals.some((alt) => normaliseSubmission(alt) === target);
  };
  const isCorrect = () => {
    const r = yaegi.runResult();
    if (r === null) return false;
    if (r.error === "" && r.stdout === props.expectStdout) return true;
    return matchesAlternateCanonical();
  };
  /* Inner gate used by the phase handle for grading. A fresh
   * Run result is required to commit a verdict; the OUTER
   * canSubmit (below, on ownPhase) is looser so the user can
   * click Submit without having Run first and trigger auto-Run. */
  const canSubmit = () => yaegi.runResult() !== null && !yaegi.running() && input().trim() !== "";

  /* Targeted wrong-pattern feedback per design-docs/99. When the
   * learner's submission matches an authored distractor's `match`
   * (mod whitespace), surface the author's `explain` instead of
   * the generic "stdout doesn't match" message. Bare-string
   * distractors (current 12 fill-line YAMLs) flow through unchanged
   * — no explain → generic message. */
  const wrongExplain = () => {
    if (props.generator.kind !== "template") return null;
    return matchWrongPattern(input(), props.generator.distractors)?.explain ?? null;
  };

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit,
    onAnother: () => {
      another();
      setInput("");
      yaegi.clear();
      autoSubmittedFor = null;
    },
    onTryAgain: () => {
      yaegi.clear();
      autoSubmittedFor = null;
    },
  });

  /* Auto-Submit on correct Run + auto-Run on Submit-without-Run.
   * design-docs/26-ux-asks. Two reactive behaviours:
   *
   *  1. When a fresh runResult lands AND it's correct AND we're
   *     still in the picking phase → fire phase.submit(). Skips
   *     the manual "Run, see green, click Submit" two-step.
   *  2. When the learner clicks Submit but no runResult exists
   *     yet (or it's stale because they edited) → trigger Run
   *     first; the auto-Submit-on-correct effect picks up from
   *     there if the result is correct.
   *
   * `autoSubmittedFor` guards against re-submitting the same
   * result if the effect re-fires for any reason. */
  let autoSubmittedFor: object | null = null;
  createEffect(() => {
    const r = yaegi.runResult();
    /* Track yaegi.running() too: useYaegiRun sets runResult BEFORE
     * flipping running back to false, so this effect would fire
     * once with running still true and bail on phase.submit's
     * canSubmit gate. Re-tracking running means we re-fire the
     * tick after, when canSubmit returns true. */
    if (yaegi.running()) return;
    if (r === null || r === autoSubmittedFor) return;
    if (phase.current() !== "picking") return;
    if (isCorrect()) {
      autoSubmittedFor = r;
      phase.submit();
    }
  });

  /* The phase exposed to ExerciseShell wraps the inner one so we
   * can:
   *  - widen canSubmit (the input + non-running gate; runResult is
   *    no longer required because Submit auto-Runs if needed),
   *  - intercept submit() to fire Run when there's no result yet,
   *    deferring the actual phase.submit() to the createEffect
   *    above when the Run lands.
   * Other methods pass through unchanged. */
  const ownPhase: ExercisePhaseHandle = {
    submitted: phase.submitted,
    revealed: phase.revealed,
    current: phase.current,
    canSubmit: () =>
      input().trim() !== "" && !yaegi.running() && phase.current() === "picking",
    submit: () => {
      if (yaegi.running()) return;
      if (input().trim() === "") return;
      if (yaegi.runResult() === null) {
        /* No fresh Run — kick one off. The auto-submit effect
         * commits the verdict if the Run is correct; otherwise
         * the learner stays in picking with the result panel
         * visible to inspect and iterate. */
        void yaegi.run();
        return;
      }
      phase.submit();
    },
    tryAgain: phase.tryAgain,
    nextInstance: phase.nextInstance,
    revealCorrect: phase.revealCorrect,
  };

  const runPanelFocus = useRunResultFocus(yaegi.runResult);

  const toolbar = (
    <div class="flex flex-row gap-3 items-center flex-wrap">
      <RunResetToolbar
        running={yaegi.running()}
        canRun={input().trim() !== ""}
        onRun={yaegi.run}
        onReset={yaegi.reset}
        runtimeStatus={yaegi.runtimeStatus()}
        bootError={yaegi.bootError()}
        bootStalled={yaegi.bootStalled()}
      />
      {/* Run nudge surfaced only when the learner has typed but
       * hasn't run yet. Submit auto-Runs (design-docs/26 UX ask),
       * but the explicit Run button is still the right path when
       * they want to inspect output before committing. */}
      <Show when={yaegi.runResult() === null && input().trim() !== "" && !yaegi.running()}>
        <Text tone="muted" size="xs" family="mono">
          ↳ Run to inspect output, or Submit to grade
        </Text>
      </Show>
    </div>
  );

  return (
    <ExerciseShell
      exerciseId={props.exerciseId}
      prompt={props.prompt}
      ts={instance().ts}
      canonical={instance().canonical}
      hints={props.hints}
      hintValues={instance().values}
      phase={ownPhase}
      ownsReveal
      successNote={props.successNote}
      extraPickingActions={toolbar}
      extraWrongActions={toolbar}
      correctMessage={<span>Correct — your line produces the expected output.</span>}
      wrongMessage={
        <Show
          when={wrongExplain()}
          fallback={
            <span>
              Not the expected output yet. Edit, Run again, reshuffle this exercise, or reveal the
              answer.
            </span>
          }
        >
          {(explain) => <span>{explain()}</span>}
        </Show>
      }
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <div class="text-micro uppercase tracking-widest text-fg-muted mb-1.5">
        Type the line →
      </div>
      <CodeMirrorFillBlanks
        segments={instance().blankSegments ?? []}
        ariaLabel="Fill-the-line Go snippet"
        renderBlank={(slotIdx, varName, expected) => (
          <BlankInput
            slotIdx={slotIdx}
            varName={varName}
            expected={expected}
            value={input()}
            submitted={phase.submitted()}
            /* Reveal flow re-uses BlankInput's revealed styling
             * but our oracle is stdout, not string match — so
             * styling-by-match would mislead. Pass false; the
             * Feedback panel carries the correctness signal. */
            revealed={false}
            locked={phase.current() === "right"}
            onInput={(value) => {
              setInput(value);
              /* Editing the input invalidates the last Run's grade
               * — otherwise Submit could grade fresh garbage
               * against the previous Run's stdout (design-docs/19
               * F-3). Clearing runResult also drops canSubmit back
               * to false so the learner has to Run again. */
              yaegi.clear();
            }}
            onEnter={() => {
              if (input().trim() !== "" && !yaegi.running()) void yaegi.run();
            }}
          />
        )}
      />
      {/* Mobile-only Go-symbol bar — same primitive as Freeform.
       * Targets `document.activeElement` (the focused BlankInput)
       * via insertAtFocused; ref forwarding through BlankInput +
       * the segments loop isn't needed because only one input is
       * present per fill-line exercise. */}
      <MobileKeyBar
        onInsert={(text) => {
          if (phase.current() !== "right") insertAtFocused(text);
        }}
        onRun={() => {
          if (input().trim() !== "" && !yaegi.running()) void yaegi.run();
        }}
      />
      <InlineCanonicalReveal
        submission={input}
        /* The canonical for the LINE the learner is typing — not the
         * full scaffolded program. Falls back to "" if no blank
         * segment is present (variant generators, which the schema
         * already rejects for fill-line). */
        canonical={(instance().blankSegments ?? []).find((s) => s.kind === "blank")?.expected ?? ""}
        mode="word"
        forceOpen={() => phase.revealed()}
      />
      <Show when={yaegi.runResult()}>
        {(r) => (
          <RunResultPanel
            result={r()}
            expectStdout={props.expectStdout}
            ref={runPanelFocus.ref}
          />
        )}
      </Show>
    </ExerciseShell>
  );
}
