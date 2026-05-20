import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonShape {
  variant?: Variant;
  size?: Size;
  /** Use uppercase mono label (terminal feel). Default off for airier UI. */
  terminal?: boolean;
}

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement>, ButtonShape {}
interface ButtonLinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement>, ButtonShape {
  /** Required because a button-shaped link is still a navigation. */
  href: string;
}

const variantClass: Record<Variant, string> = {
  primary: "bg-accent-primary text-bg-base hover:bg-accent-primary/90 border border-accent-primary",
  secondary:
    "bg-bg-elevated text-fg-primary border border-border-strong hover:border-accent-primary/60 hover:text-accent-primary",
  ghost:
    "bg-transparent text-fg-secondary border border-transparent hover:text-fg-primary hover:border-border-default",
  danger: "bg-transparent text-error border border-error/60 hover:bg-error/10",
};

/* Touch targets ≥ 44px on mobile per Apple HIG. The "sm" size uses 36px
 * which is below that — we only allow it inside dense desktop UI (toolbars,
 * inline filters). Never use "sm" as a primary touch target. */
const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/* Shared class composition for Button + ButtonLink. The two
 * primitives render different DOM (`<button>` vs `<a>`) but must
 * be visually indistinguishable — the same primary-amber rectangle
 * regardless of whether it's an action or a navigation. Extracted
 * here so the spec lives in exactly one place. */
function buttonClasses(shape: ButtonShape & { class?: string }): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-sm transition-colors",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    shape.terminal ? "font-mono uppercase tracking-wider" : "font-sans font-medium",
    variantClass[shape.variant ?? "secondary"],
    sizeClass[shape.size ?? "md"],
    shape.class,
  );
}

export function Button(props: ParentProps<ButtonProps>) {
  const [local, rest] = splitProps(props, ["variant", "size", "terminal", "class", "children"]);
  return (
    <button
      type="button"
      {...rest}
      class={buttonClasses({
        variant: local.variant,
        size: local.size,
        terminal: local.terminal,
        class: local.class,
      })}
    >
      {local.children}
    </button>
  );
}

/**
 * Anchor styled to match `<Button>`. Use when the action is
 * navigation (Continue to next exercise, Start Foundations) rather
 * than a state mutation. The visual spec is identical to Button —
 * `buttonClasses` shared so the two can never drift.
 *
 * Previously hand-rolled in `ExerciseShell.tsx` and
 * `ModuleCompleteCard.tsx` as 9-class Tailwind strings. Extracted
 * 2026-05-20 per design-docs/17 + 18 review.
 */
export function ButtonLink(props: ParentProps<ButtonLinkProps>) {
  const [local, rest] = splitProps(props, ["variant", "size", "terminal", "class", "children"]);
  return (
    <a
      {...rest}
      class={buttonClasses({
        variant: local.variant,
        size: local.size,
        terminal: local.terminal,
        class: local.class,
      })}
    >
      {local.children}
    </a>
  );
}
