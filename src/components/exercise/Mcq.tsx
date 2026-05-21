import { createSignal, For } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { ExerciseShell } from "./ExerciseShell";
import { McqOption } from "./McqOption";

interface McqProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  hints: readonly [string, string, string];
  successNote?: string;
  nextExerciseHref?: string;
  themeHref?: string;
}

export function Mcq(props: McqProps) {
  const { instance, another } = useExerciseInstance(props.exerciseId, props.generator);

  const [selected, setSelected] = createSignal<number | null>(null);

  const options = () => instance().options ?? [];
  const correctIndex = () => instance().correctIndex ?? -1;
  const isCorrect = () => selected() === correctIndex();
  const canSubmit = () => selected() !== null;

  const phase = useExercisePhase({
    exerciseId: props.exerciseId,
    isCorrect,
    canSubmit,
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
      hintValues={instance().values}
      phase={phase}
      successNote={props.successNote}
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <fieldset
        class="flex flex-col gap-2 m-0 p-0 border-0"
        onKeyDown={(e) => {
          /* Enter on a selected option submits — without this, a
           * keyboard-only learner has to Tab past every option to
           * reach Submit. design-docs/19 F-11. */
          if (e.key === "Enter" && phase.canSubmit() && !phase.submitted()) {
            e.preventDefault();
            phase.submit();
          }
        }}
      >
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
