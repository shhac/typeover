import { createEffect, onCleanup, onMount } from "solid-js";
import { EditorState, Compartment, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { history, historyKeymap } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { go } from "@codemirror/lang-go";
import { zigLanguage } from "@ndim/codemirror-lang-zig";
import { isCodeMirrorTestEnv } from "~/lib/codemirror-test-env";
import { codemirrorThemeExtensions } from "~/lib/codemirror-theme";
import { completionExtension, type CompletionLanguage } from "~/lib/code-completions";
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
   *  (e.g. fill-word's "Enter jumps to the next empty blank").
   *
   *  Under production (CodeMirror path), the ref is to the
   *  `cm-content` contenteditable div — focus + click + caret
   *  positioning all work via that element. Under test-env
   *  (legacy `<input>` fallback), it's to the input element. */
  ref?: (el: HTMLElement) => void;
  /** When true, the input floor widens to 64ch on desktop (`md:` and
   *  up) so a single-blank fill-line surface doesn't look cramped on
   *  browsers without `field-sizing: content` support (Firefox <138,
   *  older Safari). Fill-word leaves this false — multiple short
   *  blanks inside one snippet shouldn't each be 64ch wide. */
  wide?: boolean;
  /** Programming language for the inline completion sources. When
   *  set, the BlankInput's tiny CodeMirror editor gets the matching
   *  language pack + completion extension. Omit to skip language
   *  loading (the fallback is a plain text surface). */
  language?: CompletionLanguage;
  /** Reference answer text — seeds the in-scope identifier
   *  completer. Surfacing identifiers doesn't give the answer away
   *  (the learner still has to assemble them); skipping it would
   *  mean the dropdown can only see what's already in the
   *  scaffold + buffer. */
  canonical?: string;
}

export function BlankInput(props: BlankInputProps) {
  const state = () =>
    inputCellState({
      value: props.value,
      expected: props.expected,
      submitted: props.submitted,
      revealed: props.revealed,
    });
  if (isCodeMirrorTestEnv()) return BlankInputFallback(props, state);
  return BlankInputCodeMirror(props, state);
}

/* ============================================================
 *  Test-env fallback — the legacy <input> implementation.
 *  Used under vitest's jsdom because CodeMirror's contentEditable
 *  is brittle there, and the existing fill-line / fill-word tests
 *  query for input elements directly.
 * ============================================================ */
function BlankInputFallback(props: BlankInputProps, state: () => InputState) {
  return (
    <input
      ref={props.ref as ((el: HTMLInputElement) => void) | undefined}
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
        "w-[14ch] min-w-[14ch] max-w-full field-sizing-content",
        props.wide && "md:min-w-[64ch] md:w-[64ch]",
        inputClass[state()],
      )}
    />
  );
}

/* ============================================================
 *  CodeMirror surface — production path.
 *  A single-line editor with syntax highlighting + completion.
 *  Single-line is enforced via a transaction filter that strips
 *  newlines before they reach the document.
 * ============================================================ */
function BlankInputCodeMirror(props: BlankInputProps, state: () => InputState) {
  /* oxlint-disable-next-line no-unassigned-vars — Solid ref binding. */
  let parent: HTMLSpanElement | undefined;
  let view: EditorView | undefined;
  const editableCompartment = new Compartment();

  /* Strip newlines from any transaction's changes — fill-line and
   * fill-word are single-line by definition. Paste of multi-line
   * content collapses to single-line content. Replace the whole
   * doc with the cleaned version so CM's history stays
   * single-step (not "type + then strip"). */
  const singleLineFilter = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    const newDoc = tr.newDoc.toString();
    if (!newDoc.includes("\n")) return tr;
    return {
      changes: { from: 0, to: tr.startState.doc.length, insert: newDoc.replaceAll("\n", "") },
    };
  });

  onMount(() => {
    if (!parent) return;

    const languageExt: Extension = props.language === "zig" ? zigLanguage : go();
    const completionExt: Extension[] = props.language
      ? [completionExtension({ language: props.language, canonical: props.canonical })]
      : [];

    const state0 = EditorState.create({
      doc: props.value,
      extensions: [
        languageExt,
        singleLineFilter,
        history(),
        closeBrackets(),
        ...completionExt,
        editableCompartment.of(EditorView.editable.of(!props.locked)),
        /* Enter on the blank fires `onEnter` (Run / next-blank) —
         * Prec.high so it wins over CM's default newline insert
         * (which the transactionFilter would strip anyway, but
         * binding here means the keystroke never tries to insert
         * in the first place). */
        Prec.high(
          keymap.of([
            {
              key: "Enter",
              run: () => {
                props.onEnter?.();
                return true;
              },
            },
          ]),
        ),
        keymap.of([...closeBracketsKeymap, ...historyKeymap]),
        EditorView.contentAttributes.of({
          "aria-label": `fill-in blank ${props.varName}`,
          spellcheck: "false",
          autocomplete: "off",
          autocapitalize: "off",
          autocorrect: "off",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            props.onInput(update.state.doc.toString());
          }
        }),
        /* Single-line theme: no line numbers, no active-line
         * highlight, minimal padding, content hugs its width. */
        ...codemirrorThemeExtensions({
          minHeight: "auto",
          contentPadding: "0.125rem 0.375rem",
          surfaceFocusOutline: false,
          caret: true,
        }),
        /* Inline display + content-hug so the editor sits naturally
         * in the surrounding scaffold like an `<input>` did. */
        EditorView.theme({
          "&": {
            display: "inline-block",
            verticalAlign: "baseline",
            minWidth: "14ch",
            maxWidth: "100%",
          },
          ".cm-scroller": { overflowX: "auto", overflowY: "hidden" },
          ".cm-content": { whiteSpace: "pre", padding: "0" },
          ".cm-line": { padding: "0" },
        }),
      ],
    });

    view = new EditorView({ state: state0, parent });
    if (props.ref) props.ref(view.contentDOM);
  });

  /* Sync external `value` changes (e.g. parent setState resets) into
   * the editor's doc. Skip when the values already match to avoid
   * cursor-jump loops with the updateListener above. */
  createEffect(() => {
    const v = props.value;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === v) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: v },
    });
  });

  /* Toggle editability when `locked` flips. */
  createEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!props.locked)),
    });
  });

  onCleanup(() => view?.destroy());

  return (
    <span
      ref={parent}
      class={cn(
        "inline-block align-baseline bg-bg-base font-mono text-code",
        "border rounded-sm",
        /* min-width matches the legacy <input> floor; the editor
         * inside hugs content via the inline theme above. */
        "min-w-[14ch] max-w-full",
        props.wide && "md:min-w-[64ch]",
        inputClass[state()],
        props.locked && "opacity-70",
      )}
    />
  );
}
