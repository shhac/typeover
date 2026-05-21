import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

/**
 * Small uppercase tracked-widest caption that introduces a code
 * surface — "Fill the blanks →", "Type the line →",
 * "TypeScript reference". Pulled out of three independent
 * hand-rolls across FillBlankWord, FillBlankLineInput, and
 * ExerciseShell that all used the same
 * `text-micro uppercase tracking-widest text-fg-muted` class
 * string with hand-tuned bottom margins.
 *
 * Distinct from `<Eyebrow>` which carries a hairline marker as
 * its own visual signature; InstructionLine is the bare caption
 * — no decoration, just typographic emphasis.
 *
 * Caller may compose with a child `→` arrow or other adornments;
 * the component just owns the type treatment + bottom margin.
 */

interface InstructionLineProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function InstructionLine(props: ParentProps<InstructionLineProps>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      {...rest}
      class={cn("text-micro uppercase tracking-widest text-fg-muted mb-1.5", local.class)}
    >
      {local.children}
    </div>
  );
}
