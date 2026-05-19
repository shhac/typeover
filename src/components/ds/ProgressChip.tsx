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

interface BaseProps {
  /** Optional extra class — most callers use the default. */
  class?: string;
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

/**
 * Pure presentational chip — accepts ONLY the props it needs.
 * Earlier shape extended `JSX.HTMLAttributes<HTMLSpanElement>` and
 * spread `rest` onto the underlying `<span>`; that leaked data
 * fields like `passed`, `total`, `seen` as DOM attributes because
 * Solid forwards unknown props verbatim. No real caller passes
 * arbitrary HTML attrs through here, so the surface stays narrow.
 */
export function ProgressChip(props: ProgressChipProps) {
  const styleAttr = () => (props.minCh ? { "min-width": `${props.minCh}ch` } : undefined);

  if (props.kind === "theme") {
    return (
      <span
        class={cn("font-mono text-xs text-fg-muted", props.class)}
        aria-label={`${props.passed} of ${props.total} exercises passed`}
        style={styleAttr()}
      >
        {props.passed}/{props.total} passed
      </span>
    );
  }

  return (
    <span
      class={cn("font-mono text-xs text-fg-faint", props.class)}
      aria-label={`Seen ${props.seen} instances, passed ${props.passed}`}
      style={styleAttr()}
    >
      seen {props.seen} · passed {props.passed}
    </span>
  );
}
