import { cn } from "../ds/_internal";
import { CodeMirrorEditor } from "../ds/CodeMirrorEditor";
import { isCodeMirrorTestEnv } from "~/lib/codemirror-test-env";
import { formatInline } from "~/lib/format-inline";
import { PROSE_CODE_ACCENT, type Accent } from "~/lib/lang";

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
  /** Render mode. `"code"` (default) renders the option as a read-
   *  only CodeMirror surface for Go/Rust/etc. option text. `"prose"`
   *  renders the option as plain prose with inline backtick spans
   *  highlighted — for `mcq-explain`, where the answers are
   *  explanations of behaviour, not language translations. */
  kind?: "code" | "prose";
  /** Accent for inline `code` spans in prose mode. Driven by the
   *  exercise's target language so the code identifiers in the
   *  answer text read as "this is Rust we're discussing" rather
   *  than colour-less. Ignored in code mode (CodeMirror handles
   *  highlighting). */
  accent?: Accent;
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
      {/* Option body. Three branches:
       *  - `kind="prose"` (mcq-explain) renders the option as plain
       *    prose so explanations don't get wrapped in a monospace
       *    code surface. Inline `backticks` are still highlighted
       *    via formatInline so referenced identifiers read as code.
       *  - test env renders as <pre><code> so getByText() resolves
       *    the option string in one node.
       *  - production (default) renders a read-only CodeMirror so
       *    Go/Rust option text gets palette-themed syntax
       *    highlighting (consistent with the Freeform editor and
       *    the fill-line scaffold). */}
      {props.kind === "prose" ? (
        <div
          id={`opt-${props.groupName}-${props.index}-text`}
          class={cn(
            "flex-1 min-w-0 text-sm text-fg-primary leading-relaxed",
            "[&>code]:font-mono [&>code]:bg-bg-inset [&>code]:rounded-sm [&>code]:px-1",
            props.accent ? PROSE_CODE_ACCENT[props.accent] : "[&>code]:text-fg-primary",
          )}
          innerHTML={formatInline(props.text)}
        />
      ) : isCodeMirrorTestEnv() ? (
        <pre
          id={`opt-${props.groupName}-${props.index}-text`}
          class="font-mono text-sm text-fg-primary whitespace-pre-wrap leading-relaxed"
        >
          <code>{props.text}</code>
        </pre>
      ) : (
        <div id={`opt-${props.groupName}-${props.index}-text`} class="flex-1 min-w-0">
          <CodeMirrorEditor
            value={props.text}
            readOnly
            language="go"
            ariaLabel={`Option ${props.index + 1}`}
          />
        </div>
      )}
    </label>
  );
}
