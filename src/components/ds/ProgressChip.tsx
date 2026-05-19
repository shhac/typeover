import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

/*
 * Pure progress chip — small mono "passed/total" label rendered
 * next to a theme name or beneath an exercise card.
 *
 * This is the presentational layer. It carries no localStorage
 * access, no Solid signal subscription, and no aggregation logic.
 * That belongs in `src/components/progress/` islands that hydrate
 * client-side and feed numbers into this primitive.
 *
 * The split is deliberate per design-docs/11's implementation
 * contract — keeping `src/components/ds/` purely presentational
 * means ProgressChip stays trivially testable and a future
 * non-localStorage caller (server-rendered with a known total,
 * e.g. a CONTRIBUTING badge) can use it without touching storage.
 *
 * Two variants:
 *   - kind="theme" → "6/9 passed" — informational headline-of-row.
 *   - kind="exercise" → "seen 3 · passed 2" — per-card metadata.
 *
 * Both render screen-reader-friendly labels via `aria-label` so
 * the `6/9` shorthand isn't read as "six slash nine".
 */

interface BaseProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  /** Pin the chip's resolved width when the caller wants to
   *  reserve space pre-mount and avoid layout shift. Number is
   *  in ch units. */
  minCh?: number;
}

interface ThemeChipProps extends BaseProps {
  kind: "theme";
  passed: number;
  total: number;
}

interface ExerciseChipProps extends BaseProps {
  kind: "exercise";
  seen: number;
  passed: number;
}

type ProgressChipProps = ThemeChipProps | ExerciseChipProps;

export function ProgressChip(props: ProgressChipProps) {
  const [local, rest] = splitProps(props, ["kind", "class", "minCh"]);

  const styleAttr = () => (local.minCh ? { "min-width": `${local.minCh}ch` } : undefined);

  if (local.kind === "theme") {
    const themeProps = props as ThemeChipProps;
    return (
      <span
        {...rest}
        class={cn("font-mono text-xs text-fg-muted", local.class)}
        aria-label={`${themeProps.passed} of ${themeProps.total} exercises passed`}
        style={styleAttr()}
      >
        {themeProps.passed}/{themeProps.total} passed
      </span>
    );
  }

  const exerciseProps = props as ExerciseChipProps;
  return (
    <span
      {...rest}
      class={cn("font-mono text-xs text-fg-faint", local.class)}
      aria-label={`Seen ${exerciseProps.seen} instances, passed ${exerciseProps.passed}`}
      style={styleAttr()}
    >
      seen {exerciseProps.seen} · passed {exerciseProps.passed}
    </span>
  );
}
