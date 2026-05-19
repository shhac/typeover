import type { JSX, ParentProps } from "solid-js";
import { Show, splitProps } from "solid-js";
import { Adaptive } from "./Adaptive";
import { cn } from "./_internal";

/*
 * Side-by-side comparison primitive. Wraps Adaptive (which handles
 * the stack-on-narrow / split-on-wide layout) with an optional
 * `caption` slot rendered as a single shared `<figcaption>` beneath.
 *
 * Designed for the TS↔Go translation moments — the killer move
 * pattern 4 in design-docs/15 picks out. Replaces hand-rolled
 * two-column grids of <CodeBlock> + a separate <Text> caption that
 * doesn't visually tie to either column.
 *
 * Why not extend Adaptive? Adaptive is a layout primitive — it has
 * no semantic about what it's laying out. Compare is the magazine
 * shape: <figure> + figcaption + a thin divider between columns at
 * desktop widths so the comparison feels intentional, not "two
 * things next to each other".
 *
 * Children are expected to be two elements (typically <CodeBlock>).
 * Three or more children still render correctly via the underlying
 * grid; the divider between is a 2-column-specific affordance.
 */

interface CompareProps extends JSX.HTMLAttributes<HTMLElement> {
  /** Caption rendered beneath the columns. Optional. */
  caption?: JSX.Element;
}

export function Compare(props: ParentProps<CompareProps>) {
  const [local, rest] = splitProps(props, ["caption", "class", "children"]);
  return (
    <figure {...rest} class={cn("flex flex-col gap-3 m-0", local.class)}>
      <Adaptive>{local.children}</Adaptive>
      <Show when={local.caption}>
        <figcaption class="font-sans text-fg-muted text-sm">{local.caption}</figcaption>
      </Show>
    </figure>
  );
}
