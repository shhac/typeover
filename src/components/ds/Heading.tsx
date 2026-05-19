import type { JSX, ParentProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Level = 1 | 2 | 3 | 4;

interface HeadingProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  level?: Level;
  as?: keyof JSX.HTMLElementTags;
  accent?: "amber" | "ts" | "go";
}

const sizeClass: Record<Level, string> = {
  1: "text-4xl font-semibold tracking-tight",
  2: "text-2xl font-semibold tracking-tight",
  3: "text-lg font-semibold",
  4: "text-base font-semibold uppercase tracking-wider text-fg-secondary",
};

const accentClass = {
  amber: "text-accent-amber",
  ts: "text-accent-ts",
  go: "text-accent-go",
} as const;

export function Heading(props: ParentProps<HeadingProps>) {
  const [local, rest] = splitProps(props, ["level", "as", "accent", "class", "children"]);
  const level = local.level ?? 1;
  const tag = local.as ?? (`h${level}` as keyof JSX.HTMLElementTags);
  return (
    <Dynamic
      component={tag}
      {...rest}
      class={cn(
        sizeClass[level],
        local.accent ? accentClass[local.accent] : "text-fg-primary",
        local.class,
      )}
    >
      {local.children}
    </Dynamic>
  );
}
