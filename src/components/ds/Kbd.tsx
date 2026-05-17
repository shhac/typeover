import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";

interface KbdProps extends JSX.HTMLAttributes<HTMLElement> {}

export function Kbd(props: ParentProps<KbdProps>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <kbd
      {...rest}
      class={`inline-flex items-center px-1.5 py-0.5 border border-border-strong bg-bg-elevated text-fg-primary font-mono text-[11px] rounded-sm shadow-[0_1px_0_0_#000] ${
        local.class ?? ""
      }`}
    >
      {local.children}
    </kbd>
  );
}
