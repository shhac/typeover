import { createMemo, createSignal, Show } from "solid-js";
import { ProgressChip } from "~/components/ds";
import { summarizeTheme } from "~/lib/progress";
import { useProgressListener } from "~/lib/use-progress-listener";

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

  useProgressListener(() => setSummary(summarizeTheme(props.exerciseIds)));

  /* Memo gates `<Show>` on the truthy summary; the function-child
   * receives an accessor that re-runs when summary() updates.
   * design-docs/20 lens-5 — the prior IIFE children pattern was
   * non-reactive so the chip never re-rendered after a same-tab
   * write. */
  const visibleSummary = createMemo(() => {
    const s = summary();
    return s !== null && (s.passed > 0 || s.themeComplete) ? s : null;
  });

  return (
    <Show
      when={visibleSummary()}
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
              class="text-accent-primary hover:underline font-mono text-sm focus-ring"
            >
              start exercise 01 →
            </a>
          )}
        </Show>
      }
    >
      {(s) => <ProgressChip kind="theme" passed={s().passed} total={s().total} minCh={10} />}
    </Show>
  );
}
