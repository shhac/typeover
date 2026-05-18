import { cn } from "../ds/_internal";

/**
 * Five visual states for a candidate-line tile (fill-blank-line).
 * Resolved purely from the booleans by {@link tileState}.
 *
 *   "correctSubmitted"   — picked-and-correct on submit
 *   "incorrectSubmitted" — picked but not correct on submit
 *   "correctRevealed"    — the canonical, lit up only after explicit reveal
 *   "selected"           — picked, pre-submission
 *   "neutral"            — everything else
 *
 * Matches the learner-controls-reveal principle from
 * design-docs/06-voice-and-feedback.md: the canonical tile is NOT
 * auto-lit after a wrong submit; the learner must click "Reveal correct".
 */
type TileState =
  | "correctSubmitted"
  | "incorrectSubmitted"
  | "correctRevealed"
  | "selected"
  | "neutral";

const tileClass: Record<TileState, string> = {
  correctSubmitted: "border-success/60 bg-success/5",
  incorrectSubmitted: "border-error/60 bg-error/5",
  correctRevealed: "border-success/60 bg-success/5",
  selected: "border-accent-amber bg-accent-amber/5",
  neutral: "border-border-default hover:border-border-strong",
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

interface CandidateTileProps {
  text: string;
  selected: boolean;
  submitted: boolean;
  revealed: boolean;
  isCorrect: boolean;
  /** When true, tile is disabled (typically the exercise is "right" phase). */
  locked: boolean;
  onSelect: () => void;
}

export function CandidateTile(props: CandidateTileProps) {
  const state = () =>
    tileState({
      selected: props.selected,
      submitted: props.submitted,
      revealed: props.revealed,
      isCorrect: props.isCorrect,
    });
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      disabled={props.locked}
      onClick={props.onSelect}
      class={cn(
        "text-left px-3 py-2 border rounded-sm font-mono text-sm",
        "cursor-pointer transition-colors disabled:cursor-not-allowed",
        tileClass[state()],
      )}
    >
      {props.text}
    </button>
  );
}
