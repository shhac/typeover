import { cn } from "../ds/_internal";

/**
 * The four possible visual states for an MCQ option. Resolved purely
 * from the booleans (`selected`, `submitted`, `revealed`, `isCorrect`)
 * — see {@link optionCellState}.
 *
 *   "showCorrect"    — picked-and-correct on submit, OR the answer on reveal
 *   "showIncorrect"  — picked but not the answer on submit
 *   "selected"       — picked, pre-submission
 *   "neutral"        — everything else
 *
 * The learner-controls-reveal principle (design-docs/06-voice-and-feedback.md)
 * means we do NOT auto-light the canonical option after a wrong submit —
 * the learner has to click "Reveal correct" to see it. This used to fire
 * `showCorrect` for any `(submitted || revealed) && isCorrect`, which
 * spoiled the answer on wrong submits and diverged from FillBlankLine's
 * tile behaviour. Fixed to require either a correct submission OR an
 * explicit reveal.
 */
type CellState = "showCorrect" | "showIncorrect" | "selected" | "neutral";

/* Demoted 2026-05-20 per design-docs/17 — the MCQ option used to
 * render as a bordered pill card (full `border rounded-sm`). The
 * theme review flagged it as one of the worst pillification
 * offenders: stacked options read as five identical chips with
 * colour the only differentiator. The new shape is a left-rule
 * accent (a stripe of state colour) + a subtle background tint —
 * the row reads as a list item, not a card. Same state palette,
 * less chrome. */
const cellClass: Record<CellState, string> = {
  showCorrect: "border-l-success/80 bg-success/5",
  showIncorrect: "border-l-error/80 bg-error/5",
  selected: "border-l-accent-primary bg-accent-primary/5",
  neutral: "border-l-transparent hover:border-l-border-default",
};

export function optionCellState(args: {
  selected: boolean;
  submitted: boolean;
  revealed: boolean;
  isCorrect: boolean;
}): CellState {
  if (args.revealed && args.isCorrect) return "showCorrect";
  if (args.submitted && args.selected && args.isCorrect) return "showCorrect";
  if (args.submitted && args.selected && !args.isCorrect) return "showIncorrect";
  if (args.selected) return "selected";
  return "neutral";
}

interface McqOptionProps {
  /** Stable id, used in the `name` of the underlying radio. */
  groupName: string;
  index: number;
  text: string;
  selected: boolean;
  submitted: boolean;
  revealed: boolean;
  isCorrect: boolean;
  onSelect: () => void;
}

export function McqOption(props: McqOptionProps) {
  const state = () =>
    optionCellState({
      selected: props.selected,
      submitted: props.submitted,
      revealed: props.revealed,
      isCorrect: props.isCorrect,
    });
  return (
    <label
      class={cn(
        "flex items-start gap-3 py-3 pl-3 pr-2 cursor-pointer transition-colors",
        "border-l-4 border-l-transparent",
        cellClass[state()],
      )}
    >
      <input
        type="radio"
        name={props.groupName}
        value={props.index}
        checked={props.selected}
        disabled={props.submitted}
        onChange={props.onSelect}
        class="mt-1.5 accent-accent-primary"
        aria-describedby={`opt-${props.groupName}-${props.index}-text`}
      />
      <pre
        id={`opt-${props.groupName}-${props.index}-text`}
        class="font-mono text-sm text-fg-primary whitespace-pre-wrap leading-relaxed"
      >
        <code>{props.text}</code>
      </pre>
    </label>
  );
}
