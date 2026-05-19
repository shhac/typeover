import { createSignal, Show } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { useYaegiRun } from "~/lib/use-yaegi-run";
import { ExerciseShell } from "./ExerciseShell";
import { RunResetToolbar } from "./RunResetToolbar";
import { RunResultPanel } from "./RunResultPanel";

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

/*
 * v0 freeform exercise — textarea editor, Run button, stdout-match
 * grading. The run lifecycle (running / runResult / run / reset)
 * lives in `useYaegiRun`; the result panel + run toolbar are shared
 * components in this directory. Everything left here is the
 * Freeform-specific shell: the textarea seed and the
 * canSubmit/isCorrect predicates.
 *
 * CodeMirror integration (#23) replaces the textarea later;
 * everything else stays.
 */
export function Freeform(props: FreeformProps) {
  const { instance, another } = useExerciseInstance(props.exerciseId, props.generator);

  const [code, setCode] = createSignal(instance().canonical);

  const yaegi = useYaegiRun({ buildProgram: () => code() });

  const isCorrect = () => {
    const r = yaegi.runResult();
    return r !== null && r.error === "" && r.stdout === props.expectStdout;
  };
  const canSubmit = () => yaegi.runResult() !== null && !yaegi.running();

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit,
    onAnother: () => {
      another();
      setCode(instance().canonical);
      yaegi.clear();
    },
    onTryAgain: () => yaegi.clear(),
  });

  const toolbar = (
    <RunResetToolbar
      running={yaegi.running()}
      canRun={props.runtime === "yaegi"}
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
      extraPickingActions={toolbar}
      extraWrongActions={toolbar}
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
      <Show when={yaegi.runResult()}>
        {(r) => <RunResultPanel result={r()} expectStdout={props.expectStdout} />}
      </Show>
    </ExerciseShell>
  );
}
