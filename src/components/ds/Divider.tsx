import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

interface DividerProps extends JSX.HTMLAttributes<HTMLHRElement> {
  tone?: "default" | "strong";
  vertical?: boolean;
}

export function Divider(props: DividerProps) {
  const [local, rest] = splitProps(props, ["tone", "vertical", "class"]);
  const color = local.tone === "strong" ? "border-border-strong" : "border-border-default";
  return local.vertical ? (
    <span
      {...(rest as JSX.HTMLAttributes<HTMLSpanElement>)}
      class={cn("inline-block self-stretch border-l", color, local.class)}
    />
  ) : (
    <hr {...rest} class={cn("border-0 border-t", color, local.class)} />
  );
}
