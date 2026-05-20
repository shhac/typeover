import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

/*
 * StatBlock — a single big-number stat (value above, mono uppercase
 * label below). design-docs/17 F-22 extracted this from
 * ModuleCompleteCard's hand-rolled triple-stat presentation. Used
 * anywhere we want to show a counter as a celebration moment.
 *
 * Type ramp: value is `text-3xl font-mono` (parallel to the
 * completion-card scale), label is the same small mono uppercase
 * eyebrow used everywhere else. Two tones: amber (celebratory
 * emphasis) and secondary (de-emphasised stats like the hint count).
 */

type Tone = "amber" | "secondary";

interface StatBlockProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: JSX.Element;
  label: JSX.Element;
  tone?: Tone;
}

const valueClass: Record<Tone, string> = {
  amber: "text-accent-amber",
  secondary: "text-fg-secondary",
};

export function StatBlock(props: ParentProps<StatBlockProps>) {
  const [local, rest] = splitProps(props, ["value", "label", "tone", "class"]);
  return (
    <div {...rest} class={cn("flex flex-col", local.class)}>
      <div class={cn("text-3xl font-mono", valueClass[local.tone ?? "amber"])}>{local.value}</div>
      <div class="text-fg-faint text-xs font-mono uppercase tracking-widest">{local.label}</div>
    </div>
  );
}
