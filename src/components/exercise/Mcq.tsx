import { createSignal, For } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { ExerciseShell } from "./ExerciseShell";
import { McqOption } from "./McqOption";

interface McqProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  hints: readonly [string, string, string];
}

export function Mcq(props: McqProps) {
  const { instance, another } = useExerciseInstance(
    props.exerciseId,
    props.generator,
  );

  const [selected, setSelected] = createSignal<number | null>(null);

  const options = () => instance().options ?? [];
  const correctIndex = () => instance().correctIndex ?? -1;
  const isCorrect = () => selected() === correctIndex();

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit: () => selected() !== null,
    onAnother: () => {
      another();
      setSelected(null);
    },
    onTryAgain: () => setSelected(null),
  });

  return (
    <ExerciseShell
      exerciseId={props.exerciseId}
      prompt={props.prompt}
      ts={instance().ts}
      canonical={instance().canonical}
      hints={props.hints}
      phase={phase.phase}
      revealed={phase.revealed}
      canSubmit={() => selected() !== null}
      submit={phase.submit}
      tryAgain={phase.tryAgain}
      nextInstance={phase.nextInstance}
      revealCorrect={phase.revealCorrect}
    >
      <fieldset class="flex flex-col gap-2 m-0 p-0 border-0">
        <legend class="sr-only">Pick the idiomatic Go translation</legend>
        <For each={options()}>
          {(opt, idx) => (
            <McqOption
              groupName={`mcq-${props.exerciseId}`}
              index={idx()}
              text={opt}
              selected={selected() === idx()}
              submitted={phase.submitted()}
              revealed={phase.revealed()}
              isCorrect={correctIndex() === idx()}
              onSelect={() => setSelected(idx())}
            />
          )}
        </For>
      </fieldset>
    </ExerciseShell>
  );
}
