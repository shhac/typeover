import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { RevealButton } from "./RevealButton";

/*
 * Pins the once-per-component-lifetime semantics for onReveal.
 * ExerciseShell wires `onReveal` to `recordHintUsed` (design-docs/19
 * F-15) — the footer Reveal counts as one hint-equivalent per peek
 * session, not per click. Without the latch, toggling closed/open
 * would over-report; without the off→on guard, every click would
 * double-count.
 */

const CANONICAL = "x := 42";

describe("RevealButton", () => {
  it("starts hidden — canonical content is not rendered", () => {
    const { getByRole, queryByText } = render(() => <RevealButton canonical={CANONICAL} />);
    expect(getByRole("button").textContent).toBe("Show answer");
    expect(queryByText(CANONICAL)).toBeNull();
  });

  it("first click shows the canonical and flips the label", () => {
    const { getByRole, getByText } = render(() => <RevealButton canonical={CANONICAL} />);
    fireEvent.click(getByRole("button"));
    expect(getByRole("button").textContent).toBe("Hide answer");
    expect(getByText(CANONICAL)).toBeTruthy();
  });

  it("second click hides the canonical again", () => {
    const { getByRole, queryByText } = render(() => <RevealButton canonical={CANONICAL} />);
    const btn = getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Show answer");
    expect(queryByText(CANONICAL)).toBeNull();
  });

  it("onReveal fires once per component lifetime — never re-fires on subsequent reopens", () => {
    /* The load-bearing assertion. design-docs/19 F-15 wires this to
     * recordHintUsed; a learner toggling closed and reopening the
     * canonical should not pay a second hint. show → hide → show →
     * hide fires onReveal exactly once. */
    const onReveal = vi.fn();
    const { getByRole } = render(() => <RevealButton canonical={CANONICAL} onReveal={onReveal} />);
    const btn = getByRole("button");
    fireEvent.click(btn); // show
    fireEvent.click(btn); // hide
    fireEvent.click(btn); // show again — already reported
    fireEvent.click(btn); // hide
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("aria-expanded reflects the shown state", () => {
    const { getByRole } = render(() => <RevealButton canonical={CANONICAL} />);
    const btn = getByRole("button");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});
