import { createSignal, onMount, Show } from "solid-js";
import { MobileKeyBar, Text } from "~/components/ds";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { useRunResultFocus } from "~/lib/use-run-result-focus";
import { useRuntimeRun, runtimeToTarget, type AcceptedRuntime } from "~/lib/use-runtime-run";
import {
  LANGUAGE_FREEFORM_SCAFFOLD,
  resolveSubmissionShape,
  validateSubmissionShape,
  type SubmissionShape,
} from "~/lib/freeform-shape";
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from "../ds/CodeMirrorEditor";
import { ExerciseShell } from "./ExerciseShell";
import { InlineCanonicalReveal } from "./InlineCanonicalReveal";
import { RunToolbar } from "./RunToolbar";
import { RunResultPanel } from "./RunResultPanel";

interface FreeformProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  hints: readonly [string, string, string];
  expectStdout: string;
  /** Which runtime to grade against. `"yaegi"`, `"zig"`, and
   *  `"rust"` route to their respective in-browser workers (the
   *  rust worker proxies to /api/compile/rust + SW L1 cache).
   *  `"server"` remains a schema-level placeholder for compile
   *  routes that don't yet have a client-side driver — the page
   *  reshapes (target=rust, runtime=server) → runtime=rust before
   *  reaching this component. The canonical union lives in
   *  `runtime/client-descriptors.ts`; re-exporting through
   *  `use-runtime-run` so we type-check in lock-step with the
   *  hook that consumes us. design-docs/32. */
  runtime: AcceptedRuntime;
  /** Optional per-exercise override on the submission's required
   *  bookends. Layered onto the per-language default in
   *  `freeform-shape.ts` — exercises that don't set this get the
   *  language default (e.g. Rust requires `fn main` ... `}`). */
  submissionShape?: SubmissionShape;
  successNote?: string;
  nextExerciseHref?: string;
  themeHref?: string;
}

/*
 * v0 freeform exercise — CodeMirror editor, Run button, stdout-match
 * grading. The run lifecycle (running / runResult / run / reset)
 * lives in `useRuntimeRun`; the result panel + run toolbar are shared
 * components in this directory. Everything left here is the
 * Freeform-specific shell: the editor seed and the
 * canSubmit/isCorrect predicates.
 *
 * The editor surface is a CodeMirror 6 wrapper (`CodeMirrorEditor`)
 * that ships Go syntax highlighting + bracket-pair + matching +
 * tab-indent + history + Cmd/Ctrl-Enter Run binding. Replaced the
 * plain textarea per design-docs/16 F-19. The wrapper falls back
 * to a plain textarea inside vitest because CodeMirror's
 * contentEditable is brittle under jsdom and the gestures the
 * suite asserts on (Cmd+Enter Run, edit invalidates Run result,
 * value mutation) survive the fallback unchanged.
 */
export function Freeform(props: FreeformProps) {
  const { instance, another } = useExerciseInstance(props.exerciseId, props.generator);

  /* Per-target scaffold lookup. `runtimeToTarget` is the single
   * source of truth (also used inside the hook); reading it here
   * removes the second copy of the runtime→target mapping. The
   * "server" runtime resolves to Go as a placeholder — the editor
   * never actually runs in that branch (canRun is false), but the
   * scaffold needs something non-empty. */
  const initialScaffold = LANGUAGE_FREEFORM_SCAFFOLD[runtimeToTarget(props.runtime)];
  const [code, setCode] = createSignal(initialScaffold);
  let editorHandle: CodeMirrorEditorHandle | undefined;

  /* The hook accepts `props.runtime` verbatim. When it's `"server"`
   * the hook returns `canRun: false` and every side-effect method
   * is a no-op; we gate Run + Cmd-Enter + the mobile-bar handler on
   * `runner.canRun` rather than re-deriving the rule. When the SSR
   * fallback path lands, the hook learns how to drive it and
   * `canRun` flips true without any component-side change.
   *
   * `precheck` runs the submission-shape bookend check before any
   * compile round-trip. The shape resolves from the language
   * default + this exercise's optional override. Fast-fail saves
   * the learner a wait and us a Sandbox compile. */
  const runner = useRuntimeRun({
    runtime: props.runtime,
    buildProgram: () => code(),
    precheck: () => {
      const shape = resolveSubmissionShape(
        runner.runtimeTarget,
        props.submissionShape,
      );
      return validateSubmissionShape(code(), shape);
    },
  });

  /* Preflight the worker on mount. `preflight()` is a no-op when
   * canRun is false, so no per-runtime gate needed at the call
   * site. Hides the brotli'd WASM cold-start behind a visible
   * "Booting <lang> runtime…" badge. design-docs/16 F-4. */
  onMount(() => runner.preflight());

  const isCorrect = () => {
    const r = runner.runResult();
    return r !== null && r.error === "" && r.stdout === props.expectStdout;
  };
  const canSubmit = () => runner.runResult() !== null && !runner.running();

  const runPanelFocus = useRunResultFocus(runner.runResult);

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit,
    onAnother: () => {
      another();
      setCode(initialScaffold);
      runner.clear();
    },
    onTryAgain: () => runner.clear(),
  });

  const toolbar = (
    <RunToolbar
      runner={runner}
      nudge={
        /* Disabled-Submit explainer per design-docs/16 F-18.
         * Submit is gated on a prior Run; without this hint a
         * learner who types a correct answer and clicks Submit
         * sees nothing and assumes the button is broken. */
        <Show when={runner.runResult() === null && code().trim() !== ""}>
          <Text tone="muted" size="xs" family="mono">
            ↳ Run your code first to enable Submit
          </Text>
        </Show>
      }
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
      successNote={props.successNote}
      extraActions={toolbar}
      correctMessage={<span>Correct — your program prints the expected output.</span>}
      wrongMessage={
        <span>
          Stdout doesn't match yet. Inspect the result below, edit, Run again, or reveal the answer.
        </span>
      }
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <CodeMirrorEditor
        ariaLabel={`${runner.runtimeLabel} program for freeform exercise`}
        language={runner.runtimeTarget}
        canonical={instance().canonical}
        value={code()}
        onValueChange={(next) => {
          setCode(next);
          /* Editing invalidates the last Run's grade. Without
           * clearing, Submit could grade fresh garbage against
           * the previous Run's stdout (design-docs/19 F-3). */
          runner.clear();
        }}
        onCmdEnter={() => {
          if (runner.canRun && !runner.running() && code().trim() !== "") {
            void runner.run();
          }
        }}
        disabled={phase.current() === "right"}
        ref={(h) => {
          editorHandle = h;
        }}
      />
      {/* Mobile-only Go-symbol bar docked above the soft keyboard.
       * Routed through the editor handle so the bar's `{` / `:=`
       * chips insert at the CodeMirror caret (the legacy
       * insertAtFocused read document.activeElement which doesn't
       * resolve to the CM contentDOM cleanly). The Run shortcut
       * still fires the same Yaegi run as the toolbar button. */}
      <MobileKeyBar
        onInsert={(text) => {
          if (phase.current() === "right") return;
          editorHandle?.insertAtCursor(text);
        }}
        /* Mirror the toolbar's runtime gate. The schema permits
         * `runtime: "yaegi" | "zig" | "server"` for freeform; only
         * the client-side runtimes run in a worker. Without this, a
         * future server-runtime exercise would silently invoke
         * runner.run via the mobile bar even though the toolbar Run
         * is disabled. */
        onRun={runner.canRun ? () => void runner.run() : undefined}
      />
      <InlineCanonicalReveal
        submission={code}
        canonical={instance().canonical}
        mode="line"
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
