import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-accent-amber text-bg-base hover:bg-accent-amber/90 border border-accent-amber",
  secondary:
    "bg-bg-elevated text-fg-primary border border-border-strong hover:border-accent-amber/60 hover:text-accent-amber",
  ghost:
    "bg-transparent text-fg-secondary border border-transparent hover:text-fg-primary hover:border-border-default",
  danger:
    "bg-transparent text-error border border-error/60 hover:bg-error/10",
};

const sizeClass: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-base",
};

export function Button(props: ParentProps<ButtonProps>) {
  const [local, rest] = splitProps(props, [
    "variant",
    "size",
    "class",
    "children",
  ]);
  return (
    <button
      type="button"
      {...rest}
      class={`inline-flex items-center justify-center gap-2 font-mono uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        variantClass[local.variant ?? "secondary"]
      } ${sizeClass[local.size ?? "md"]} ${local.class ?? ""}`}
    >
      {local.children}
    </button>
  );
}
