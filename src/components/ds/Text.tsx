import type { JSX, ParentProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Tone = "primary" | "secondary" | "muted" | "faint";
type Size = "xs" | "sm" | "md" | "lg";
type Family = "sans" | "mono";

interface TextProps extends JSX.HTMLAttributes<HTMLElement> {
  tone?: Tone;
  size?: Size;
  family?: Family;
  as?: "p" | "span" | "div";
}

const toneClass: Record<Tone, string> = {
  primary: "text-fg-primary",
  secondary: "text-fg-secondary",
  muted: "text-fg-muted",
  faint: "text-fg-faint",
};

const sizeClass: Record<Size, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Text(props: ParentProps<TextProps>) {
  const [local, rest] = splitProps(props, [
    "tone",
    "size",
    "family",
    "as",
    "class",
    "children",
  ]);
  return (
    <Dynamic
      component={local.as ?? "p"}
      {...rest}
      class={cn(
        toneClass[local.tone ?? "primary"],
        sizeClass[local.size ?? "md"],
        local.family === "mono" ? "font-mono" : "font-sans",
        local.class,
      )}
    >
      {local.children}
    </Dynamic>
  );
}
