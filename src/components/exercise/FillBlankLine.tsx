import { createMemo, createSignal, For, Show } from "solid-js";
import { cn } from "../ds/_internal";
import { CodeBlock } from "../ds/CodeBlock";
import { Text } from "../ds/Text";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { rngFromSeed, shuffle } from "~/lib/seed";
import { ExerciseShell } from "./ExerciseShell";

interface FillBlankLineProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  /** For fill-line we expect exactly one entry — the var representing
   *  the missing line. The var's pool *is* the candidate set. */
  blanks: string[];
  hints: readonly [string, string, string];
}

type TileState = "neutral" | "selected" | "correctSubmitted" | "incorrectSubmitted" | "correctRevealed";

const tileClass: Record<TileState, string> = {
  neutral: "border-border-default hover:border-border-strong",
  selected: "border-accent-amber bg-accent-amber/5",
  correctSubmitted: "border-success/60 bg-success/5",
  incorrectSubmitted: "border-error/60 bg-error/5",
  correctRevealed: "border-success/60 bg-success/5",
};

function tileState(args: {
  selected: boolean;
  submitted: boolean;
  revealed: boolean;
  isCorrect: boolean;
}): TileState {
  if (args.submitted && args.selected && args.isCorrect) return "correctSubmitted";
  if (args.submitted && args.selected && !args.isCorrect) return "incorrectSubmitted";
  if (args.revealed && args.isCorrect) return "correctRevealed";
  if (args.selected) return "selected";
  return "neutral";
}

export function FillBlankLine(props: FillBlankLineProps) {
  const { instance, another, seed } = useExerciseInstance(
    props.exerciseId,
    props.generator,
    { blanks: props.blanks },
  );

  const [selected, setSelected] = createSignal<string | null>(null);

  // The expected value for the blank slot — pulled from blankSegments.
  // For fill-line we expect exactly one blank.
  const expected = createMemo(() => {
    const blanks = (instance().blankSegments ?? []).filter(
      (s): s is { kind: "blank"; varName: string; expected: string } =>
        s.kind === "blank",
    );
    return blanks[0]?.expected ?? "";
  });

  // Candidate pool: the var's pool from the template generator,
  // shuffled deterministically per seed so each "Another" reorders.
  const candidates = createMemo(() => {
    if (props.generator.kind !== "template") return [];
    if (props.blanks.length === 0) return [];
    const pool = props.generator.vars[props.blanks[0]!] ?? [];
    return shuffle(rngFromSeed(`${seed()}::tiles`), [...pool]);
  });

  const isCorrect = () => selected() === expected();
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
      phase={phase.phase}
      revealed={phase.revealed}
      canSubmit={canSubmit}
      submit={phase.submit}
      tryAgain={phase.tryAgain}
      nextInstance={phase.nextInstance}
      revealCorrect={phase.revealCorrect}
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
            // Blank slot — show the picked tile inline, or a placeholder.
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

      <div role="radiogroup" aria-label="candidate lines" class="flex flex-col gap-2">
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
            {(candidate) => {
              const state = () =>
                tileState({
                  selected: selected() === candidate,
                  submitted: phase.submitted(),
                  revealed: phase.revealed(),
                  isCorrect: candidate === expected(),
                });
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected() === candidate}
                  disabled={phase.phase() === "right"}
                  onClick={() => setSelected(candidate)}
                  class={cn(
                    "text-left px-3 py-2 border rounded-sm font-mono text-sm",
                    "cursor-pointer transition-colors disabled:cursor-not-allowed",
                    tileClass[state()],
                  )}
                >
                  {candidate}
                </button>
              );
            }}
          </For>
        </Show>
      </div>
    </ExerciseShell>
  );
}
