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

/* Border colors via Tailwind utility (stable per tone). The
 * background colour is set inline so the `--panel-bg-mix` token
 * (design-docs/21 — glass transparency) takes effect; Tailwind's
 * `bg-*` utilities live in @layer utilities and would override
 * any background-color set in the base layer. */
const toneClass: Record<Tone, string> = {
  default: "border-border-default",
  inset: "border-border-default",
  elevated: "border-border-strong",
};

const toneBgVar: Record<Tone, string> = {
  default: "var(--color-bg-panel)",
  inset: "var(--color-bg-inset)",
  elevated: "var(--color-bg-elevated)",
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
  const tone = local.tone ?? "default";
  return (
    <section
      {...rest}
      class={cn("ds-panel border rounded-sm", toneClass[tone], local.class)}
      style={{
        "background-color": `color-mix(in oklab, ${toneBgVar[tone]} var(--panel-bg-mix), transparent)`,
      }}
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
