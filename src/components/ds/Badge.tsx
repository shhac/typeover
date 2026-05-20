import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Variant = "default" | "ts" | "go" | "amber" | "success" | "error";

interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  outline?: boolean;
}

const filledClass: Record<Variant, string> = {
  default: "bg-bg-elevated text-fg-secondary border-border-default",
  ts: "bg-accent-ts/15 text-accent-ts border-accent-ts/40",
  go: "bg-accent-go/15 text-accent-go border-accent-go/40",
  amber: "bg-accent-amber/15 text-accent-amber border-accent-amber/40",
  success: "bg-success/15 text-success border-success/40",
  error: "bg-error/15 text-error border-error/40",
};

const outlineClass: Record<Variant, string> = {
  default: "border-border-default text-fg-secondary",
  ts: "border-accent-ts/60 text-accent-ts",
  go: "border-accent-go/60 text-accent-go",
  amber: "border-accent-amber/60 text-accent-amber",
  success: "border-success/60 text-success",
  error: "border-error/60 text-error",
};

export function Badge(props: ParentProps<BadgeProps>) {
  const [local, rest] = splitProps(props, ["variant", "outline", "class", "children"]);
  const variant = local.variant ?? "default";
  return (
    <span
      {...rest}
      class={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 border rounded-sm",
        "font-mono text-micro uppercase tracking-widest",
        local.outline ? outlineClass[variant] : filledClass[variant],
        local.class,
      )}
    >
      {local.children}
    </span>
  );
}
