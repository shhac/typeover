import type { JSX, ParentProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Level = 1 | 2 | 3 | 4;
type Size = "xl" | "2xl" | "3xl" | "4xl" | "lg" | "base";

interface HeadingProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  /** Semantic level (h1–h4). Drives the rendered tag. */
  level?: Level;
  /** Override the visual size while keeping the semantic level.
   *  Defaults to the level's natural size. Use when the document
   *  hierarchy demands an h2 but the visual layout calls for an h3,
   *  or vice versa.
   *
   *  Adding this prop closed the design-docs/17 F-3 +
   *  design-docs/18 F-15 finding that pages were overriding
   *  Heading sizes with `!text-*` Tailwind important-prefixes —
   *  the DS-bypass pattern. */
  size?: Size;
  as?: keyof JSX.HTMLElementTags;
  accent?: "amber" | "ts" | "go";
}

/* Size = font-size + tracking only. Weight comes from the heading-
 * weight system in global.css: `.ds-heading-font.ds-heading-h{N}`
 * reads `calc(--heading-weight-base × --heading-scale-hN)`. Each
 * style rebinds the base; per-level scalars stay constant.
 * design-docs/21 #3. */
const sizeClass: Record<Size, string> = {
  base: "text-base uppercase tracking-wider text-fg-secondary",
  lg: "text-lg",
  xl: "text-xl tracking-tight",
  "2xl": "text-2xl tracking-tight",
  "3xl": "text-3xl tracking-tight",
  "4xl": "text-4xl tracking-tight",
};

/** Default visual size per semantic level — used when the caller
 *  doesn't pass an explicit `size`. */
const defaultSize: Record<Level, Size> = {
  1: "4xl",
  2: "2xl",
  3: "lg",
  4: "base",
};

const accentClass = {
  amber: "text-accent-amber",
  ts: "text-accent-ts",
  go: "text-accent-go",
} as const;

export function Heading(props: ParentProps<HeadingProps>) {
  const [local, rest] = splitProps(props, ["level", "size", "as", "accent", "class", "children"]);
  const level = local.level ?? 1;
  const tag = local.as ?? (`h${level}` as keyof JSX.HTMLElementTags);
  const size = local.size ?? defaultSize[level];
  return (
    <Dynamic
      component={tag}
      {...rest}
      class={cn(
        "ds-heading-font",
        `ds-heading-h${level}`,
        sizeClass[size],
        local.accent ? accentClass[local.accent] : "text-fg-primary",
        local.class,
      )}
    >
      {local.children}
    </Dynamic>
  );
}
