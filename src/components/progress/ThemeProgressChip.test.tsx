import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProgressChip } from "./ThemeProgressChip";
import { __resetProgressCacheForTests, recordInstancePassed, STORAGE_KEY } from "~/lib/progress";

/*
 * Tests for the theme-level progress chip island. Pins the same
 * cross-tab + same-tab event behaviour as ExerciseProgressChip plus
 * the theme-specific fallback contract: when no exercise in the
 * theme has been passed AND `firstExerciseHref` is supplied, the
 * fallback renders a "start exercise 01 →" anchor instead of the
 * invisible placeholder (design-docs/16 F-10).
 */

const THEME_EXERCISES = ["foundations/variables/01", "foundations/variables/02"];
const FIRST_HREF = "/go/foundations/variables/01";

beforeEach(() => {
  localStorage.clear();
  __resetProgressCacheForTests();
});

afterEach(() => {
  localStorage.clear();
  __resetProgressCacheForTests();
});

describe("<ThemeProgressChip>", () => {
  it("renders an invisible placeholder when no progress AND no firstExerciseHref", () => {
    const { container } = render(() => <ThemeProgressChip exerciseIds={THEME_EXERCISES} />);
    expect(container.textContent).toBe("");
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders the 'start exercise 01' anchor when no progress AND firstExerciseHref is supplied", () => {
    /* design-docs/16 F-10. A fresh learner on a theme overview saw
     * [exercises] [12 ready] with nothing prominent to start with.
     * The fallback now surfaces a CTA, gated on the prop. */
    const { container, getByText } = render(() => (
      <ThemeProgressChip exerciseIds={THEME_EXERCISES} firstExerciseHref={FIRST_HREF} />
    ));
    const anchor = getByText(/start exercise 01/) as HTMLAnchorElement;
    expect(anchor).toBeTruthy();
    expect(anchor.getAttribute("href")).toBe(FIRST_HREF);
    /* And no invisible placeholder — the anchor IS the visible
     * element occupying the slot. */
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("re-renders the chip on the same-tab PROGRESS_CHANGED_EVENT", () => {
    /* design-docs/19 F-20 + design-docs/20 lens-5. The same-tab
     * write path used to be silently skipped by an IIFE children
     * pattern that wasn't reactive. */
    const { container, queryByText } = render(() => (
      <ThemeProgressChip exerciseIds={THEME_EXERCISES} firstExerciseHref={FIRST_HREF} />
    ));
    /* Initially the start-CTA fallback is visible. */
    expect(queryByText(/start exercise 01/)).toBeTruthy();
    recordInstancePassed(THEME_EXERCISES[0]!);
    /* After the same-tab write the chip flips from CTA to the
     * "1 of 2" progress chip. */
    expect(container.textContent).toMatch(/1.*2/);
    expect(queryByText(/start exercise 01/)).toBeNull();
  });

  it("re-renders on a cross-tab storage event with key === STORAGE_KEY", () => {
    const blob = {
      version: 1,
      startedAt: "2026-05-20T00:00:00.000Z",
      lastSeenAt: "2026-05-20T00:00:00.000Z",
      exercises: {
        [THEME_EXERCISES[0]!]: {
          firstSeenAt: "2026-05-20T00:00:00.000Z",
          lastSeenAt: "2026-05-20T00:00:00.000Z",
          instancesSeen: 1,
          instancesPassed: 1,
          instancesFailed: 0,
          hintsUsedTotal: 0,
        },
      },
    };
    const { container } = render(() => (
      <ThemeProgressChip exerciseIds={THEME_EXERCISES} firstExerciseHref={FIRST_HREF} />
    ));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(container.textContent).toMatch(/1.*2/);
  });

  it("ignores storage events for unrelated keys", () => {
    recordInstancePassed(THEME_EXERCISES[0]!);
    const { container } = render(() => (
      <ThemeProgressChip exerciseIds={THEME_EXERCISES} firstExerciseHref={FIRST_HREF} />
    ));
    const initial = container.textContent;
    window.dispatchEvent(new StorageEvent("storage", { key: "typeover:theme" }));
    expect(container.textContent).toBe(initial);
  });
});
