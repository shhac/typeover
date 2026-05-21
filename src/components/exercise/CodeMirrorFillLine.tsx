import { createSignal, For, onCleanup, onMount, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { go } from "@codemirror/lang-go";
import { tags } from "@lezer/highlight";
import { BlankInput } from "./BlankInput";
import type { FillSegment } from "~/lib/generator-runtime";

/*
 * Fill-line surface: a read-only CodeMirror editor whose blanks are
 * REPLACED visually by interactive <BlankInput> widgets. The
 * surrounding text is syntax-highlighted by the Go Lezer parser; the
 * embedded inputs stay real DOM <input> elements so a11y, IME, the
 * MobileKeyBar's insertAtFocused, and screen readers all continue
 * to work as they did with the legacy CodeBlock + segments tree.
 *
 * design-docs/16 F-19 follow-up — the freeform editor surface is now
 * CodeMirror; this brings fill-line to parity so the two interactive
 * surfaces feel the same.
 *
 * Architecture:
 *   - The CodeMirror doc text is built by joining the segments and
 *     substituting each blank with its EXPECTED value. That keeps
 *     the doc syntactically valid so tokens around the blank
 *     highlight correctly (e.g. `if got != want { ... }` highlights
 *     `if` / `!=` even though the user-typed value may differ).
 *   - For each blank, a `Decoration.replace` covering that range is
 *     paired with a `BlankInputWidget` that renders a real <input>
 *     into the editor flow. The widget is "atomic" from CM's
 *     perspective (`atomicRanges` + `ignoreEvent`), so cursor /
 *     selection / typing inside the input doesn't perturb the doc.
 *   - Solid signals power the widget via `solid-js/web`'s
 *     standalone `render()` — the widget's toDOM creates a host
 *     <span>, mounts a `<BlankInput>` into it, and tears down on
 *     destroy.
 *
 * Test-mode fallback: when `data-codemirror-test` is on <html>
 * (vitest), this component degrades to the legacy CodeBlock-style
 * span-per-segment tree so the existing test suite (which
 * dispatches on the BlankInput) keeps working without
 * CodeMirror-internal probing.
 */

interface CodeMirrorFillLineProps {
  segments: readonly FillSegment[];
  /** Reactive accessor for the current input value. */
  value: () => string;
  /** Fires on every input mutation. */
  onValueChange: (next: string) => void;
  /** Submitted flag (drives BlankInput's correct/incorrect tint). */
  submitted: () => boolean;
  /** Revealed flag — same role as on BlankInput; the fill-line
   *  consumer always passes `false` (stdout is the oracle, not
   *  string match), but it's still wired through for parity. */
  revealed: () => boolean;
  /** Locked = right-phase. Disables the input so a learner can't
   *  edit after passing. */
  locked: () => boolean;
  /** Fires on Enter / NumpadEnter in the input. The fill-line
   *  consumer wires this to yaegi.run(). */
  onEnter?: () => void;
}

function isTestEnv(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-codemirror-test")
  );
}

/* Same palette-aware highlight style as CodeMirrorEditor. Repeated
 * here as a small constant rather than re-exported from there so
 * the two components stay independent (different feature surfaces
 * shouldn't share a cross-import unless they need to). */
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

/* The widget owns its mount lifecycle: toDOM creates a host span,
 * mounts a Solid <BlankInput>, and disposes on destroy. CM treats
 * the widget as atomic so cursor / selection ops skip over it. */
class BlankInputWidget extends WidgetType {
  /** Disposer returned by Solid's standalone render(); called on
   *  WidgetType.destroy. */
  private disposers: Array<() => void> = [];

  constructor(
    private readonly varName: string,
    private readonly expected: string,
    private readonly value: () => string,
    private readonly onInput: (next: string) => void,
    private readonly submitted: () => boolean,
    private readonly revealed: () => boolean,
    private readonly locked: () => boolean,
    private readonly onEnter?: () => void,
  ) {
    super();
  }

  /* WidgetType identity for CM's diffing — two widgets are equal if
   * they reference the same blank slot. Without this the entire
   * widget rebuilds on every state change, losing focus + losing
   * the in-progress input value. */
  eq(other: BlankInputWidget): boolean {
    return (
      other instanceof BlankInputWidget &&
      other.varName === this.varName &&
      other.expected === this.expected
    );
  }

  toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "inline-block align-baseline";
    const dispose = render(
      () => (
        <BlankInput
          slotIdx={0}
          varName={this.varName}
          expected={this.expected}
          value={this.value()}
          submitted={this.submitted()}
          revealed={this.revealed()}
          locked={this.locked()}
          onInput={this.onInput}
          onEnter={this.onEnter}
        />
      ),
      host,
    );
    this.disposers.push(dispose);
    return host;
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  /* Let DOM events from the embedded <input> through unobstructed.
   * Without this CM tries to interpret typing as document edits. */
  ignoreEvent(): boolean {
    return true;
  }
}

/* Build the static doc text by substituting each blank's expected
 * value into the text run. Returns both the assembled doc and the
 * (from, to) range of each blank within it so the decoration
 * plugin can position widgets. */
function buildDocAndRanges(
  segments: readonly FillSegment[],
): { doc: string; blankRanges: Array<{ from: number; to: number; seg: Extract<FillSegment, { kind: "blank" }> }> } {
  let doc = "";
  const blankRanges: Array<{ from: number; to: number; seg: Extract<FillSegment, { kind: "blank" }> }> = [];
  for (const seg of segments) {
    if (seg.kind === "text") {
      doc += seg.text;
    } else {
      const from = doc.length;
      doc += seg.expected;
      blankRanges.push({ from, to: doc.length, seg });
    }
  }
  return { doc, blankRanges };
}

/* Legacy span-tree fallback for the test environment. Mirrors the
 * pre-CodeMirror DOM shape so the existing FillBlankLineInput
 * tests (which query for input elements) keep finding them. */
function LegacyFallback(props: CodeMirrorFillLineProps): JSX.Element {
  return (
    <div class="font-mono text-code bg-bg-inset p-3 rounded-sm border border-border-default">
      <For each={props.segments}>
        {(seg) => {
          if (seg.kind === "text") return <span>{seg.text}</span>;
          return (
            <span class="inline-block align-baseline">
              <BlankInput
                slotIdx={0}
                varName={seg.varName}
                expected={seg.expected}
                value={props.value()}
                submitted={props.submitted()}
                revealed={props.revealed()}
                locked={props.locked()}
                onInput={props.onValueChange}
                onEnter={props.onEnter}
              />
            </span>
          );
        }}
      </For>
    </div>
  );
}

export function CodeMirrorFillLine(props: CodeMirrorFillLineProps): JSX.Element {
  if (isTestEnv()) return LegacyFallback(props);

  let parent: HTMLDivElement | undefined;
  let view: EditorView | undefined;

  onMount(() => {
    if (!parent) return;
    const { doc, blankRanges } = buildDocAndRanges(props.segments);

    /* The decoration set is computed once on mount — the segments
     * structure is static for a given exercise instance (Reshuffle
     * remounts the component). Re-derivation per state change is
     * unnecessary. */
    const widgets = blankRanges.map((b) =>
      Decoration.replace({
        widget: new BlankInputWidget(
          b.seg.varName,
          b.seg.expected,
          props.value,
          props.onValueChange,
          props.submitted,
          props.revealed,
          props.locked,
          props.onEnter,
        ),
        inclusive: false,
      }).range(b.from, b.to),
    );
    const decorationSet = Decoration.set(widgets);
    const decorationField = EditorView.decorations.of(decorationSet);
    const atomicField = EditorView.atomicRanges.of(() => decorationSet);

    const state = EditorState.create({
      doc,
      extensions: [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        go(),
        syntaxHighlighting(syntaxStyle, { fallback: true }),
        decorationField,
        atomicField,
        EditorView.contentAttributes.of({
          "aria-label": "Fill-the-blank Go snippet",
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
          },
          ".cm-scroller": { lineHeight: "1.6" },
          ".cm-content": { padding: "0.75rem" },
          "&.cm-focused": { outline: "none" },
        }),
      ],
    });
    view = new EditorView({ state, parent });
  });

  onCleanup(() => view?.destroy());

  return <div ref={parent} />;
}
