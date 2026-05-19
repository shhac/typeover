import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

/*
 * Small mono uppercase label that introduces a section without
 * shouting. Replaces the wiki-shaped `<Heading level={4}>...</Heading>`
 * block label per design-docs/15 pattern 1.
 *
 * Used as the structural cue when a section heading would be
 * scaffolding for the *author* rather than information for the
 * *reader*. The reader infers structure from rhythm — a small
 * tracked-out mono caption is enough.
 *
 * Tone follows the colour theme accents so a TS section can lean
 * blue, a Go section cyan, etc. — same identity as Badge but without
 * the pill chrome.
 */

type Tone = "default" | "muted" | "amber" | "ts" | "go";

interface EyebrowProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClass: Record<Tone, string> = {
  default: "text-fg-secondary",
  muted: "text-fg-muted",
  amber: "text-accent-amber",
  ts: "text-accent-ts",
  go: "text-accent-go",
};

export function Eyebrow(props: ParentProps<EyebrowProps>) {
  const [local, rest] = splitProps(props, ["tone", "class", "children"]);
  return (
    <span
      {...rest}
      class={cn(
        "font-mono text-xs uppercase tracking-widest",
        toneClass[local.tone ?? "default"],
        local.class,
      )}
    >
      {local.children}
    </span>
  );
}
