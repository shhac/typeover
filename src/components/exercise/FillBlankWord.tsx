import { createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { type GeneratorSpec, type FillSegment } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { ExerciseShell } from "./ExerciseShell";
import { BlankInput } from "./BlankInput";

interface FillBlankWordProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  blanks: string[];
  hints: readonly [string, string, string];
}

type BlankSlot = { idx: number; seg: FillSegment & { kind: "blank" } };

export function FillBlankWord(props: FillBlankWordProps) {
  const { instance, another } = useExerciseInstance(
    props.exerciseId,
    props.generator,
    { blanks: props.blanks },
  );

  // Keyed by segment index — the same blank var may legitimately appear
  // more than once in the canonical (e.g. `${x} == ${x}`), so each
  // occurrence is an independent input.
  const [inputs, setInputs] = createSignal<Record<number, string>>({});

  const segments = () => instance().blankSegments ?? [];
  const blankPositions = createMemo<BlankSlot[]>(() =>
    segments()
      .map((seg, idx) => ({ seg, idx }))
      .filter((b): b is BlankSlot => b.seg.kind === "blank"),
  );

  const valueFor = (idx: number) => inputs()[idx] ?? "";

  // `every` on an empty array returns true vacuously — would auto-pass
  // any fill-word exercise authored with `blanks: []`. Guard explicitly.
  const allFilled = () => {
    const positions = blankPositions();
    if (positions.length === 0) return false;
    return positions.every((b) => valueFor(b.idx) !== "");
  };
  const allCorrect = () => {
    const positions = blankPositions();
    if (positions.length === 0) return false;
    return positions.every((b) => valueFor(b.idx) === b.seg.expected);
  };

  function clearInputs() {
    setInputs({});
  }

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect: allCorrect,
    canSubmit: allFilled,
    onAnother: () => {
      another();
      clearInputs();
    },
    // tryAgain deliberately keeps partial inputs — the learner is
    // iterating, not restarting. Clear is its own explicit button.
  });

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
      phase={phase.phase}
      revealed={phase.revealed}
      canSubmit={allFilled}
      submit={phase.submit}
      tryAgain={phase.tryAgain}
      nextInstance={phase.nextInstance}
      revealCorrect={phase.revealCorrect}
      extraPickingActions={clearButton}
      extraWrongActions={clearButton}
      correctMessage={<span>Correct — every blank matches.</span>}
      wrongMessage={
        <span>
          One or more blanks are off. Try again, clear and start over, grab a
          different exercise, or reveal the canonical answer.
        </span>
      }
    >
      <CodeBlock lang="go" filename="your turn — fill the blanks">
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
                locked={phase.phase() === "right"}
                onInput={(value) =>
                  setInputs((prev) => ({ ...prev, [slotIdx]: value }))
                }
              />
            );
          }}
        </For>
      </CodeBlock>
    </ExerciseShell>
  );
}
