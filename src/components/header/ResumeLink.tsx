import { createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  invalidateProgressCache,
  lastTouchedExerciseId,
  PROGRESS_CHANGED_EVENT,
  STORAGE_KEY,
} from "~/lib/progress";

/*
 * Header chrome island: "resume — <theme-slug> · ex N" link that
 * jumps the learner back to the most-recently-touched exercise.
 * design-docs/16 F-1.
 *
 * Renders nothing until mount (SSR can't read localStorage), then
 * nothing if the learner has no progress yet. The hidden state is
 * the common case for first-time visitors and gracefully avoids
 * cluttering the header.
 *
 * Display label is derived from the exerciseId path
 * (`<module>/<theme>/<slot>`), no theme-title lookup needed —
 * keeps the island self-contained without baking a 288-entry
 * curriculum manifest into every page.
 *
 * Subscribes to both the cross-tab `storage` event and the
 * same-tab PROGRESS_CHANGED_EVENT so the label refreshes the moment
 * a Submit / Reveal lands on the current page.
 */

interface ResumeFragment {
  href: string;
  themeSlug: string;
  slotLabel: string;
}

function describe(exerciseId: string): ResumeFragment | null {
  /* IDs are `<module>/<theme>/<NN>`. Defensive: anything off-shape
   * (no slashes, fewer than three segments, non-numeric slot) is
   * skipped — the header stays quiet rather than showing a broken
   * label. */
  const parts = exerciseId.split("/");
  if (parts.length !== 3) return null;
  const [, theme, slot] = parts;
  if (!theme || !slot) return null;
  const slotNum = Number(slot);
  if (!Number.isInteger(slotNum) || slotNum < 1) return null;
  return {
    href: `/go/${exerciseId}`,
    themeSlug: theme,
    slotLabel: `ex ${slotNum}`,
  };
}

export function ResumeLink() {
  const [fragment, setFragment] = createSignal<ResumeFragment | null>(null);

  const refresh = () => {
    const id = lastTouchedExerciseId();
    setFragment(id ? describe(id) : null);
  };

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

  /* Truncate the slug to keep the chrome compact on mid-width
   * screens. Mobile (< sm) drops the entire link to give the brand
   * + arrows + curriculum-link three children room on a single
   * row; sm+ shows the truncated label; lg+ shows it untruncated. */
  return (
    <Show when={fragment()}>
      {(f) => (
        <a
          href={f().href}
          class="hidden sm:inline-block text-fg-muted hover:text-fg-secondary transition-colors focus-ring truncate max-w-[200px] lg:max-w-none"
          aria-label={`Resume ${f().themeSlug} ${f().slotLabel}`}
          title={`Resume ${f().themeSlug} ${f().slotLabel}`}
        >
          resume — {f().themeSlug} · {f().slotLabel}
        </a>
      )}
    </Show>
  );
}
