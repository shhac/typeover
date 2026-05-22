import { onMount } from "solid-js";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { bracketMatching, indentOnInput, indentUnit } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { isCodeMirrorTestEnv } from "~/lib/codemirror-test-env";
import { codemirrorThemeExtensions } from "~/lib/codemirror-theme";
import { cmLanguageExtension, type CmLanguage } from "~/lib/codemirror-lang";
import { completionExtension, type CompletionLanguage } from "~/lib/code-completions";
import { useCodeMirror } from "~/lib/use-codemirror";

/** Language packs the editor supports. Alias of `CmLanguage`, kept
 *  as a named export so existing consumers (Freeform, FillBlank
 *  surfaces) don't churn imports. */
export type EditorLanguage = CmLanguage;

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
  /** Fires on every doc change. Omit for purely read-only display —
   *  the editor still won't dispatch from external value updates. */
  onValueChange?: (value: string) => void;
  /** Fired on Cmd/Ctrl+Enter inside the editor. The caller decides
   *  whether to actually Run (Freeform checks canSubmit). */
  onCmdEnter?: () => void;
  /** When true, the editor becomes read-only (success-phase
   *  lockout). Differs from `readOnly`: `disabled` still keeps the
   *  history/keymap stack intact (so a re-enable resumes cleanly);
   *  `readOnly` strips them for a display-only surface. */
  disabled?: boolean;
  /** When true, drops the editor's mutating extensions entirely —
   *  no history, no closeBrackets, no indent-on-input, no line
   *  numbers, no active-line highlight, no Cmd+Enter binding. The
   *  result is a syntax-highlighted block that reads as a
   *  CodeBlock but stays themed with the live editor. Used for
   *  the TS-source pane in the exercise shell. */
  readOnly?: boolean;
  /** Language pack to load. Defaults to "go". */
  language?: EditorLanguage;
  /** Aria-label for the editor surface (CodeMirror puts it on
   *  the contentDOM). */
  ariaLabel?: string;
  /** Optional canonical (reference solution) source string. When
   *  `language === "zig"`, identifiers extracted from this string
   *  seed the in-scope completer so the dropdown can suggest
   *  names the exercise has shown but the learner hasn't yet
   *  typed in the editor. Surfacing identifiers doesn't give the
   *  answer away — assembling them into the right call chain is
   *  the part the learner still does. Ignored for other
   *  languages. */
  canonical?: string;
  /** Ref escape hatch for external imperative ops. Ignored when
   *  readOnly — there's nothing to focus into / insert into. */
  ref?: (handle: CodeMirrorEditorHandle) => void;
}

/* Plain-textarea (or <pre> in readOnly mode) fallback used inside
 * the test environment. CM's contentEditable is brittle in jsdom,
 * so test paths target the simpler DOM while the production
 * surface ships in browsers. */
function TestareaFallback(props: CodeMirrorEditorProps) {
  if (props.readOnly) {
    return (
      <pre
        class="w-full font-mono text-code p-3 bg-bg-inset border border-border-default rounded-sm leading-relaxed overflow-x-auto"
        aria-label={props.ariaLabel}
        data-readonly-fallback="1"
      >
        {props.value}
      </pre>
    );
  }
  /* oxlint-disable-next-line no-unassigned-vars — Solid's `ref={el}`
   * binding assigns via a compiler-emitted setter the linter doesn't see. */
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
          props.onValueChange?.(next);
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
      onInput={(e) => props.onValueChange?.(e.currentTarget.value)}
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

/* Aria labels per language. Used as the contentDOM default when the
 * caller doesn't supply one. */
const ARIA_LABEL_BY_LANG: Record<EditorLanguage, string> = {
  go: "Go code",
  ts: "TypeScript source",
  zig: "Zig code",
};

/* Map editor language → completion language. Returns null for
 * languages without a curated member map (the TS pane is read-only
 * and doesn't need completion). */
function toCompletionLanguage(lang: EditorLanguage): CompletionLanguage | null {
  return lang === "zig" ? "zig" : lang === "go" ? "go" : null;
}

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  if (isCodeMirrorTestEnv()) return TestareaFallback(props);

  /* oxlint-disable-next-line no-unassigned-vars — Solid ref binding. */
  let parent: HTMLDivElement | undefined;
  const readOnly = props.readOnly === true;
  const lang = props.language ?? "go";

  useCodeMirror({
    parent: () => parent,
    initialDoc: props.value,
    /* Sync external `value` changes only when the editor is
     * editable. Read-only display mode is one-shot — the caller
     * doesn't expect to mutate via the value prop after mount. */
    value: readOnly ? undefined : () => props.value,
    /* Toggle editability when `disabled` flips. Only relevant in
     * editor mode (readOnly mode never adds the compartment). */
    editable: readOnly ? undefined : () => !props.disabled,
    buildExtensions: (editableCompartment) => {
      const completionLang = toCompletionLanguage(lang);
      const completion: Extension[] =
        completionLang && !readOnly
          ? [completionExtension({ language: completionLang, canonical: props.canonical })]
          : [];

      const baseExtensions: Extension[] = [
        cmLanguageExtension(lang),
        EditorView.contentAttributes.of({
          "aria-label": props.ariaLabel ?? ARIA_LABEL_BY_LANG[lang],
          spellcheck: "false",
        }),
        ...codemirrorThemeExtensions({
          minHeight: readOnly ? "auto" : "16rem",
          contentPadding: "0.75rem 0",
          surfaceFocusOutline: !readOnly,
          caret: !readOnly,
        }),
      ];

      /* Editor-only extensions (history, closeBrackets, indent-on-
       * input, line numbers, active-line highlight, keymap) drop
       * out under readOnly so the pane reads as static syntax-
       * highlighted code rather than an editable editor with
       * disabled affordances. */
      const editorOnly: Extension[] = readOnly
        ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
        : [
            lineNumbers(),
            history(),
            bracketMatching(),
            closeBrackets(),
            indentOnInput(),
            indentUnit.of("\t"),
            highlightActiveLine(),
            editableCompartment.of(EditorView.editable.of(!props.disabled)),
            ...completion,
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
                props.onValueChange?.(update.state.doc.toString());
              }
            }),
          ];

      return [...baseExtensions, ...editorOnly];
    },
    onView: (view) => {
      if (readOnly || !props.ref) return;
      const handle: CodeMirrorEditorHandle = {
        focus: () => view.focus(),
        insertAtCursor: (text: string) => {
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
        },
      };
      props.ref(handle);
    },
  });

  return <div ref={parent} />;
}
