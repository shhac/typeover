import { createSignal, For, onMount, Show } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { substituteAtBlank } from "~/lib/fill-blank";
import { insertAtFocused } from "~/lib/textarea-insert";
import { useYaegiRun } from "~/lib/use-yaegi-run";
import { matchWrongPattern } from "~/lib/wrong-pattern";
import { CodeBlock } from "../ds/CodeBlock";
import { MobileKeyBar } from "../ds/MobileKeyBar";
import { Text } from "../ds/Text";
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

  /* Preflight WASM on mount — fill-line is always Yaegi-runtime per
   * schema, so there's no `runtime === "yaegi"` gate here. Surfaces
   * the cold-start as a "Booting Go runtime…" badge instead of a
   * frozen Run button. design-docs/16 F-4. */
  onMount(() => yaegi.preflight());

  const isCorrect = () => {
    const r = yaegi.runResult();
    return r !== null && r.error === "" && r.stdout === props.expectStdout;
  };
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
    },
    onTryAgain: () => yaegi.clear(),
  });

  const toolbar = (
    <div class="flex flex-row gap-3 items-center flex-wrap">
      <RunResetToolbar
        running={yaegi.running()}
        canRun={input().trim() !== ""}
        onRun={yaegi.run}
        onReset={yaegi.reset}
        runtimeStatus={yaegi.runtimeStatus()}
        bootError={yaegi.bootError()}
      />
      {/* Disabled-Submit explainer per design-docs/16 F-18. */}
      <Show when={yaegi.runResult() === null && input().trim() !== ""}>
        <Text tone="muted" size="xs" family="mono">
          ↳ Run your line first to enable Submit
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
      extraPickingActions={toolbar}
      extraWrongActions={toolbar}
      correctMessage={<span>Correct — your line produces the expected output.</span>}
      wrongMessage={
        <Show
          when={wrongExplain()}
          fallback={
            <span>
              Not the expected output yet. Edit, Run again, try a different exercise, or reveal the
              canonical answer.
            </span>
          }
        >
          {(explain) => <span>{explain()}</span>}
        </Show>
      }
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <CodeBlock lang="go" label="your turn — type the line">
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
                  onInput={(value) => {
                    setInput(value);
                    /* Editing the input invalidates the last Run's
                     * grade — otherwise Submit could grade fresh
                     * garbage against the previous Run's stdout
                     * (design-docs/19 F-3). Clearing runResult
                     * also drops canSubmit back to false so the
                     * learner has to Run again. */
                    yaegi.clear();
                  }}
                  onEnter={() => {
                    if (input().trim() !== "" && !yaegi.running()) void yaegi.run();
                  }}
                />
              </span>
            );
          }}
        </For>
      </CodeBlock>
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
        {(r) => <RunResultPanel result={r()} expectStdout={props.expectStdout} />}
      </Show>
    </ExerciseShell>
  );
}
