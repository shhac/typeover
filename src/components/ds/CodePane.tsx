import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

/**
 * Read-only code-output container. The DS primitive consolidating
 * the `bg-bg-inset rounded-sm border ... p-3 font-mono text-sm
 * whitespace-pre-wrap` shape that RunResultPanel and DiffView both
 * hand-rolled (per the structural review's DS-boundary lens).
 *
 * Distinct from `<CodeBlock>` — CodeBlock owns the
 * filename/language-label header and is for static authored
 * snippets; CodePane is for runtime output panes (stdout, stderr,
 * diff visualisation) where the surrounding chrome is omitted.
 * Distinct from `<CodeMirrorEditor readOnly>` — that one ships
 * full Lezer syntax tokenisation for Go/TS source; CodePane is
 * for plain text output where syntax-highlighting doesn't apply.
 *
 * Tone variants:
 *   - `neutral`  default border, plain text. The "what we wanted"
 *                pane, the DiffView container.
 *   - `success`  green border. The "what you got" pane when stdout
 *                matches expected.
 *   - `error`    red border. The "what you got" pane on mismatch,
 *                the stderr pane.
 *   - `errorEmphatic`  red border AND red bg-tint AND red text.
 *                The "error" pane for runtime panics that need to
 *                read as alarming, not just bordered.
 *
 * Tag variants:
 *   - `as="pre"`  default. Output text in its own block.
 *   - `as="div"`  for callers that mount multiple spans inside
 *                 (DiffView's For-loop over change parts).
 */

type CodePaneTone = "neutral" | "success" | "error" | "errorEmphatic";

const toneClass: Record<CodePaneTone, string> = {
  neutral: "bg-bg-inset border-border-default/60",
  success: "bg-bg-inset border-success/40",
  error: "bg-bg-inset border-error/40",
  errorEmphatic: "bg-error/5 border-error/40 text-error",
};

interface CodePaneProps extends JSX.HTMLAttributes<HTMLElement> {
  tone?: CodePaneTone;
  /** Render as `<pre>` (default) or `<div>`. `<pre>` preserves
   *  whitespace naturally; `<div>` is for consumers that compose
   *  their own inline children. Both surfaces ship
   *  `whitespace-pre-wrap` so explicit `\n` in the content renders
   *  as a line break. */
  as?: "pre" | "div";
  /** When true, drops the default leading-relaxed line height
   *  for tighter packing. Used by the stdout panes where output is
   *  one or two lines. */
  tight?: boolean;
}

export function CodePane(props: ParentProps<CodePaneProps>) {
  const [local, rest] = splitProps(props, ["tone", "as", "tight", "class", "children"]);
  const className = () =>
    cn(
      "rounded-sm border p-3 font-mono text-sm whitespace-pre-wrap",
      local.tight ? "" : "leading-relaxed",
      toneClass[local.tone ?? "neutral"],
      local.class,
    );
  /* Render either <pre> or <div>. JSX duplication is the cost of
   * keeping the two tag spreads cleanly typed — Solid's createElement
   * accepts a string tag but TS' JSX typing prefers a literal. */
  if (local.as === "div") {
    return (
      <div {...(rest as JSX.HTMLAttributes<HTMLDivElement>)} class={className()}>
        {local.children}
      </div>
    );
  }
  return (
    <pre {...(rest as JSX.HTMLAttributes<HTMLPreElement>)} class={className()}>
      {local.children}
    </pre>
  );
}
