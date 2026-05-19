import { createSignal, For, Show } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { substituteAtBlank } from "~/lib/fill-blank";
import { useYaegiRun } from "~/lib/use-yaegi-run";
import { CodeBlock } from "../ds/CodeBlock";
import { ExerciseShell } from "./ExerciseShell";
import { BlankInput } from "./BlankInput";
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

  const isCorrect = () => {
    const r = yaegi.runResult();
    return r !== null && r.error === "" && r.stdout === props.expectStdout;
  };
  const canSubmit = () => yaegi.runResult() !== null && !yaegi.running() && input().trim() !== "";

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit,
    onAnother: () => {
      another();
      setInput("");
      yaegi.clear();
    },
    onTryAgain: () => yaegi.clear(),
  });

  const toolbar = (
    <RunResetToolbar
      running={yaegi.running()}
      canRun={input().trim() !== ""}
      onRun={yaegi.run}
      onReset={yaegi.reset}
    />
  );

  return (
    <ExerciseShell
      exerciseId={props.exerciseId}
      prompt={props.prompt}
      ts={instance().ts}
      canonical={instance().canonical}
      hints={props.hints}
      hintValues={instance().values}
      phase={phase}
      ownsReveal
      extraPickingActions={toolbar}
      extraWrongActions={toolbar}
      correctMessage={<span>Correct — your line produces the expected output.</span>}
      wrongMessage={
        <span>
          Not the expected output yet. Edit, Run again, try a different exercise, or reveal the
          canonical answer.
        </span>
      }
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <CodeBlock lang="go" filename="your turn — type the line">
        <For each={instance().blankSegments ?? []}>
          {(seg) => {
            if (seg.kind === "text") return <span>{seg.text}</span>;
            return (
              <span class="inline-block align-baseline">
                <BlankInput
                  slotIdx={0}
                  varName={seg.varName}
                  expected={seg.expected}
                  value={input()}
                  submitted={phase.submitted()}
                  /* Reveal flow re-uses BlankInput's revealed styling
                   * but our oracle is stdout, not string match — so
                   * styling-by-match would mislead. Pass false; the
                   * Feedback panel carries the correctness signal. */
                  revealed={false}
                  locked={phase.current() === "right"}
                  onInput={(value) => setInput(value)}
                  onEnter={() => {
                    if (input().trim() !== "" && !yaegi.running()) void yaegi.run();
                  }}
                />
              </span>
            );
          }}
        </For>
      </CodeBlock>
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
        {(r) => <RunResultPanel result={r()} expectStdout={props.expectStdout} />}
      </Show>
    </ExerciseShell>
  );
}
