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
 * blue, a Go section cyan, etc.
 *
 * Visual differentiation from outlined Badge — design-docs/17 F-5.
 * Both primitives were `font-mono uppercase tracking-widest`; at a
 * glance an `<Eyebrow tone="amber">` read as an outlined amber
 * Badge. Eyebrow now leads with a short hairline glyph (`──`) that
 * marks it as a SECTION CAPTION rather than a chip. Badge stays
 * bordered. The split is structural: Eyebrow introduces what
 * follows, Badge tags what's already there.
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
        "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest",
        toneClass[local.tone ?? "default"],
        local.class,
      )}
    >
      {/* Hairline marker that separates an Eyebrow caption from an
       * outlined Badge chip at a glance. Decorative — aria-hidden
       * so screen readers don't announce a dash. */}
      <span aria-hidden="true" class="inline-block w-3 h-px bg-current opacity-50" />
      {local.children}
    </span>
  );
}
