import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

interface KbdProps extends JSX.HTMLAttributes<HTMLElement> {}

export function Kbd(props: ParentProps<KbdProps>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <kbd
      {...rest}
      class={cn(
        "inline-flex items-center px-1.5 py-0.5",
        "border border-border-strong bg-bg-elevated text-fg-primary",
        /* Use bg-inset for the "physical key sits above darker recess"
         * shadow so the colour participates in theme swaps. Hardcoded
         * #000 used to live here; it broke under a light theme. */
        "font-mono text-micro rounded-sm shadow-[0_1px_0_0_var(--color-bg-inset)]",
        local.class,
      )}
    >
      {local.children}
    </kbd>
  );
}
