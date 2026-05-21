import { createEffect, onCleanup, onMount } from "solid-js";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import {
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  indentUnit,
  StreamLanguage,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { go } from "@codemirror/legacy-modes/mode/go";
import { tags } from "@lezer/highlight";

/*
 * Solid wrapper around CodeMirror 6 for the Freeform exercise's
 * code-editing surface. Replaces the bare `<textarea>` per
 * design-docs/16 F-19 — that finding was "Auto-indent in freeform
 * textarea but no syntax highlighting, no bracket-match, no
 * autocomplete… a learner writing 10+ lines of Go in a plain
 * textarea will make trivial syntax errors the editor would have
 * prevented."
 *
 * Extensions we wire up:
 *   - `go` (StreamLanguage) — syntax tokenisation from the
 *     legacy-modes Go grammar. Renders keywords / strings /
 *     comments via `defaultHighlightStyle` (themed by our CSS).
 *   - `bracketMatching` — visually pair `{}`, `()`, `[]` when the
 *     caret is adjacent to one.
 *   - `closeBrackets` — typing `{` inserts `}` after the caret;
 *     selection-wrap when text is selected.
 *   - `indentOnInput` + `indentUnit("\t")` — tab characters per
 *     `gofmt`'s convention.
 *   - `lineNumbers` — gutter so multi-line programs have
 *     line-error context when Yaegi reports a line.
 *   - `highlightActiveLine` — subtle current-line tint.
 *   - `history` + history keymap — Cmd/Ctrl+Z / Shift redo.
 *   - Cmd/Ctrl+Enter binding — runs the program (mirrors the
 *     textarea-era shortcut from `Freeform.tsx`).
 *
 * Why a wrapper rather than dropping CodeMirror directly into
 * Freeform: testability + reuse. FillBlankLineInput stays on a
 * single-line `<input>` (CodeMirror is overkill there); only the
 * multi-line surface gets the editor.
 *
 * Test-mode override: when `CodeMirrorEditor` is mounted under
 * a `data-codemirror-test` ancestor (vitest sets this on its
 * document root via `vitest.setup.ts`), we render a plain
 * `<textarea>` instead — CodeMirror's contentEditable is
 * notoriously brittle inside jsdom and the editor's behaviour
 * isn't what we're testing in those suites. Production paths
 * (browser, real Astro hydration) get the real editor.
 */

export interface CodeMirrorEditorHandle {
  /** Move keyboard focus into the editor. */
  focus(): void;
  /** Insert `text` at the current cursor position; replaces the
   *  selection if any. Used by MobileKeyBar's `insertAtFocused`
   *  path so the bar's `{` / `}` / `:=` chips work the same as in
   *  the legacy textarea. Fires a synthetic value change so the
   *  Solid signal updates. */
  insertAtCursor(text: string): void;
}

interface CodeMirrorEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Fired on Cmd/Ctrl+Enter inside the editor. The caller decides
   *  whether to actually Run (Freeform checks canSubmit). */
  onCmdEnter?: () => void;
  /** When true, the editor becomes read-only (success-phase
   *  lockout). */
  disabled?: boolean;
  /** Aria-label for the editor surface (CodeMirror puts it on
   *  the contentDOM). */
  ariaLabel?: string;
  /** Ref escape hatch for external imperative ops. */
  ref?: (handle: CodeMirrorEditorHandle) => void;
}

function isTestEnv(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-codemirror-test")
  );
}

/* Plain-textarea fallback used inside the test environment. Mirrors
 * the legacy Freeform textarea closely enough that the existing
 * suite (which dispatches keyboard events on a textarea) keeps
 * working. The production CodeMirror surface ships in browsers. */
function TestareaFallback(props: CodeMirrorEditorProps) {
  let el: HTMLTextAreaElement | undefined;
  onMount(() => {
    if (props.ref && el) {
      const handle: CodeMirrorEditorHandle = {
        focus: () => el!.focus(),
        insertAtCursor: (text: string) => {
          const ta = el!;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const before = ta.value.slice(0, start);
          const after = ta.value.slice(end);
          const next = before + text + after;
          props.onValueChange(next);
          /* Keep the caret after the inserted text on the next
           * tick — Solid hasn't yet propagated `value`. */
          queueMicrotask(() => {
            ta.selectionStart = start + text.length;
            ta.selectionEnd = start + text.length;
          });
        },
      };
      props.ref(handle);
    }
  });
  return (
    <textarea
      ref={el}
      class="w-full min-h-[16rem] font-mono text-code p-3 bg-bg-inset border border-border-default rounded-sm leading-relaxed resize-y"
      value={props.value}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      onInput={(e) => props.onValueChange(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          props.onCmdEnter?.();
        }
      }}
      spellcheck={false}
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
    />
  );
}

/* Palette-aware syntax highlight style. Each token tag maps to a
 * CSS variable from the design-system palette so the editor's
 * colours flip with the active theme/style/palette pin rather than
 * shipping CodeMirror's default purple-on-dark `defaultHighlightStyle`
 * (which fights every palette per the 2026-05-21 screenshot review).
 *
 * Mapping rationale:
 *   - keyword + function names → `--color-accent-primary` (the
 *     site's brand amber); these are the visual anchor for "this is
 *     Go" in any palette.
 *   - strings + types → `--color-accent-go`; pulls the Go-accent
 *     into the editor so the language identity is visible.
 *   - numbers + booleans + nulls → `--color-accent-ts`; semantically
 *     odd but pragmatically: these are the second-rank "literal"
 *     class and need a contrasting hue, and the TS-accent (blue)
 *     is already present in every palette per design-docs/22.
 *   - comments → `--color-fg-faint`; comments should recede.
 *   - operators + punctuation → `--color-fg-secondary`; readable but
 *     not loud.
 *   - variables → `--color-fg-primary`; default body colour, no
 *     extra emphasis. */
const syntaxStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.modifier], color: "var(--color-accent-primary)" },
  { tag: [tags.function(tags.variableName), tags.definition(tags.function(tags.variableName))], color: "var(--color-accent-primary)" },
  { tag: [tags.string, tags.character, tags.special(tags.string)], color: "var(--color-accent-go)" },
  { tag: [tags.typeName, tags.className], color: "var(--color-accent-go)" },
  { tag: [tags.number, tags.bool, tags.null, tags.literal], color: "var(--color-accent-ts)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: "var(--color-fg-faint)", fontStyle: "italic" },
  { tag: [tags.operator, tags.punctuation, tags.derefOperator], color: "var(--color-fg-secondary)" },
  { tag: [tags.variableName, tags.propertyName, tags.attributeName], color: "var(--color-fg-primary)" },
  { tag: [tags.escape, tags.regexp], color: "var(--color-accent-go)" },
  { tag: tags.meta, color: "var(--color-fg-muted)" },
]);

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  if (isTestEnv()) return TestareaFallback(props);

  let parent: HTMLDivElement | undefined;
  let view: EditorView | undefined;
  const editableCompartment = new Compartment();

  onMount(() => {
    if (!parent) return;
    const state = EditorState.create({
      doc: props.value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        indentUnit.of("\t"),
        highlightActiveLine(),
        StreamLanguage.define(go),
        syntaxHighlighting(syntaxStyle, { fallback: true }),
        editableCompartment.of(EditorView.editable.of(!props.disabled)),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              props.onCmdEnter?.();
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            props.onValueChange(update.state.doc.toString());
          }
        }),
        EditorView.contentAttributes.of({
          "aria-label": props.ariaLabel ?? "Go code",
          spellcheck: "false",
        }),
        EditorView.theme({
          "&": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "0.875rem",
            backgroundColor: "var(--color-bg-inset)",
            color: "var(--color-fg-primary)",
            borderRadius: "0.125rem",
            border: "1px solid var(--color-border-default)",
            minHeight: "16rem",
          },
          ".cm-scroller": { lineHeight: "1.6" },
          ".cm-content": { padding: "0.75rem 0" },
          ".cm-gutters": {
            backgroundColor: "var(--color-bg-inset)",
            color: "var(--color-fg-faint)",
            border: "none",
          },
          ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.02)" },
          ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.02)" },
          "&.cm-focused": { outline: "2px solid var(--color-accent-primary)" },
        }),
      ],
    });
    view = new EditorView({ state, parent });

    if (props.ref) {
      const handle: CodeMirrorEditorHandle = {
        focus: () => view!.focus(),
        insertAtCursor: (text: string) => {
          if (!view) return;
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
        },
      };
      props.ref(handle);
    }
  });

  /* Keep CM in sync with externally-changed `value` (e.g. Reveal
   * canonical sets the code from outside). Skip when the value
   * matches what CM already holds — avoids re-dispatching during
   * the normal onValueChange cycle. */
  createEffect(() => {
    if (!view) return;
    const incoming = props.value;
    const current = view.state.doc.toString();
    if (incoming !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: incoming },
      });
    }
  });

  createEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!props.disabled)),
    });
  });

  onCleanup(() => view?.destroy());

  return <div ref={parent} />;
}
