import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { useRunResultFocus } from "./use-run-result-focus";
import type { RunResult } from "./use-yaegi-run";

/*
 * Tests for the mobile-keyboard-aware scroll behaviour added in
 * design-docs/26 P11. The focus-on-result-mount contract is already
 * covered by the FillBlankLineInput + Freeform integration tests;
 * this file pins the visualViewport-driven scroll-into-view path
 * separately so a future regression to the desktop-default
 * focus-scroll doesn't go unnoticed.
 *
 * jsdom doesn't ship visualViewport, so the tests stub it via
 * Object.defineProperty on `window`.
 */

const RESULT: RunResult = {
  stdout: "ok\n",
  stderr: "",
  error: "",
  durationMs: 1,
};

function setupVV(inset: number): void {
  /* Layout viewport: 800 high. Visual viewport: 800 - inset high,
   * offset = 0. Yields gap = innerHeight - (vv.offsetTop + vv.height)
   * = 800 - (0 + (800 - inset)) = inset. */
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(window, "visualViewport", {
    value: {
      offsetTop: 0,
      height: 800 - inset,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    configurable: true,
  });
}

function clearVV(): void {
  Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
}

const scrollIntoViewSpy = vi.fn();
const scrollBySpy = vi.fn();

beforeEach(() => {
  scrollIntoViewSpy.mockReset();
  scrollBySpy.mockReset();
  /* jsdom doesn't implement these; patch onto Element + window. */
  HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
  Object.defineProperty(window, "scrollBy", { value: scrollBySpy, configurable: true });
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    configurable: true,
  });
});

afterEach(() => {
  clearVV();
});

/** Render a tiny harness that wires the hook to a div, sets the
 *  div's bounding rect, and resolves a result. */
function renderHarness(rectBottom: number) {
  const [r, setR] = createSignal<RunResult | null>(null);
  let captured: HTMLDivElement | undefined;
  const { unmount } = render(() => {
    const focus = useRunResultFocus(r);
    return (
      <div
        ref={(el) => {
          focus.ref(el);
          captured = el;
          /* Stub bounding rect — jsdom returns zeroes otherwise. */
          el.getBoundingClientRect = () =>
            ({ bottom: rectBottom, top: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        }}
        tabindex="-1"
      />
    );
  });
  setR(RESULT);
  return { unmount, getEl: () => captured };
}

describe("useRunResultFocus — scroll-into-view above the soft keyboard", () => {
  it("no scroll when the visualViewport API is absent (jsdom default / desktop)", async () => {
    clearVV();
    renderHarness(700);
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    expect(scrollBySpy).not.toHaveBeenCalled();
  });

  it("no scroll when no keyboard is up (inset = 0)", async () => {
    setupVV(0);
    renderHarness(700);
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    expect(scrollBySpy).not.toHaveBeenCalled();
  });

  it("no scroll when panel is already above the occluded slice", async () => {
    /* Keyboard inset = 300; occludedTop = 800 - 300 = 500. Panel
     * bottom = 400 (above the cutoff). Nothing to scroll. */
    setupVV(300);
    renderHarness(400);
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it("scrolls panel bottom into view + nudges UP by inset when occluded", async () => {
    /* Keyboard inset = 300; occludedTop = 500. Panel bottom = 700
     * (inside the occluded slice). Should fire scrollIntoView with
     * block:end + scrollBy with top:-300. */
    setupVV(300);
    renderHarness(700);
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: "end", behavior: "smooth" });
    expect(scrollBySpy).toHaveBeenCalledTimes(1);
    expect(scrollBySpy).toHaveBeenCalledWith({ top: -300, behavior: "smooth" });
  });

  it("uses behavior: auto when prefers-reduced-motion is set", async () => {
    setupVV(300);
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
      configurable: true,
    });
    renderHarness(700);
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: "end", behavior: "auto" });
    expect(scrollBySpy).toHaveBeenCalledWith({ top: -300, behavior: "auto" });
  });
});
