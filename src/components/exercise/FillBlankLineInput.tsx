import { createSignal, For, Show } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { Text } from "../ds/Text";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { getRunner, terminateRunner } from "~/runtime";
import { ExerciseShell } from "./ExerciseShell";
import { BlankInput } from "./BlankInput";

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

interface RunResult {
  stdout: string;
  stderr: string;
  error: string;
  durationMs: number;
}

/*
 * fill-line UX redesign — "type the code for this one line."
 *
 * Replaces the legacy MCQ-as-tiles picker with a single text input
 * sized for one line of code. On Run we substitute the user's input
 * into the canonical at the blank position, send the resulting
 * program to Yaegi, capture stdout, and grade by comparing against
 * `expectStdout` (same shape Freeform uses).
 *
 * Why this is *better* than the tile picker per user feedback
 * 2026-05-19: the learner produces the line rather than recognising
 * it from a list. Recognition is the MCQ slot; production is the
 * point of fill-* / freeform. The legacy MCQ-as-tiles surface
 * blurred that distinction.
 *
 * Why a separate component rather than branching FillBlankLine:
 * the two surfaces share almost no state — tile picker has
 * `selected: string | null`, this has `code: string` + `runResult`
 * + `running`. Forking keeps each focused while the migration is
 * incremental; we delete the legacy when all 12 fill-line YAMLs
 * have `expectStdout` set.
 */
export function FillBlankLineInput(props: FillBlankLineInputProps) {
  const { instance, another } = useExerciseInstance(props.exerciseId, props.generator, {
    blanks: props.blanks,
  });

  const [input, setInput] = createSignal("");
  const [runResult, setRunResult] = createSignal<RunResult | null>(null);
  const [running, setRunning] = createSignal(false);

  const isCorrect = () => {
    const r = runResult();
    return r !== null && r.error === "" && r.stdout === props.expectStdout;
  };
  const canSubmit = () => runResult() !== null && !running() && input().trim() !== "";

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit,
    onAnother: () => {
      another();
      setInput("");
      setRunResult(null);
    },
    onTryAgain: () => setRunResult(null),
  });

  /* Substitute the user's input into the canonical at the blank
   * position. We rebuild from the blankSegments rather than from
   * the raw canonical template so the rest of the program (scaffold
   * text + already-substituted vars) is preserved exactly. */
  function substituteAtBlank(userLine: string): string {
    const segments = instance().blankSegments ?? [];
    return segments.map((seg) => (seg.kind === "blank" ? userLine : seg.text)).join("");
  }

  async function run() {
    if (running()) return;
    setRunning(true);
    const t0 = performance.now();
    try {
      const program = substituteAtBlank(input());
      const runner = getRunner();
      const r = await runner.eval(program);
      setRunResult({
        stdout: r.stdout,
        stderr: r.stderr,
        error: r.error,
        durationMs: performance.now() - t0,
      });
    } catch (e) {
      setRunResult({
        stdout: "",
        stderr: "",
        error: e instanceof Error ? e.message : String(e),
        durationMs: performance.now() - t0,
      });
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    terminateRunner();
    setRunning(false);
    setRunResult({
      stdout: "",
      stderr: "",
      error: "Runtime was reset. Click Run again to try.",
      durationMs: 0,
    });
  }

  const runAndReset = (
    <div class="flex flex-row gap-2">
      <Button variant="secondary" onClick={run} disabled={running() || input().trim() === ""}>
        {running() ? "Running…" : "Run"}
      </Button>
      <Show when={running()}>
        <Button variant="ghost" onClick={reset}>
          Stop / reset runtime
        </Button>
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
      phase={phase}
      extraPickingActions={runAndReset}
      extraWrongActions={runAndReset}
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
                />
              </span>
            );
          }}
        </For>
      </CodeBlock>

      <Show when={runResult()}>
        {(r) => (
          <div class="flex flex-col gap-2 font-mono text-sm">
            <Text tone="faint" size="xs" family="mono">
              {r().durationMs.toFixed(1)} ms · expected{" "}
              <code class="text-fg-primary">{JSON.stringify(props.expectStdout)}</code>
            </Text>
            <Show when={r().stdout !== ""}>
              <pre
                class={
                  "bg-bg-inset p-3 rounded-sm border whitespace-pre-wrap " +
                  (r().stdout === props.expectStdout ? "border-success/40" : "border-error/40")
                }
              >
                <span class="text-fg-faint text-xs mr-2">stdout</span>
                {r().stdout}
              </pre>
            </Show>
            <Show when={r().stderr !== ""}>
              <pre class="bg-bg-inset p-3 rounded-sm border border-error/40 whitespace-pre-wrap">
                <span class="text-fg-faint text-xs mr-2">stderr</span>
                {r().stderr}
              </pre>
            </Show>
            <Show when={r().error !== ""}>
              <pre class="bg-error/5 p-3 rounded-sm border border-error/40 text-error whitespace-pre-wrap">
                <span class="text-fg-faint text-xs mr-2">error</span>
                {r().error}
              </pre>
            </Show>
          </div>
        )}
      </Show>
    </ExerciseShell>
  );
}
