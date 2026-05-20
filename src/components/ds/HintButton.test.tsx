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

  it("three clicks reveal all three hints, then the button collapses to a quiet caption", () => {
    /* design-docs/16 F-5 — the earlier behaviour kept a permanently
     * disabled "No more hints" button. After the cap the button now
     * disappears entirely and is replaced by an "all three hints
     * shown" caption; the canonical Reveal lives on the shell's
     * footer RevealButton from here. */
    const { queryByRole, getByText } = render(() => <HintButton hints={HINTS} />);
    const btn = queryByRole("button") as HTMLButtonElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(getByText(HINTS[0])).toBeTruthy();
    expect(getByText(HINTS[1])).toBeTruthy();
    expect(getByText(HINTS[2])).toBeTruthy();
    expect(queryByRole("button")).toBeNull();
    expect(getByText("all three hints shown")).toBeTruthy();
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

  it("button removal at cap means there's no further click target", () => {
    /* Belt-and-braces — the post-cap UI collapses the button so the
     * user can't re-click. The internal `next()` cap is still in
     * place (see "Hint label resets" tests below); this test pins
     * the UI-level contract. */
    const onReveal = vi.fn();
    const { queryByRole } = render(() => <HintButton hints={HINTS} onReveal={onReveal} />);
    fireEvent.click(queryByRole("button")!);
    fireEvent.click(queryByRole("button")!);
    fireEvent.click(queryByRole("button")!);
    expect(onReveal).toHaveBeenCalledTimes(3);
    expect(queryByRole("button")).toBeNull();
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
