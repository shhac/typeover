import { createSignal, Show } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { getRunner, terminateRunner } from "~/runtime";
import { Button } from "../ds/Button";
import { Text } from "../ds/Text";
import { ExerciseShell } from "./ExerciseShell";

interface FreeformProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  hints: readonly [string, string, string];
  expectStdout: string;
  /** "yaegi" routes to the in-browser worker. "server" is reserved
   *  for the fallback path (Vercel function) — not implemented in
   *  v0; treated as an authoring error here until it lands. */
  runtime: "yaegi" | "server";
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
 * v0 freeform exercise — textarea editor, Run button, stdout-match
 * grading.
 *
 * The exercise component owns three signals beyond the standard
 * lifecycle:
 *   - `code()`: the learner's source. Seeded from the canonical so
 *     they have a starting skeleton; reset on Another.
 *   - `runResult()`: { stdout, stderr, error, durationMs } from the
 *     most recent eval. null means no run yet.
 *   - `running()`: prevents double-Run while Yaegi is busy.
 *
 * The exercise-phase contract maps as follows:
 *   - `canSubmit()` is `runResult() !== null` — must have run at
 *     least once before Submit becomes available.
 *   - `isCorrect()` compares the last run's stdout to `expectStdout`.
 *     v0 uses exact match; the trailing-newline / whitespace
 *     normalisation question is documented in 04a-runtime-matrix as
 *     a follow-up.
 *
 * CodeMirror integration (#23) replaces the textarea later;
 * everything else stays.
 */
export function Freeform(props: FreeformProps) {
  const { instance, another } = useExerciseInstance(props.exerciseId, props.generator);

  const [code, setCode] = createSignal(instance().canonical);
  const [runResult, setRunResult] = createSignal<RunResult | null>(null);
  const [running, setRunning] = createSignal(false);

  const isCorrect = () => {
    const r = runResult();
    return r !== null && r.error === "" && r.stdout === props.expectStdout;
  };
  const canSubmit = () => runResult() !== null && !running();

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit,
    onAnother: () => {
      another();
      setCode(instance().canonical);
      setRunResult(null);
    },
    onTryAgain: () => setRunResult(null),
  });

  async function run() {
    if (running() || props.runtime !== "yaegi") return;
    setRunning(true);
    const t0 = performance.now();
    try {
      const runner = getRunner();
      const r = await runner.eval(code());
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
    /* Hard-reset the runtime when the learner's code looks like it's
     * stuck (Yaegi is single-threaded inside the worker; an infinite
     * loop in user code will block subsequent calls). Pairs with the
     * `terminateRunner` hook in src/runtime/index.ts. */
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
      <Button variant="secondary" onClick={run} disabled={running()}>
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
      correctMessage={<span>Correct — your program prints the expected output.</span>}
      wrongMessage={
        <span>
          Stdout doesn't match yet. Inspect the result below, edit, Run again, or reveal the
          canonical answer.
        </span>
      }
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <textarea
        class="font-mono text-sm bg-bg-inset text-fg-primary p-3 rounded-sm border border-border-default min-h-[200px] outline-none focus:border-accent-amber"
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        value={code()}
        onInput={(e) => setCode(e.currentTarget.value)}
        disabled={phase.current() === "right"}
      />
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
