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

const cellClass: Record<CellState, string> = {
  showCorrect: "border-success/60 bg-success/5",
  showIncorrect: "border-error/60 bg-error/5",
  selected: "border-accent-amber bg-accent-amber/5",
  neutral: "border-border-default hover:border-border-strong",
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
        "flex items-start gap-3 p-3 border rounded-sm cursor-pointer transition-colors",
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
        class="mt-1.5 accent-accent-amber"
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
