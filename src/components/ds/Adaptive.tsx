import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Breakpoint = "md" | "lg" | "xl";

interface AdaptiveProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Breakpoint above which we go side-by-side. Default `lg` (1024px). */
  breakpoint?: Breakpoint;
}

const splitClass: Record<Breakpoint, string> = {
  md: "md:grid-cols-2",
  lg: "lg:grid-cols-2",
  xl: "xl:grid-cols-2",
};

/**
 * Adaptive: stacks children vertically on narrow viewports, lays them
 * out side-by-side above the breakpoint. Encapsulates the breakpoint so
 * pages don't write media queries.
 */
export function Adaptive(props: ParentProps<AdaptiveProps>) {
  const [local, rest] = splitProps(props, [
    "breakpoint",
    "class",
    "children",
  ]);
  return (
    <div
      {...rest}
      class={cn(
        "grid grid-cols-1 gap-6",
        splitClass[local.breakpoint ?? "lg"],
        local.class,
      )}
    >
      {local.children}
    </div>
  );
}
