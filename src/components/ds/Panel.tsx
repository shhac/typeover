import type { JSX, ParentProps } from "solid-js";
import { splitProps, Show } from "solid-js";
import { cn } from "./_internal";

type Tone = "default" | "inset" | "elevated";
type LangAccent = "amber" | "ts" | "go" | "none";
type Padding = "tight" | "default" | "airy";

interface PanelProps extends JSX.HTMLAttributes<HTMLElement> {
  tone?: Tone;
  /** Optional title strip across the top — used sparingly. */
  label?: string;
  /** Optional language accent for the label strip. */
  accent?: LangAccent;
  /** Padding scale. Airy default; "tight" for dense data. */
  padding?: Padding;
}

const toneClass: Record<Tone, string> = {
  default: "bg-bg-panel border-border-default",
  inset: "bg-bg-inset border-border-default",
  elevated: "bg-bg-elevated border-border-strong",
};

const accentClass: Record<LangAccent, string> = {
  amber: "border-accent-amber/60 text-accent-amber",
  ts: "border-accent-ts/60 text-accent-ts",
  go: "border-accent-go/60 text-accent-go",
  none: "border-border-default text-fg-secondary",
};

const paddingClass: Record<Padding, string> = {
  tight: "p-3",
  default: "p-6",
  airy: "p-8",
};

export function Panel(props: ParentProps<PanelProps>) {
  const [local, rest] = splitProps(props, [
    "tone",
    "label",
    "accent",
    "padding",
    "class",
    "children",
  ]);
  return (
    <section
      {...rest}
      class={cn("ds-panel border rounded-sm", toneClass[local.tone ?? "default"], local.class)}
      aria-label={local.label}
    >
      <Show when={local.label}>
        <header
          class={cn(
            "px-4 py-2 border-b text-micro uppercase tracking-widest font-mono",
            accentClass[local.accent ?? "none"],
          )}
        >
          {local.label}
        </header>
      </Show>
      <div class={paddingClass[local.padding ?? "default"]}>{local.children}</div>
    </section>
  );
}
