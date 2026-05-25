import { createSignal, onMount, Show } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { substituteAtBlank } from "~/lib/fill-blank";
import { normaliseSubmission } from "~/lib/submission-normalise";
import { useAutoSubmittingPhase } from "~/lib/use-auto-submitting-phase";
import { useRunResultFocus } from "~/lib/use-run-result-focus";
import { insertAtFocused } from "~/lib/textarea-insert";
import { useRuntimeRun, type ClientRuntime } from "~/lib/use-runtime-run";
import { matchWrongPattern } from "~/lib/wrong-pattern";
import { InstructionLine } from "../ds/InstructionLine";
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
  /** Which client-side runtime to grade against. `"yaegi"` for the
   *  Go track, `"zig"` for the Zig track, `"rust"` for Rust (the
   *  worker proxies to /api/compile/rust, SW intercepts for cache
   *  hits). The schema's `validateFillLineMode` admits the wider
   *  `runtime: server` and exercise-dispatch reshapes
   *  (target=rust, runtime=server) → `"rust"` at the page boundary
   *  before it reaches this prop. ClientRuntime is the narrower
   *  hook-facing union (no `"server"`) so a regression that tried
   *  to pass the server placeholder here would fail typecheck. */
  runtime: ClientRuntime;
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
 * The run lifecycle lives in `useRuntimeRun`; the result panel + run
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

  const runner = useRuntimeRun({
    runtime: props.runtime,
    buildProgram: () => substituteAtBlank(instance(), input()),
  });

  /* Preflight WASM on mount — fill-line always uses a client-side
   * runtime per schema, so there's no runtime gate here. Surfaces
   * the cold-start as a "Booting <lang> runtime…" badge instead of
   * a frozen Run button. design-docs/16 F-4. */
  onMount(() => runner.preflight());

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
    const r = runner.runResult();
    if (r === null) return false;
    if (r.error === "" && r.stdout === props.expectStdout) return true;
    return matchesAlternateCanonical();
  };
  /* Inner gate used by the phase handle for grading. A fresh
   * Run result is required to commit a verdict; the OUTER
   * canSubmit (below, on ownPhase) is looser so the user can
   * click Submit without having Run first and trigger auto-Run. */
  const canSubmit = () => runner.runResult() !== null && !runner.running() && input().trim() !== "";

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
      runner.clear();
      ownPhase.reset();
    },
    onTryAgain: () => {
      runner.clear();
      ownPhase.reset();
    },
  });

  /* design-docs/26-ux-asks "smart submit": auto-Run on Submit
   * when no result is buffered, and auto-Submit when a fresh
   * Run grades correct. Both halves bundled in
   * `useAutoSubmittingPhase` so this component reads as
   * "wire input + yaegi into an auto-submitting phase". */
  const ownPhase = useAutoSubmittingPhase({
    phase,
    runResult: runner.runResult,
    running: runner.running,
    isCorrect,
    hasInput: () => input().trim() !== "",
    startRun: () => void runner.run(),
  });

  const runPanelFocus = useRunResultFocus(runner.runResult);

  const toolbar = (
    <div class="flex flex-row gap-3 items-center flex-wrap">
      <RunResetToolbar
        running={runner.running()}
        canRun={input().trim() !== ""}
        onRun={runner.run}
        onReset={runner.reset}
        runtimeStatus={runner.runtimeStatus()}
        runtimeLabel={runner.runtimeLabel}
        bootError={runner.bootError()}
        bootStalled={runner.bootStalled()}
      />
      {/* Run nudge surfaced only when the learner has typed but
       * hasn't run yet. Submit auto-Runs (design-docs/26 UX ask),
       * but the explicit Run button is still the right path when
       * they want to inspect output before committing. */}
      <Show when={runner.runResult() === null && input().trim() !== "" && !runner.running()}>
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
      phase={ownPhase.phase}
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
      <InstructionLine>Type the line →</InstructionLine>
      <CodeMirrorFillBlanks
        segments={instance().blankSegments ?? []}
        language={runner.runtimeTarget}
        ariaLabel={`Fill-the-line ${runner.runtimeLabel} snippet`}
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
            /* fill-line surface — give browsers without
             * `field-sizing: content` support (Firefox <138, older
             * Safari) a wider desktop floor so full-line answers
             * aren't cramped into 14ch. Mobile stays at the
             * default. */
            wide
            language={runner.runtimeTarget}
            canonical={expected}
            onInput={(value) => {
              setInput(value);
              /* Editing the input invalidates the last Run's grade
               * — otherwise Submit could grade fresh garbage
               * against the previous Run's stdout (design-docs/19
               * F-3). Clearing runResult also drops canSubmit back
               * to false so the learner has to Run again. */
              runner.clear();
            }}
            onEnter={() => {
              if (input().trim() !== "" && !runner.running()) void runner.run();
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
          if (input().trim() !== "" && !runner.running()) void runner.run();
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
      <Show when={runner.runResult()}>
        {(r) => (
          <RunResultPanel result={r()} expectStdout={props.expectStdout} ref={runPanelFocus.ref} />
        )}
      </Show>
    </ExerciseShell>
  );
}
