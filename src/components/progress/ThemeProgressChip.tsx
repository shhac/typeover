import { createSignal, onMount, Show } from "solid-js";
import { ProgressChip } from "~/components/ds";
import { summarizeTheme } from "~/lib/progress";

/*
 * Theme-level progress chip island. Mounts via `client:only` in
 * Astro because progress lives in localStorage; reads the theme's
 * exercise IDs on mount, computes the summary via the shared
 * `summarizeTheme` helper, renders the chip when at least one
 * exercise has been passed (or seen).
 *
 * design-docs/11 calls this out explicitly: "Theme overview:
 * '8 of 9 exercises passed at least once.'"
 *
 * Returns null on the all-zero state so first-time visitors see the
 * page identical to today; layout-shift mitigation is the `min-w`
 * placeholder rendered during the pre-mount window (matches
 * roughly the chip's settled width so the row doesn't visibly grow).
 */

interface ThemeProgressChipProps {
  exerciseIds: string[];
}

export function ThemeProgressChip(props: ThemeProgressChipProps) {
  const [summary, setSummary] = createSignal<ReturnType<typeof summarizeTheme> | null>(null);

  onMount(() => setSummary(summarizeTheme(props.exerciseIds)));

  return (
    <Show
      when={(() => {
        const s = summary();
        return s !== null && (s.passed > 0 || s.themeComplete);
      })()}
      fallback={<span class="inline-block" style={{ "min-width": "10ch" }} aria-hidden="true" />}
    >
      {(() => {
        const s = summary();
        if (s === null) return null;
        return <ProgressChip kind="theme" passed={s.passed} total={s.total} minCh={10} />;
      })()}
    </Show>
  );
}
