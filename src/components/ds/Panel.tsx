import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";

type Tone = "default" | "inset" | "elevated";

interface PanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tone?: PanelTone;
  /** Bloomberg-style title strip across the top. */
  label?: string;
  /** Optional language flag colour for the label strip. */
  accent?: "amber" | "ts" | "go" | "none";
  padded?: boolean;
}

type PanelTone = Tone;

const toneClass: Record<Tone, string> = {
  default: "bg-bg-panel border-border-default",
  inset: "bg-bg-inset border-border-default",
  elevated: "bg-bg-elevated border-border-strong",
};

const accentClass = {
  amber: "border-accent-amber/60 text-accent-amber",
  ts: "border-accent-ts/60 text-accent-ts",
  go: "border-accent-go/60 text-accent-go",
  none: "border-border-default text-fg-secondary",
} as const;

export function Panel(props: ParentProps<PanelProps>) {
  const [local, rest] = splitProps(props, [
    "tone",
    "label",
    "accent",
    "padded",
    "class",
    "children",
  ]);
  const padded = local.padded ?? true;
  return (
    <div
      {...rest}
      class={`border ${toneClass[local.tone ?? "default"]} rounded-sm ${
        local.class ?? ""
      }`}
    >
      {local.label && (
        <div
          class={`px-3 py-1.5 border-b text-[11px] uppercase tracking-widest font-mono ${
            accentClass[local.accent ?? "none"]
          }`}
        >
          {local.label}
        </div>
      )}
      <div class={padded ? "p-4" : ""}>{local.children}</div>
    </div>
  );
}
