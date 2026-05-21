import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/*
 * Single source of truth for the palette-aware CodeMirror styling
 * shared by every editor surface in the app:
 *   - CodeMirrorEditor (Freeform editable + ExerciseShell TS-source
 *     pane + McqOption read-only options)
 *   - CodeMirrorFillBlanks (fill-line + fill-word scaffolds with
 *     embedded BlankInput widgets)
 *
 * Previously each component had its own `syntaxStyle` constant and
 * its own `EditorView.theme({...})` block. Three near-identical
 * declarations diverged silently when the caret-colour fix landed
 * in only one. Centralised here so a palette tweak lands once.
 *
 * Knobs (factory-style): pass `minHeight`, `contentPadding`, and
 * whether to surface the focus outline. Callers compose on top
 * (e.g. CodeMirrorEditor adds caretColor + cursor specificity for
 * the editable case; the fill-blanks surface skips them entirely).
 */

/** Stack referenced by every editor surface. Was duplicated as a
 *  literal in two themes; one constant means a font tweak lands
 *  once. */
export const CODEMIRROR_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

/** Palette-aware syntax highlight style. Each token tag maps to a
 *  CSS variable from the design-system palette so colours flip
 *  with the active theme/style/palette pin rather than shipping
 *  CodeMirror's default purple-on-dark `defaultHighlightStyle`
 *  (which fought every palette per the 2026-05-21 screenshot
 *  review).
 *
 *  Mapping rationale:
 *    - keywords + function names → `--color-accent-primary` (brand
 *      amber); the visual anchor for "this is Go" in any palette.
 *    - strings + types → `--color-accent-go` (cyan/teal); pulls
 *      the Go-accent identity into the editor.
 *    - numbers + booleans + nulls + literals → `--color-accent-ts`
 *      (blue); a contrasting hue for literals across palettes.
 *    - comments → `--color-fg-faint` italic; recede.
 *    - operators + punctuation → `--color-fg-secondary`.
 *    - variables / property / attribute names → `--color-fg-primary`.
 */
export const codemirrorSyntaxStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.modifier], color: "var(--color-accent-primary)" },
  {
    tag: [tags.function(tags.variableName), tags.definition(tags.function(tags.variableName))],
    color: "var(--color-accent-primary)",
  },
  { tag: [tags.string, tags.character, tags.special(tags.string)], color: "var(--color-accent-go)" },
  { tag: [tags.typeName, tags.className], color: "var(--color-accent-go)" },
  { tag: [tags.number, tags.bool, tags.null, tags.literal], color: "var(--color-accent-ts)" },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: "var(--color-fg-faint)",
    fontStyle: "italic",
  },
  {
    tag: [tags.operator, tags.punctuation, tags.derefOperator],
    color: "var(--color-fg-secondary)",
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    color: "var(--color-fg-primary)",
  },
  { tag: [tags.escape, tags.regexp], color: "var(--color-accent-go)" },
  { tag: tags.meta, color: "var(--color-fg-muted)" },
]);

export interface CodeMirrorThemeOptions {
  /** Minimum editor height. `"auto"` for read-only display panes
   *  that should hug their content; a fixed value (e.g. `"16rem"`)
   *  for the editable surface. */
  minHeight?: string;
  /** Content padding. Read-only panes use uniform padding
   *  (`"0.75rem"`); the editable editor uses vertical-only because
   *  the line-number gutter handles horizontal. */
  contentPadding?: string;
  /** When false (default), the focus outline is hidden. The
   *  editable surface flips this on so a keyboard-only user sees
   *  where focus lives. */
  surfaceFocusOutline?: boolean;
  /** When true (default for editable surfaces), the contenteditable
   *  gets a `caretColor` and the CM-drawn cursor gets a
   *  palette-themed `borderLeft`. Read-only surfaces have no caret
   *  so these rules are skipped. */
  caret?: boolean;
}

/**
 * Build the editor's theme + syntax-highlighting extensions in one
 * place. Pass options for the variant-specific knobs; everything
 * else is shared.
 *
 * Returns an array because both `EditorView.theme(...)` and
 * `syntaxHighlighting(...)` are sibling extensions — callers spread
 * the result into their extensions list.
 */
export function codemirrorThemeExtensions(
  opts: CodeMirrorThemeOptions = {},
): Extension[] {
  const minHeight = opts.minHeight ?? "auto";
  const contentPadding = opts.contentPadding ?? "0.75rem";
  const focused = opts.surfaceFocusOutline === true;
  const caret = opts.caret !== false;

  const theme = EditorView.theme(
    {
      "&": {
        fontFamily: CODEMIRROR_FONT_FAMILY,
        fontSize: "0.875rem",
        backgroundColor: "var(--color-bg-inset)",
        color: "var(--color-fg-primary)",
        borderRadius: "0.125rem",
        border: "1px solid var(--color-border-default)",
        minHeight,
      },
      ".cm-scroller": { lineHeight: "1.6" },
      ".cm-content": {
        padding: contentPadding,
        ...(caret ? { caretColor: "var(--color-accent-primary)" } : {}),
      },
      ".cm-gutters": {
        backgroundColor: "var(--color-bg-inset)",
        color: "var(--color-fg-faint)",
        border: "none",
      },
      ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.02)" },
      ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.02)" },
      ...(caret
        ? {
            /* CM's drawn cursor is a `border-left`-styled <div>. The
             * default theme sets `border-left: 1.2px solid black` —
             * a *shorthand*. We override with the shorthand too
             * (longhand borderLeftColor loses cascade order) and
             * repeat under `&.cm-focused .cm-cursorLayer .cm-cursor`
             * to win specificity. */
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
          }
        : {}),
      "&.cm-focused": focused
        ? { outline: "2px solid var(--color-accent-primary)" }
        : { outline: "none" },
    },
    /* `dark: true` flips the editor's internal dark-mode styling so
     * its default cursor rule under `&dark .cm-cursor` doesn't fight
     * the explicit borderLeft above. */
    { dark: true },
  );

  return [theme, syntaxHighlighting(codemirrorSyntaxStyle, { fallback: true })];
}
