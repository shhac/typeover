import { createSignal, Show } from "solid-js";
import { MobileKeyBar } from "~/components/ds";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { insertAtFocused } from "~/lib/textarea-insert";
import { useYaegiRun } from "~/lib/use-yaegi-run";
import { ExerciseShell } from "./ExerciseShell";
import { InlineCanonicalReveal } from "./InlineCanonicalReveal";
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

/* Default scaffold the textarea starts with. Per the user's
 * 2026-05-19 ask, freeform must NOT prefill the canonical — the
 * exercise is about the learner producing the code, and a prefilled
 * answer collapses that to a delete-and-Run cycle. The scaffold is
 * deliberately barren: package + import + an empty main with a
 * comment marker. When per-exercise scaffolds become useful (e.g.
 * an exercise that wants the learner to FILL a specific function),
 * add a `scaffold` field to the schema and fall back here when
 * unset. */
const DEFAULT_SCAFFOLD = `package main

import "fmt"

func main() {
\t// implement here
\t_ = fmt.Println
}
`;

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

  const [code, setCode] = createSignal(DEFAULT_SCAFFOLD);

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
      setCode(DEFAULT_SCAFFOLD);
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
      ownsReveal
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
      {/* Mobile-only Go-symbol bar docked above the soft keyboard.
       * Inserts at the textarea caret via insertAtFocused (reads
       * document.activeElement); the embedded Run shortcut fires
       * the same Yaegi run as the toolbar button so a mobile
       * learner doesn't have to dismiss the keyboard to submit. */}
      <MobileKeyBar
        onInsert={(text) => {
          if (phase.current() !== "right") insertAtFocused(text);
        }}
        /* Mirror the toolbar's runtime gate. Today the schema permits
         * `runtime: "yaegi" | "server"` for freeform; only "yaegi"
         * runs in the worker. Without this, a future server-runtime
         * exercise would silently invoke yaegi.run via the mobile
         * bar even though the toolbar Run is disabled. */
        onRun={props.runtime === "yaegi" ? () => void yaegi.run() : undefined}
      />
      <InlineCanonicalReveal
        submission={code}
        canonical={instance().canonical}
        mode="line"
        forceOpen={() => phase.revealed()}
      />
      <Show when={yaegi.runResult()}>
        {(r) => <RunResultPanel result={r()} expectStdout={props.expectStdout} />}
      </Show>
    </ExerciseShell>
  );
}
