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

function inputCellState(args: {
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
        "border rounded-sm outline-none align-baseline min-w-[3ch]",
        inputClass[state()],
      )}
      style={{
        width: `${Math.max(props.expected.length + 1, 3)}ch`,
      }}
    />
  );
}
