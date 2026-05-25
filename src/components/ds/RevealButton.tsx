import { createSignal, Show } from "solid-js";
import { Button } from "./Button";
import { CodeBlock } from "./CodeBlock";
import { formatInline } from "~/lib/format-inline";
import type { Accent } from "~/lib/lang";

/* Static per-accent class for inline `code` spans inside the prose
 *  canonical body. JIT can't resolve template-literal classes —
 *  mirrors the equivalent map in McqOption. */
const PROSE_CODE_ACCENT: Record<Accent, string> = {
  primary: "[&>code]:text-accent-primary",
  ts: "[&>code]:text-accent-ts",
  go: "[&>code]:text-accent-go",
  zig: "[&>code]:text-accent-zig",
  rust: "[&>code]:text-accent-rust",
};

interface RevealButtonProps {
  canonical: string;
  lang?: "go" | "ts";
  /** Rendering kind for the canonical body. `"code"` (default) wraps
   *  it in a CodeBlock with syntax highlighting; `"prose"` renders
   *  it as plain text via formatInline (inline `backticks` still
   *  highlighted), for mcq-explain whose canonical is a prose
   *  explanation, not a code snippet. */
  kind?: "code" | "prose";
  /** Accent for inline `code` spans in prose mode. Driven by the
   *  exercise's target language. Ignored in code mode. */
  accent?: Accent;
  /** Called when the learner reveals. */
  onReveal?: () => void;
}

/**
 * RevealButton: persistent "Show answer" toggle. Available before
 * and after submission. Reveals the idiomatic answer for
 * comparison. The internal prop name remains `canonical` (it's the
 * curriculum's term for the reference solution) but the UI string
 * says "answer" — the user-facing word.
 *
 * onReveal fires once per component instance — toggling closed and
 * back open does NOT re-fire. Consumers that record this as
 * progress (ExerciseShell wires it to recordHintUsed per design-
 * docs/19 F-15) get one hint-equivalent per peek session, not one
 * per click.
 */
export function RevealButton(props: RevealButtonProps) {
  const [shown, setShown] = createSignal(false);
  let alreadyReported = false;

  const toggle = () => {
    const next = !shown();
    setShown(next);
    if (next && !alreadyReported) {
      alreadyReported = true;
      props.onReveal?.();
    }
  };

  return (
    <div class="flex flex-col gap-3">
      <Button variant="ghost" size="md" onClick={toggle} aria-expanded={shown()}>
        {shown() ? "Hide answer" : "Show answer"}
      </Button>
      <Show when={shown()}>
        <Show
          when={props.kind === "prose"}
          fallback={
            <CodeBlock lang={props.lang ?? "go"} filename="answer">
              {props.canonical}
            </CodeBlock>
          }
        >
          <div
            class={`px-4 py-3 bg-bg-inset border border-border-default rounded-sm text-sm text-fg-primary leading-relaxed [&>code]:font-mono [&>code]:bg-bg-panel [&>code]:rounded-sm [&>code]:px-1 ${props.accent ? PROSE_CODE_ACCENT[props.accent] : "[&>code]:text-fg-primary"}`}
            innerHTML={formatInline(props.canonical)}
          />
        </Show>
      </Show>
    </div>
  );
}
