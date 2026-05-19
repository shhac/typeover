import { cn } from "../ds/_internal";

/**
 * Five visual states for a fill-blank input. Resolved purely from the
 * booleans — see {@link inputCellState}.
 *
 *   "correctRevealed"    — reveal-pass, value matches expected
 *   "incorrectRevealed"  — reveal-pass, value differs from expected
 *   "correctSubmitted"   — submission-pass, value matches expected
 *   "incorrectSubmitted" — submission-pass, value differs from expected
 *   "neutral"            — pre-submission or reveal
 *
 * The shape diverges from optionCellState / tileState (which use a
 * `selected` boolean): an input has no discrete "selected" — every
 * slot continuously holds a value. So the resolver axes are
 * (value === expected) × submitted × revealed, not selection-based.
 * Class palette also adds text-success / text-error because the
 * input's own text needs colouring; the option/tile only style the
 * container.
 */
type InputState =
  | "correctRevealed"
  | "incorrectRevealed"
  | "correctSubmitted"
  | "incorrectSubmitted"
  | "neutral";

const inputClass: Record<InputState, string> = {
  correctRevealed: "border-success/60 bg-success/5 text-success",
  incorrectRevealed: "border-error/60 bg-error/5 text-error",
  correctSubmitted: "border-success/60 bg-success/5",
  incorrectSubmitted: "border-error/60 bg-error/5",
  neutral: "border-border-strong focus-within:border-accent-amber",
};

export function inputCellState(args: {
  value: string;
  expected: string;
  submitted: boolean;
  revealed: boolean;
}): InputState {
  const match = args.value === args.expected;
  if (args.revealed) {
    return match ? "correctRevealed" : "incorrectRevealed";
  }
  if (args.submitted) {
    return match ? "correctSubmitted" : "incorrectSubmitted";
  }
  return "neutral";
}

interface BlankInputProps {
  slotIdx: number;
  varName: string;
  expected: string;
  value: string;
  submitted: boolean;
  revealed: boolean;
  /** When the exercise is in the "right" phase (submitted && all
   *  correct), the inputs are disabled so the learner can't accidentally
   *  edit and re-submit. */
  locked: boolean;
  onInput: (value: string) => void;
}

export function BlankInput(props: BlankInputProps) {
  const state = () =>
    inputCellState({
      value: props.value,
      expected: props.expected,
      submitted: props.submitted,
      revealed: props.revealed,
    });
  return (
    <input
      type="text"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck={false}
      disabled={props.locked}
      value={props.value}
      aria-label={`fill-in blank ${props.varName}`}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      class={cn(
        "inline-block px-1.5 py-0.5 bg-bg-base font-mono text-[13px]",
        "border rounded-sm outline-none align-baseline min-w-[5ch]",
        inputClass[state()],
      )}
      style={{
        /* border-box + ~14px of padding+border means width-in-ch
         * underreads the content area by ~2ch. Buffer of 4 keeps the
         * text from clipping even for the longest expected value in
         * the pool. min-w-[5ch] guards tiny one-char expecteds. */
        width: `${Math.max(props.expected.length + 4, 5)}ch`,
      }}
    />
  );
}
