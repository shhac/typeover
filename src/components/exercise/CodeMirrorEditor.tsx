import { createEffect, onCleanup, onMount } from "solid-js";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import {
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { go } from "@codemirror/lang-go";
import { javascript } from "@codemirror/lang-javascript";
import { tags } from "@lezer/highlight";

/** Language packs we support today. Add a value here and the matching
 *  switch case in `languageExtension` below when adding a third. */
export type EditorLanguage = "go" | "ts";

function languageExtension(lang: EditorLanguage): Extension {
  switch (lang) {
    case "go":
      return go();
    case "ts":
      return javascript({ typescript: true });
  }
}

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
  /** Ref escape hatch for external imperative ops. Ignored when
   *  readOnly — there's nothing to focus into / insert into. */
  ref?: (handle: CodeMirrorEditorHandle) => void;
}

function isTestEnv(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-codemirror-test")
  );
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
    const readOnly = props.readOnly === true;
    const lang = props.language ?? "go";
    /* Common extensions live in both modes. Editor-only extensions
     * (history, closeBrackets, indentOnInput, line numbers,
     * active-line highlight, keymap) drop out under readOnly so the
     * pane reads as static syntax-highlighted code rather than an
     * editable editor with disabled affordances. */
    const baseExtensions: Extension[] = [
      languageExtension(lang),
      syntaxHighlighting(syntaxStyle, { fallback: true }),
      EditorView.contentAttributes.of({
        "aria-label": props.ariaLabel ?? (lang === "go" ? "Go code" : "TypeScript source"),
        spellcheck: "false",
      }),
      EditorView.theme(
        {
          "&": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "0.875rem",
            backgroundColor: "var(--color-bg-inset)",
            color: "var(--color-fg-primary)",
            borderRadius: "0.125rem",
            border: "1px solid var(--color-border-default)",
            minHeight: readOnly ? "auto" : "16rem",
          },
          ".cm-scroller": { lineHeight: "1.6" },
          /* `caret-color` lives on .cm-content (the contenteditable
           * surface) — that's where the browser draws the native
           * text-insertion caret. Setting it on the editor root
           * doesn't propagate down because contenteditable
           * overrides. */
          ".cm-content": { padding: "0.75rem 0", caretColor: "var(--color-accent-primary)" },
          ".cm-gutters": {
            backgroundColor: "var(--color-bg-inset)",
            color: "var(--color-fg-faint)",
            border: "none",
          },
          ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.02)" },
          ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.02)" },
          /* CM's drawn cursor is a `border-left`-styled <div>. The
           * default theme sets `border-left: 1.2px solid black` —
           * a *shorthand*. To override on a dark background we
           * have to use the shorthand too (a longhand
           * `borderLeftColor` would lose to the shorthand's
           * declared order). Repeating the rule under
           * `&.cm-focused .cm-cursorLayer .cm-cursor` raises
           * specificity above the focused-state default that
           * CM applies via `&.cm-focused > .cm-scroller >
           * .cm-cursorLayer .cm-cursor`. */
          ".cm-cursor, .cm-dropCursor": {
            borderLeft: "1.5px solid var(--color-accent-primary)",
          },
          "&.cm-focused .cm-cursorLayer .cm-cursor": {
            borderLeft: "1.5px solid var(--color-accent-primary)",
          },
          "&.cm-focused .cm-selectionBackground, ::selection": {
            backgroundColor: "var(--color-accent-primary)",
            opacity: "0.18",
          },
          "&.cm-focused": readOnly
            ? { outline: "none" }
            : { outline: "2px solid var(--color-accent-primary)" },
        },
        /* `dark: true` flips the editor's internal dark-mode
         * styling so its default cursor rule under `&dark .cm-cursor`
         * doesn't fight us. Our explicit borderLeft above wins
         * either way, but flipping the flag also keeps any other
         * dark-mode-conditional default in sync with our palette. */
        { dark: true },
      ),
    ];

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

    const state = EditorState.create({
      doc: props.value,
      extensions: [...baseExtensions, ...editorOnly],
    });
    view = new EditorView({ state, parent });

    if (!readOnly && props.ref) {
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
    /* The editable compartment is only added in editor mode (not
     * readOnly). Guard so the reconfigure isn't dispatched into a
     * state that doesn't know the compartment. */
    if (props.readOnly === true) return;
    view.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!props.disabled)),
    });
  });

  onCleanup(() => view?.destroy());

  return <div ref={parent} />;
}
