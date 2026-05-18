import { createMemo, createSignal, For, Show } from "solid-js";
import { cn } from "../ds/_internal";
import { CodeBlock } from "../ds/CodeBlock";
import { Text } from "../ds/Text";
import { type GeneratorSpec, type FillSegment } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { rngFromSeed, shuffle } from "~/lib/seed";
import { ExerciseShell } from "./ExerciseShell";
import { CandidateTile } from "./CandidateTile";

interface FillBlankLineProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  /** For fill-line we expect exactly one entry — the var representing
   *  the missing line. The var's pool *is* the candidate set. */
  blanks: string[];
  hints: readonly [string, string, string];
}

type BlankSlot = FillSegment & { kind: "blank" };

export function FillBlankLine(props: FillBlankLineProps) {
  const { instance, another, seed } = useExerciseInstance(
    props.exerciseId,
    props.generator,
    { blanks: props.blanks },
  );

  const [selected, setSelected] = createSignal<string | null>(null);

  // For fill-line we expect exactly one blank slot. `undefined` means
  // the exercise was authored without a blank — guarded explicitly so
  // a vacuous-truth submit doesn't auto-pass (parallel to FillBlankWord
  // fix in commit 7fc01bc).
  const blankSlot = createMemo<BlankSlot | undefined>(() =>
    (instance().blankSegments ?? []).find(
      (s): s is BlankSlot => s.kind === "blank",
    ),
  );

  const expected = () => blankSlot()?.expected ?? "";

  // Candidate pool: the var's pool from the template generator,
  // shuffled deterministically per seed. The "::tiles" namespace keeps
  // the tile-shuffle RNG independent of any future variant-pick RNG.
  const candidates = createMemo(() => {
    if (props.generator.kind !== "template") return [];
    if (props.blanks.length === 0) return [];
    const pool = props.generator.vars[props.blanks[0]!] ?? [];
    return shuffle(rngFromSeed(`${seed()}::tiles`), [...pool]);
  });

  // canSubmit requires both: (a) a tile has been picked, (b) the
  // exercise actually has a blank to fill (vacuous-truth guard).
  const canSubmit = () => selected() !== null && blankSlot() !== undefined;
  const isCorrect = () => blankSlot() !== undefined && selected() === expected();

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
      phase={phase}
      correctMessage={<span>Correct — that's the line.</span>}
      wrongMessage={
        <span>
          Not quite. Pick a different tile, try a different exercise, or reveal
          the answer.
        </span>
      }
    >
      <CodeBlock lang="go" filename="your turn — pick the line">
        <For each={instance().blankSegments ?? []}>
          {(seg) => {
            if (seg.kind === "text") return <span>{seg.text}</span>;
            return (
              <span
                class={cn(
                  "inline-block px-2 py-0.5 border rounded-sm align-baseline",
                  selected()
                    ? "border-accent-amber bg-accent-amber/10 text-fg-primary"
                    : "border-dashed border-fg-muted text-fg-muted",
                )}
                aria-label={`blank: ${seg.varName}`}
              >
                {selected() ?? "·  pick a line  ·"}
              </span>
            );
          }}
        </For>
      </CodeBlock>

      <div
        role="radiogroup"
        aria-label="candidate lines"
        class="flex flex-col gap-2"
      >
        <Text tone="muted" size="xs" family="mono">
          Candidates — click one to fill the blank.
        </Text>
        <Show
          when={candidates().length > 0}
          fallback={
            <Text tone="muted" size="sm" family="mono">
              (no candidates — authoring issue)
            </Text>
          }
        >
          <For each={candidates()}>
            {(candidate) => (
              <CandidateTile
                text={candidate}
                selected={selected() === candidate}
                submitted={phase.submitted()}
                revealed={phase.revealed()}
                isCorrect={candidate === expected()}
                locked={phase.current() === "right"}
                onSelect={() => setSelected(candidate)}
              />
            )}
          </For>
        </Show>
      </div>
    </ExerciseShell>
  );
}
