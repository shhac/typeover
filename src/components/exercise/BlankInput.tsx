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
  neutral: "border-border-strong focus-within:border-accent-primary",
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
  /** Fires on Enter / numpad-Enter. FillBlankLineInput uses it to
   *  Run the substituted program; FillBlankWord uses it to focus
   *  the next empty blank or submit when all are filled. */
  onEnter?: () => void;
  /** Optional ref escape hatch so a parent can focus this input
   *  (e.g. fill-word's "Enter jumps to the next empty blank"). */
  ref?: (el: HTMLInputElement) => void;
  /** When true, the input floor widens to 64ch on desktop (`md:` and
   *  up) so a single-blank fill-line surface doesn't look cramped on
   *  browsers without `field-sizing: content` support (Firefox <138,
   *  older Safari). Fill-word leaves this false — multiple short
   *  blanks inside one snippet shouldn't each be 64ch wide. */
  wide?: boolean;
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
      ref={props.ref}
      type="text"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck={false}
      disabled={props.locked}
      value={props.value}
      aria-label={`fill-in blank ${props.varName}`}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (props.onEnter && (e.key === "Enter" || e.key === "NumpadEnter")) {
          e.preventDefault();
          props.onEnter();
        }
      }}
      class={cn(
        "inline-block px-1.5 py-0.5 bg-bg-base font-mono text-code",
        "border rounded-sm outline-none align-baseline",
        /* Width strategy (design-docs/19 F-3 follow-up):
         *   - `min-w-[14ch]` is the anti-leak floor — short answers
         *     don't render visibly shorter than long ones, so a
         *     learner can't infer the canonical's length from the
         *     blank's width.
         *   - `field-sizing-content` lets supported browsers grow
         *     the input width to fit the learner's TYPED content,
         *     so a 20-char answer doesn't truncate to 14ch the way
         *     the prior fixed-width did (caught by the 2026-05-21
         *     playtest screenshot of fill-line variables/07).
         *   - `max-w-full` caps the grown width at the parent
         *     container, so a runaway answer doesn't push the
         *     surrounding code off-screen.
         *   - Browsers without field-sizing support fall back to
         *     `w-[14ch]` (the prior shipped behavior); newer
         *     browsers — Chrome 123+, Firefox 138+, Safari 18.4+ —
         *     get the grow-with-content behavior automatically.
         *   - On `wide` inputs (fill-line), bump the desktop floor
         *     to 64ch so Firefox <138 / older Safari still get a
         *     usable surface for full-line answers. Mobile stays at
         *     14ch to fit narrow viewports. */
        "w-[14ch] min-w-[14ch] max-w-full field-sizing-content",
        props.wide && "md:min-w-[64ch] md:w-[64ch]",
        inputClass[state()],
      )}
    />
  );
}
