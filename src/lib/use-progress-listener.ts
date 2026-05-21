import { onCleanup, onMount } from "solid-js";
import {
  invalidateProgressCache,
  PROGRESS_CHANGED_EVENT,
  STORAGE_KEY,
} from "./progress";

/**
 * Subscribe a `refresh` callback to BOTH cross-tab `storage`
 * events AND the same-tab `PROGRESS_CHANGED_EVENT`. On either
 * signal, the module-level progress cache is invalidated and
 * `refresh()` fires.
 *
 * The pair-subscription is necessary because the cross-tab
 * `storage` event doesn't fire in the writing tab (design-docs/19
 * F-20 — the recorder dispatches `PROGRESS_CHANGED_EVENT` to bridge
 * the gap). Forgetting either listener means a chip on the same
 * page as an active exercise stops updating after a Submit; the
 * pair was previously hand-copied across `ExerciseProgressChip`,
 * `ThemeProgressChip`, and `ResumeLink`.
 *
 * Caller passes a stable `refresh` function. The hook fires it
 * once on mount (so the component picks up whatever's in storage
 * already), then on every storage / same-tab event until the
 * component unmounts.
 */
export function useProgressListener(refresh: () => void): void {
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
}
