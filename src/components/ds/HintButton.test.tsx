import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { HintButton } from "./HintButton";

/*
 * Pins the 3-layer escalation contract documented in
 * design-docs/02-pedagogy.md. A regression that fires onReveal past
 * the cap would inflate every learner's hintsUsedTotal counter
 * forever; a regression that off-by-ones the cap would either
 * skip the third hint or expose a fourth click that does nothing
 * but still records.
 */

const HINTS: readonly [string, string, string] = [
  "hint one — conceptual",
  "hint two — structural",
  "hint three — near-answer",
];

describe("HintButton", () => {
  it("initial state: label 'Hint', no hint list rendered", () => {
    const { getByRole, queryByText } = render(() => <HintButton hints={HINTS} />);
    expect(getByRole("button").textContent).toBe("Hint");
    expect(queryByText(HINTS[0])).toBeNull();
  });

  it("first click reveals the first hint and updates label to 'Another hint'", () => {
    const { getByRole, getByText } = render(() => <HintButton hints={HINTS} />);
    fireEvent.click(getByRole("button"));
    expect(getByText(HINTS[0])).toBeTruthy();
    expect(getByRole("button").textContent).toBe("Another hint");
  });

  it("three clicks reveal all three hints, label becomes 'No more hints', button disabled", () => {
    const { getByRole, getByText } = render(() => <HintButton hints={HINTS} />);
    const btn = getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(getByText(HINTS[0])).toBeTruthy();
    expect(getByText(HINTS[1])).toBeTruthy();
    expect(getByText(HINTS[2])).toBeTruthy();
    expect(btn.textContent).toBe("No more hints");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("onReveal fires exactly once per click, up to the cap", () => {
    const onReveal = vi.fn();
    const { getByRole } = render(() => <HintButton hints={HINTS} onReveal={onReveal} />);
    const btn = getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onReveal).toHaveBeenCalledTimes(3);
  });

  it("clicking past the cap is a no-op — onReveal does not fire", () => {
    /* The button is disabled at 3, but a programmatic click or a
     * future variant that re-enables the button must not fire
     * onReveal past the cap. */
    const onReveal = vi.fn();
    const { getByRole } = render(() => <HintButton hints={HINTS} onReveal={onReveal} />);
    const btn = getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    /* Force a 4th click despite the disabled attribute — Solid's
     * disabled attribute prevents user clicks but fireEvent on a
     * disabled button still dispatches the event. The internal
     * cap guards this. */
    onReveal.mockClear();
    fireEvent.click(btn);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("aria-label includes the current reveal count", () => {
    const { getByRole } = render(() => <HintButton hints={HINTS} />);
    const btn = getByRole("button");
    expect(btn.getAttribute("aria-label")).toMatch(/0 of 3/);
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toMatch(/1 of 3/);
  });

  /*
   * Placeholder substitution — a hint like `${name} := ${value}` should
   * render with the current instance's chosen values, not the literal
   * placeholders. Lenient: unknown vars stay as `${name}`.
   */
  describe("placeholder substitution", () => {
    const PLACEHOLDER_HINTS: readonly [string, string, string] = [
      "conceptual",
      "structural",
      "`${name} := ${value}`",
    ];

    it("substitutes known ${vars} from `values` against the hint text", () => {
      const { getByRole, container } = render(() => (
        <HintButton hints={PLACEHOLDER_HINTS} values={{ name: "count", value: "5" }} />
      ));
      const btn = getByRole("button");
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      /* Hint 3 should render as `count := 5` inside a <code> span. */
      const code = container.querySelector("code");
      expect(code?.textContent).toBe("count := 5");
    });

    it("leaves unknown placeholders intact (lenient — authoring smell, not crash)", () => {
      const { getByRole, container } = render(() => (
        <HintButton hints={["`${nope}`", "b", "c"]} values={{ other: "x" }} />
      ));
      fireEvent.click(getByRole("button"));
      const code = container.querySelector("code");
      expect(code?.textContent).toBe("${nope}");
    });

    it("passes hints through unchanged when `values` is undefined (variant/procedural)", () => {
      const { getByRole, container } = render(() => <HintButton hints={PLACEHOLDER_HINTS} />);
      fireEvent.click(getByRole("button"));
      fireEvent.click(getByRole("button"));
      fireEvent.click(getByRole("button"));
      const code = container.querySelector("code");
      expect(code?.textContent).toBe("${name} := ${value}");
    });
  });
});
