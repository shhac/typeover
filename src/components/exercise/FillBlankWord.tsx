import { createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { evaluateBlanks, extractBlankPositions } from "~/lib/fill-blank";
import { ExerciseShell } from "./ExerciseShell";
import { BlankInput } from "./BlankInput";

interface FillBlankWordProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  blanks: string[];
  hints: readonly [string, string, string];
  nextExerciseHref?: string;
  themeHref?: string;
}

export function FillBlankWord(props: FillBlankWordProps) {
  const { instance, another } = useExerciseInstance(props.exerciseId, props.generator, {
    blanks: props.blanks,
  });

  // Keyed by segment index — the same blank var may legitimately appear
  // more than once in the canonical (e.g. `${x} == ${x}`), so each
  // occurrence is an independent input.
  const [inputs, setInputs] = createSignal<Record<number, string>>({});

  const segments = () => instance().blankSegments ?? [];
  const blankPositions = createMemo(() => extractBlankPositions(segments()));
  const valueFor = (idx: number) => inputs()[idx] ?? "";

  const evaluation = createMemo(() => evaluateBlanks(blankPositions(), inputs()));
  const allFilled = () => evaluation().allFilled;
  const allCorrect = () => evaluation().allCorrect;

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect: allCorrect,
    canSubmit: allFilled,
    onAnother: () => {
      another();
      setInputs({});
    },
    // tryAgain deliberately keeps partial inputs — the learner is
    // iterating, not restarting. Clear is its own explicit button.
  });

  /* Per design-docs/12 P1: Clear empties inputs AND resets
   * submitted/revealed (returning the learner to the picking phase).
   * `phase.tryAgain()` does the submitted/revealed reset; we follow
   * up with the input wipe. Compose, don't duplicate the reset
   * logic into the hook. */
  function clearInputs() {
    setInputs({});
    phase.tryAgain();
  }

  const clearButton = (
    <Show when={Object.keys(inputs()).length > 0}>
      <Button variant="ghost" onClick={clearInputs}>
        Clear
      </Button>
    </Show>
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
      extraPickingActions={clearButton}
      extraWrongActions={clearButton}
      correctMessage={<span>Correct — every blank matches.</span>}
      wrongMessage={
        <span>
          One or more blanks are off. Try again, clear and start over, grab a different exercise, or
          reveal the canonical answer.
        </span>
      }
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <CodeBlock lang="go" label="your turn — fill the blanks">
        <For each={segments()}>
          {(seg, idx) => {
            if (seg.kind === "text") return <span>{seg.text}</span>;
            const slotIdx = idx();
            return (
              <BlankInput
                slotIdx={slotIdx}
                varName={seg.varName}
                expected={seg.expected}
                value={valueFor(slotIdx)}
                submitted={phase.submitted()}
                revealed={phase.revealed()}
                locked={phase.current() === "right"}
                onInput={(value) => setInputs((prev) => ({ ...prev, [slotIdx]: value }))}
              />
            );
          }}
        </For>
      </CodeBlock>
    </ExerciseShell>
  );
}
