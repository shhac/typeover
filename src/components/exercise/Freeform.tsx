import { createSignal, onMount, Show } from "solid-js";
import { MobileKeyBar, Text } from "~/components/ds";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { useRunResultFocus } from "~/lib/use-run-result-focus";
import { handleAutoIndentEnter, insertAtFocused } from "~/lib/textarea-insert";
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
  successNote?: string;
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

  /* Preflight the Yaegi worker on mount when this exercise uses it.
   * Hides the ~1.9 MB WASM cold-start behind a visible "Booting Go
   * runtime…" badge instead of a frozen-looking Run button on first
   * click. MCQ / fill-word pages skip this hook entirely so they
   * never pay the WASM cost. design-docs/16 F-4. */
  onMount(() => {
    if (props.runtime === "yaegi") yaegi.preflight();
  });

  const isCorrect = () => {
    const r = yaegi.runResult();
    return r !== null && r.error === "" && r.stdout === props.expectStdout;
  };
  const canSubmit = () => yaegi.runResult() !== null && !yaegi.running();

  const runPanelFocus = useRunResultFocus(yaegi.runResult);

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
    <div class="flex flex-row gap-3 items-center flex-wrap">
      <RunResetToolbar
        running={yaegi.running()}
        canRun={props.runtime === "yaegi"}
        onRun={yaegi.run}
        onReset={yaegi.reset}
        runtimeStatus={yaegi.runtimeStatus()}
        bootError={yaegi.bootError()}
        bootStalled={yaegi.bootStalled()}
      />
      {/* Disabled-Submit explainer per design-docs/16 F-18.
       * Submit is gated on a prior Run; without this hint a
       * learner who types a correct answer and clicks Submit
       * sees nothing and assumes the button is broken. */}
      <Show when={yaegi.runResult() === null && code().trim() !== ""}>
        <Text tone="muted" size="xs" family="mono">
          ↳ Run your code first to enable Submit
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
      phase={phase}
      ownsReveal
      successNote={props.successNote}
      extraPickingActions={toolbar}
      extraWrongActions={toolbar}
      correctMessage={<span>Correct — your program prints the expected output.</span>}
      wrongMessage={
        <span>
          Stdout doesn't match yet. Inspect the result below, edit, Run again, or reveal the
          answer.
        </span>
      }
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <textarea
        class="font-mono text-sm bg-bg-inset text-fg-primary p-3 rounded-sm border border-border-default min-h-[200px] outline-none focus:border-accent-primary"
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        value={code()}
        onInput={(e) => {
          setCode(e.currentTarget.value);
          /* Editing invalidates the last Run's grade. Without
           * clearing, Submit could grade fresh garbage against
           * the previous Run's stdout (design-docs/19 F-3). */
          yaegi.clear();
        }}
        onKeyDown={(e) => {
          /* Cmd+Enter (Mac) / Ctrl+Enter (Win/Linux) triggers Run
           * directly from inside the textarea. Mirrors the
           * modifier-Enter idiom in most code editors (VS Code,
           * Jupyter, etc.). Checked BEFORE the auto-indent handler
           * because the auto-indent only fires on bare Enter and
           * would short-circuit if we let it run first. design-
           * docs/30 — freeform-UX user ask. */
          if (
            (e.key === "Enter" || e.key === "NumpadEnter") &&
            (e.metaKey || e.ctrlKey) &&
            !e.shiftKey &&
            !e.altKey
          ) {
            e.preventDefault();
            if (props.runtime === "yaegi" && !yaegi.running() && code().trim() !== "") {
              void yaegi.run();
            }
            return;
          }
          /* Auto-indent: Enter on an indented line opens the next
           * line at the same indent. Shift+Enter (and other modified
           * Enters) fall through to a bare newline. */
          if (handleAutoIndentEnter(e.currentTarget, e)) {
            /* insertAtSelection has already fired an `input` event,
             * but Solid's onInput won't run from a synthetic dispatch
             * here — sync the signal directly. */
            setCode(e.currentTarget.value);
          }
        }}
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
