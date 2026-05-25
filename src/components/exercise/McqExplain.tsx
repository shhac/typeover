import { createSignal, For } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator-schema";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { ExerciseShell } from "./ExerciseShell";
import { McqOption } from "./McqOption";

/**
 * MCQ variant whose options are PROSE explanations of a piece of
 * source, not language translations. The source pane on the shell
 * gains a tab strip so the learner can flip between the TS reference
 * and the target-language source the question asks about; the
 * options on the right render as prose (no monospace shell) with
 * inline backticks highlighted via formatInline.
 *
 * Sibling of `Mcq` — identical lifecycle and submission shape; only
 * the surface rendering differs.
 */
interface McqExplainProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  hints: readonly [string, string, string];
  successNote?: string;
  nextExerciseHref?: string;
  themeHref?: string;
  /** Language the `generator.source` pane displays. Driven by the
   *  exercise's `target:` field at the page boundary. */
  sourceLang: "go" | "zig" | "rust";
}

export function McqExplain(props: McqExplainProps) {
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
      source={instance().source}
      sourceLang={props.sourceLang}
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
        <legend class="sr-only">Pick the correct explanation</legend>
        <For each={options()}>
          {(opt, idx) => (
            <McqOption
              groupName={`mcq-${props.exerciseId}`}
              index={idx()}
              text={opt}
              kind="prose"
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
