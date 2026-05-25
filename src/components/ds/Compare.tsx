import type { JSX, ParentProps } from "solid-js";
import { children, For, Show, splitProps } from "solid-js";
import { cn } from "./_internal";

/*
 * Source-to-target translation primitive. Renders the first two
 * children as a stacked mobile pair and a desktop translation lane
 * with an explicit center gutter.
 *
 * Designed for the TS↔target translation moments — the killer move
 * pattern 4 in design-docs/15 picks out. The center gutter makes the
 * relationship read as "this intent becomes this syntax", not merely
 * "two code blocks happened to be adjacent".
 *
 * Why not Adaptive? Adaptive is a layout primitive — it has no
 * semantic about what it's laying out. Compare is a product object:
 * source, arrow lane, target, then optional shared caption.
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
  const resolved = children(() => local.children);
  const items = () => {
    const value = resolved();
    return Array.isArray(value) ? value : [value];
  };
  const first = () => items()[0];
  const second = () => items()[1];
  const extra = () => items().slice(2);

  return (
    <figure {...rest} class={cn("flex flex-col gap-3 m-0", local.class)}>
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] gap-3 lg:gap-0 items-stretch">
        <div class="min-w-0">{first()}</div>
        <div
          class="hidden lg:flex items-center justify-center border-x border-border-default text-fg-faint font-mono text-xs"
          aria-hidden="true"
        >
          →
        </div>
        <div class="min-w-0">{second()}</div>
        <For each={extra()}>
          {(item) => <div class="min-w-0 lg:col-span-3">{item}</div>}
        </For>
      </div>
      <Show when={local.caption}>
        <figcaption class="font-sans text-fg-muted text-sm">{local.caption}</figcaption>
      </Show>
    </figure>
  );
}
