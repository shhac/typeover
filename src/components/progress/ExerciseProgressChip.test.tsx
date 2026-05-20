import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExerciseProgressChip } from "./ExerciseProgressChip";
import {
  __resetProgressCacheForTests,
  PROGRESS_CHANGED_EVENT,
  recordInstancePassed,
  recordInstanceSeen,
  STORAGE_KEY,
} from "~/lib/progress";

/*
 * Tests for the per-exercise progress chip island. Covers what was
 * un-tested when the cross-tab `storage` event + same-tab
 * `PROGRESS_CHANGED_EVENT` listeners landed (design-docs/19 F-20):
 *
 *   - placeholder render on a fresh slot (no progress)
 *   - re-render after a `recordInstancePassed` write in the same tab
 *     (custom-event path)
 *   - re-render after a synthetic cross-tab `storage` event with
 *     `key === STORAGE_KEY`
 *   - re-render after `localStorage.clear()` (storage event with
 *     `key === null`)
 *   - ignored when the storage event is for an unrelated key
 *   - listeners removed on unmount (no error on subsequent dispatch)
 */

const EX = "test/chip-ex";

beforeEach(() => {
  localStorage.clear();
  __resetProgressCacheForTests();
});

afterEach(() => {
  localStorage.clear();
  __resetProgressCacheForTests();
});

describe("<ExerciseProgressChip>", () => {
  it("renders an aria-hidden placeholder on a fresh slot", () => {
    const { container } = render(() => <ExerciseProgressChip exerciseId={EX} />);
    const placeholder = container.querySelector('[aria-hidden="true"]');
    expect(placeholder).not.toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders the chip once at least one instance is seen", () => {
    recordInstanceSeen(EX);
    const { container } = render(() => <ExerciseProgressChip exerciseId={EX} />);
    expect(container.textContent).toMatch(/seen 1/);
  });

  it("re-renders on the same-tab PROGRESS_CHANGED_EVENT after a write", () => {
    /* Same-tab path: the writer dispatches the event; the chip
     * picks up the new value without a page reload. The recorder
     * itself fires the event from write() — exercise that integration. */
    const { container } = render(() => <ExerciseProgressChip exerciseId={EX} />);
    expect(container.textContent).toBe("");
    recordInstanceSeen(EX);
    recordInstancePassed(EX);
    expect(container.textContent).toMatch(/seen 1 · passed 1/);
  });

  it("re-renders on a cross-tab storage event for STORAGE_KEY", () => {
    /* Another tab wrote. The chip must invalidate its cache (else
     * stale snapshot) and re-read. Simulate via a synthetic
     * StorageEvent on window. */
    const { container } = render(() => <ExerciseProgressChip exerciseId={EX} />);
    /* Stage the new state directly in localStorage, bypassing the
     * write() helper (which would also fire the same-tab event). */
    const blob = {
      version: 1,
      startedAt: "2026-05-20T00:00:00.000Z",
      lastSeenAt: "2026-05-20T00:00:00.000Z",
      exercises: {
        [EX]: {
          firstSeenAt: "2026-05-20T00:00:00.000Z",
          lastSeenAt: "2026-05-20T00:00:00.000Z",
          instancesSeen: 4,
          instancesPassed: 3,
          instancesFailed: 1,
          hintsUsedTotal: 0,
        },
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(container.textContent).toMatch(/seen 4 · passed 3/);
  });

  it("re-renders on a localStorage.clear() storage event (key === null)", () => {
    /* `localStorage.clear()` fires a storage event with `key: null`.
     * The chip's filter accepts that as a "the whole store changed,
     * invalidate and re-read" signal. Drop this branch in a refactor
     * and cross-tab clears stop syncing silently. */
    recordInstanceSeen(EX);
    const { container } = render(() => <ExerciseProgressChip exerciseId={EX} />);
    expect(container.textContent).toMatch(/seen 1/);
    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(container.textContent).toBe("");
  });

  it("ignores storage events for unrelated keys", () => {
    recordInstanceSeen(EX);
    const { container } = render(() => <ExerciseProgressChip exerciseId={EX} />);
    expect(container.textContent).toMatch(/seen 1/);
    /* Some unrelated localStorage key changes — the chip must not
     * re-read or flicker. */
    window.dispatchEvent(new StorageEvent("storage", { key: "typeover:theme" }));
    expect(container.textContent).toMatch(/seen 1/);
  });

  it("removes its listeners on unmount", () => {
    /* If onCleanup forgets to remove the handlers, a unmounted-but-
     * leaked chip would still react to events. A subsequent
     * dispatch should be a no-op (no error, no console noise). */
    const { unmount } = render(() => <ExerciseProgressChip exerciseId={EX} />);
    unmount();
    expect(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT));
    }).not.toThrow();
  });
});
