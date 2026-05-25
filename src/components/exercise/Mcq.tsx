import { For } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { ExerciseShell } from "./ExerciseShell";
import { McqOption } from "./McqOption";
import { useMcqState } from "./useMcqState";

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
  const { instance, selected, setSelected, options, correctIndex, phase } = useMcqState(
    props.exerciseId,
    props.generator,
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
      successNote={props.successNote}
      nextExerciseHref={props.nextExerciseHref}
      themeHref={props.themeHref}
    >
      <fieldset
        class="flex flex-col gap-2 m-0 p-0 border-0"
        onKeyDown={(e) => {
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
