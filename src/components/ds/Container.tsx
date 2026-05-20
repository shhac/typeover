import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Width = "narrow" | "default" | "wide" | "full" | "prose";

interface ContainerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  width?: Width;
}

/* design-docs/21 #4 originally tied `width="default"` to
 * `--measure`, but that's too aggressive — every page using
 * "default" (settings, theme overview with its exercise grid,
 * etc.) inherited the style's reading-measure even when the
 * layout wasn't a single prose column. Settings's 2-col grid
 * squashed at textbook's 60ch. Reverted: `default` keeps
 * `max-w-4xl` (today's behaviour) regardless of style, and a
 * new `width="prose"` opts a route INTO the style's measure
 * for genuine reading surfaces (exercise page, privacy). */
const widthClass: Record<Width, string> = {
  narrow: "max-w-2xl",
  default: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
  /* Empty — consumes `--measure` via inline style below. */
  prose: "",
};

export function Container(props: ParentProps<ContainerProps>) {
  const [local, rest] = splitProps(props, ["width", "class", "children"]);
  const width = local.width ?? "default";
  /* Only `width="prose"` yields to `--measure`. Other widths
   * keep their explicit max-width regardless of style. */
  const measureStyle =
    width === "prose" ? ({ "max-width": "var(--measure)" } as const) : undefined;
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
