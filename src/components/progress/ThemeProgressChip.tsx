import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { ProgressChip } from "~/components/ds";
import {
  invalidateProgressCache,
  PROGRESS_CHANGED_EVENT,
  STORAGE_KEY,
  summarizeTheme,
} from "~/lib/progress";

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
 * When no progress exists AND `firstExerciseHref` is provided, the
 * fallback renders a prominent "Start exercise 01 →" link instead of
 * an invisible placeholder — design-docs/16 F-10 (a fresh learner
 * landing on a theme overview saw [exercises] [12 ready] with nothing
 * to anchor where to start). Pre-mount window still renders a
 * width-matched placeholder so the row doesn't visibly grow.
 *
 * Reacts to both cross-tab `storage` events and the same-tab
 * PROGRESS_CHANGED_EVENT so the chip updates when an exercise on
 * the same page is passed — design-docs/19 F-20.
 */

interface ThemeProgressChipProps {
  exerciseIds: string[];
  firstExerciseHref?: string;
}

export function ThemeProgressChip(props: ThemeProgressChipProps) {
  const [summary, setSummary] = createSignal<ReturnType<typeof summarizeTheme> | null>(null);

  const refresh = () => setSummary(summarizeTheme(props.exerciseIds));

  onMount(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        invalidateProgressCache();
        refresh();
      }
    };
    const onSameTab = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(PROGRESS_CHANGED_EVENT, onSameTab);
    onCleanup(() => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROGRESS_CHANGED_EVENT, onSameTab);
    });
  });

  const hasProgress = () => {
    const s = summary();
    return s !== null && (s.passed > 0 || s.themeComplete);
  };

  return (
    <Show
      when={hasProgress()}
      fallback={
        <Show
          when={summary() !== null && props.firstExerciseHref}
          fallback={
            <span class="inline-block" style={{ "min-width": "10ch" }} aria-hidden="true" />
          }
        >
          {(href) => (
            <a
              href={href()}
              class="text-accent-amber hover:underline font-mono text-sm focus-visible:outline-2 focus-visible:outline-accent-amber rounded-sm"
            >
              start exercise 01 →
            </a>
          )}
        </Show>
      }
    >
      {(() => {
        const s = summary();
        if (s === null) return null;
        return <ProgressChip kind="theme" passed={s.passed} total={s.total} minCh={10} />;
      })()}
    </Show>
  );
}
