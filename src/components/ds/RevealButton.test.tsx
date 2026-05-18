import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { RevealButton } from "./RevealButton";

/*
 * Pins the off→on edge semantics for onReveal. The reveal action is
 * the only path that records a learner failure (see
 * design-docs/12-test-plan.md P1 — useExercisePhase.revealCorrect).
 * If a future ExerciseShell wires `onReveal` to recordInstanceFailed
 * and the button regresses to firing on every toggle (off→on AND
 * on→off), every reveal-cycle would double-count failures.
 */

const CANONICAL = "x := 42";

describe("RevealButton", () => {
  it("starts hidden — canonical content is not rendered", () => {
    const { getByRole, queryByText } = render(() => (
      <RevealButton canonical={CANONICAL} />
    ));
    expect(getByRole("button").textContent).toBe("Show canonical");
    expect(queryByText(CANONICAL)).toBeNull();
  });

  it("first click shows the canonical and flips the label", () => {
    const { getByRole, getByText } = render(() => (
      <RevealButton canonical={CANONICAL} />
    ));
    fireEvent.click(getByRole("button"));
    expect(getByRole("button").textContent).toBe("Hide canonical");
    expect(getByText(CANONICAL)).toBeTruthy();
  });

  it("second click hides the canonical again", () => {
    const { getByRole, queryByText } = render(() => (
      <RevealButton canonical={CANONICAL} />
    ));
    const btn = getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Show canonical");
    expect(queryByText(CANONICAL)).toBeNull();
  });

  it("onReveal fires only on the off → on edge, never on on → off", () => {
    /* The load-bearing assertion. show → hide → show → hide
     * should fire onReveal exactly twice (once per show), not four
     * times (once per toggle). */
    const onReveal = vi.fn();
    const { getByRole } = render(() => (
      <RevealButton canonical={CANONICAL} onReveal={onReveal} />
    ));
    const btn = getByRole("button");
    fireEvent.click(btn); // show
    fireEvent.click(btn); // hide
    fireEvent.click(btn); // show
    fireEvent.click(btn); // hide
    expect(onReveal).toHaveBeenCalledTimes(2);
  });

  it("aria-expanded reflects the shown state", () => {
    const { getByRole } = render(() => (
      <RevealButton canonical={CANONICAL} />
    ));
    const btn = getByRole("button");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});
