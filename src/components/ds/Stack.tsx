import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";

type Direction = "row" | "col";
type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify = "start" | "center" | "end" | "between" | "around";

interface StackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  direction?: Direction;
  gap?: Gap;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;
}

/* Airy gap defaults — md is 24px, not 16px. Bloomberg-tight density is
 * the opt-in (via "sm" or "xs"). */
const gapClass: Record<Gap, string> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-3",
  md: "gap-6",
  lg: "gap-10",
  xl: "gap-16",
  "2xl": "gap-24",
};

const alignClass: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyClass: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

export function Stack(props: ParentProps<StackProps>) {
  const [local, rest] = splitProps(props, [
    "direction",
    "gap",
    "align",
    "justify",
    "wrap",
    "class",
    "children",
  ]);
  const dir = local.direction === "row" ? "flex-row" : "flex-col";
  return (
    <div
      {...rest}
      class={`flex ${dir} ${gapClass[local.gap ?? "md"]} ${
        local.align ? alignClass[local.align] : ""
      } ${local.justify ? justifyClass[local.justify] : ""} ${
        local.wrap ? "flex-wrap" : ""
      } ${local.class ?? ""}`}
    >
      {local.children}
    </div>
  );
}
