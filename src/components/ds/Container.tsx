import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Width = "narrow" | "default" | "wide" | "full";

interface ContainerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  width?: Width;
}

const widthClass: Record<Width, string> = {
  narrow: "max-w-2xl",
  /* `default` consumes the `--measure` token via inline style so
   * a style that narrows the reading column (textbook 60ch) or
   * widens it (glass 80ch) wins. The token's @theme default is
   * `56rem` which matches `max-w-4xl`, so untouched styles get
   * today's width. design-docs/21 #4. */
  default: "",
  wide: "max-w-6xl",
  full: "max-w-none",
};

export function Container(props: ParentProps<ContainerProps>) {
  const [local, rest] = splitProps(props, ["width", "class", "children"]);
  const width = local.width ?? "default";
  /* Only `width="default"` yields to `--measure`; narrow / wide /
   * full keep their explicit max-width regardless of style. */
  const measureStyle =
    width === "default" ? ({ "max-width": "var(--measure)" } as const) : undefined;
  return (
    <div
      {...rest}
      class={cn("mx-auto px-6 sm:px-8 w-full", widthClass[width], local.class)}
      style={measureStyle}
    >
      {local.children}
    </div>
  );
}
