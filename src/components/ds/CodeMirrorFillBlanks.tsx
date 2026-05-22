import { For, onCleanup, onMount, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { go } from "@codemirror/lang-go";
import { zigLanguage } from "@ndim/codemirror-lang-zig";
import { isCodeMirrorTestEnv } from "~/lib/codemirror-test-env";
import { codemirrorThemeExtensions } from "~/lib/codemirror-theme";
import type { FillSegment } from "~/lib/generator-runtime";
import { LANG_DISPLAY } from "~/lib/lang";

/*
 * Fill-blanks surface — a read-only CodeMirror editor whose blanks
 * are REPLACED visually by interactive widgets the caller supplies.
 * Powers BOTH fill-line (one blank, single signal) AND fill-word
 * (N blanks, indexed state). Surrounding text is syntax-highlighted
 * by the Go Lezer parser; each blank widget hosts a Solid sub-tree
 * mounted via `solid-js/web`'s standalone `render()`, so the
 * embedded inputs remain real DOM elements (a11y, IME, MobileKeyBar
 * insertAtFocused all unchanged).
 *
 * design-docs/16 F-19 follow-up — the freeform editor surface is
 * CodeMirror; this brings the fill-* surfaces to parity.
 *
 * Architecture:
 *   - The CodeMirror doc text is built by joining the segments and
 *     substituting each blank with its EXPECTED value. Keeps the doc
 *     syntactically valid Go so tokens around the blanks highlight
 *     correctly even when the learner-typed value differs.
 *   - For each blank, a `Decoration.replace` over the blank range is
 *     paired with a `BlankWidget` that mounts whatever JSX the caller
 *     provides via `renderBlank(slotIdx, varName, expected)`.
 *   - `atomicRanges` + `ignoreEvent: true` makes the widgets opaque
 *     from CM's perspective — cursor / selection / typing inside the
 *     widget's input doesn't perturb the doc.
 *
 * Test-mode fallback: when `data-codemirror-test` is on <html>
 * (vitest), the component degrades to the legacy span-per-segment
 * tree using the same `renderBlank` callback, so existing tests
 * (which dispatch on BlankInput input elements) keep working
 * without CodeMirror-internal probing.
 */

/** Language slug that selects the CodeMirror grammar used for
 *  syntax-highlighting the surrounding scaffold. Maps onto the
 *  exercise's `target` field; defaults to "go" for back-compat
 *  with the original Go-only call sites. */
export type FillBlanksLanguage = "go" | "zig";

interface CodeMirrorFillBlanksProps {
  segments: readonly FillSegment[];
  /** Renders the widget body for the blank at `slotIdx`. The caller
   *  produces whatever shape they need (typically `<BlankInput>`
   *  with state-driven props). The widget mounts the JSX once per
   *  blank; reactivity inside flows through Solid signals the caller
   *  closes over. */
  renderBlank: (slotIdx: number, varName: string, expected: string) => JSX.Element;
  /** Optional aria-label override on the editor contentDOM. */
  ariaLabel?: string;
  /** Which Lezer grammar to load for syntax highlighting. Defaults to
   *  `"go"` so existing Go fill-line / fill-word call sites don't
   *  need to change. */
  language?: FillBlanksLanguage;
}

const LANGUAGE_EXTENSION: Record<FillBlanksLanguage, () => Extension> = {
  go: () => go(),
  zig: () => zigLanguage,
};

/* `LANG_DISPLAY` is keyed by Target (`"go" | "zig"`) which matches
 * `FillBlanksLanguage` exactly today — schema-validated. If the
 * schema's target enum and this component's language enum ever
 * diverge, the assignment surfaces a TS error here. */
const LANGUAGE_LABEL: Record<FillBlanksLanguage, string> = LANG_DISPLAY;

/* The widget owns its mount lifecycle: toDOM creates a host span,
 * mounts the caller-supplied JSX via Solid's standalone render, and
 * disposes on destroy. CM treats the widget as atomic so cursor /
 * selection ops skip over it. */
class BlankWidget extends WidgetType {
  private disposers: Array<() => void> = [];

  constructor(
    private readonly slotIdx: number,
    private readonly varName: string,
    private readonly expected: string,
    private readonly renderBlank: (
      slotIdx: number,
      varName: string,
      expected: string,
    ) => JSX.Element,
  ) {
    super();
  }

  /* Identity for CM's diffing — two widgets are equal if they
   * reference the same blank slot. Prevents rebuild churn on
   * unrelated state changes (which would lose focus + in-progress
   * input value). */
  eq(other: BlankWidget): boolean {
    return (
      other instanceof BlankWidget &&
      other.slotIdx === this.slotIdx &&
      other.varName === this.varName &&
      other.expected === this.expected
    );
  }

  toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "inline-block align-baseline";
    const dispose = render(() => this.renderBlank(this.slotIdx, this.varName, this.expected), host);
    this.disposers.push(dispose);
    return host;
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/* Build the static doc text by substituting each blank's expected
 * value into the text run. Returns both the assembled doc and the
 * (from, to, slotIdx) of each blank so the decoration plugin can
 * position widgets. `slotIdx` is the segment index in the original
 * segments array — matches the existing fill-word convention so
 * the same blank var appearing twice produces two independent
 * widgets (e.g. `${x} == ${x}`). */
interface BlankPosition {
  from: number;
  to: number;
  slotIdx: number;
  varName: string;
  expected: string;
}

function buildDocAndRanges(segments: readonly FillSegment[]): {
  doc: string;
  blankRanges: BlankPosition[];
} {
  let doc = "";
  const blankRanges: BlankPosition[] = [];
  segments.forEach((seg, slotIdx) => {
    if (seg.kind === "text") {
      doc += seg.text;
    } else {
      const from = doc.length;
      doc += seg.expected;
      blankRanges.push({
        from,
        to: doc.length,
        slotIdx,
        varName: seg.varName,
        expected: seg.expected,
      });
    }
  });
  return { doc, blankRanges };
}

/* Legacy span-tree fallback for the test environment. Mirrors the
 * pre-CodeMirror DOM shape so the existing fill-line + fill-word
 * tests (which query for BlankInput elements) keep finding them. */
function LegacyFallback(props: CodeMirrorFillBlanksProps): JSX.Element {
  return (
    <div class="font-mono text-code bg-bg-inset p-3 rounded-sm border border-border-default">
      <For each={props.segments}>
        {(seg, idx) => {
          if (seg.kind === "text") return <span>{seg.text}</span>;
          return (
            <span class="inline-block align-baseline">
              {props.renderBlank(idx(), seg.varName, seg.expected)}
            </span>
          );
        }}
      </For>
    </div>
  );
}

export function CodeMirrorFillBlanks(props: CodeMirrorFillBlanksProps): JSX.Element {
  if (isCodeMirrorTestEnv()) return LegacyFallback(props);

  /* oxlint-disable-next-line no-unassigned-vars — Solid ref binding. */
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
        widget: new BlankWidget(b.slotIdx, b.varName, b.expected, props.renderBlank),
        inclusive: false,
      }).range(b.from, b.to),
    );
    const decorationSet = Decoration.set(widgets);
    const decorationField = EditorView.decorations.of(decorationSet);
    const atomicField = EditorView.atomicRanges.of(() => decorationSet);

    const lang = props.language ?? "go";
    const state = EditorState.create({
      doc,
      extensions: [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        LANGUAGE_EXTENSION[lang](),
        decorationField,
        atomicField,
        EditorView.contentAttributes.of({
          "aria-label": props.ariaLabel ?? `Fill-the-blanks ${LANGUAGE_LABEL[lang]} snippet`,
          spellcheck: "false",
        }),
        ...codemirrorThemeExtensions({
          minHeight: "auto",
          contentPadding: "0.75rem",
          surfaceFocusOutline: false,
          caret: false,
        }),
      ],
    });
    view = new EditorView({ state, parent });
  });

  onCleanup(() => view?.destroy());

  return <div ref={parent} />;
}
