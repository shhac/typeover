import type { JSX, ParentProps } from "solid-js";
import { Show, splitProps } from "solid-js";
import { cn } from "./_internal";

/*
 * Source-to-target translation primitive. Renders slotted children
 * directly into a stacked mobile / side-by-side desktop grid.
 *
 * Designed for TS↔target translation moments: source and target code
 * panes belong to one figure with a single shared caption.
 *
 * Why not per-child wrappers? Astro passes Solid children as a slot;
 * wrapping "first" and "second" in Solid can collapse both panes into
 * the first column. Direct slot rendering lets the browser grid place
 * the actual slotted code-block elements.
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
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">{local.children}</div>
      <Show when={local.caption}>
        <figcaption class="font-sans text-fg-muted text-sm">{local.caption}</figcaption>
      </Show>
    </figure>
  );
}
