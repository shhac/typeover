import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Use uppercase mono label (terminal feel). Default off for airier UI. */
  terminal?: boolean;
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

/* Touch targets ≥ 44px on mobile per Apple HIG. The "sm" size uses 36px
 * which is below that — we only allow it inside dense desktop UI (toolbars,
 * inline filters). Never use "sm" as a primary touch target. */
const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button(props: ParentProps<ButtonProps>) {
  const [local, rest] = splitProps(props, [
    "variant",
    "size",
    "terminal",
    "class",
    "children",
  ]);
  return (
    <button
      type="button"
      {...rest}
      class={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        local.terminal
          ? "font-mono uppercase tracking-wider"
          : "font-sans font-medium",
        variantClass[local.variant ?? "secondary"],
        sizeClass[local.size ?? "md"],
        local.class,
      )}
    >
      {local.children}
    </button>
  );
}
