import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { GO_KEYS, MobileKeyBar } from "./MobileKeyBar";

/*
 * MobileKeyBar — DS-layer mobile symbol bar. Tests pin the
 * structural contract that follow-up code (caller wirings,
 * future iOS Safari visualViewport polish, accessibility audits)
 * relies on.
 */

describe("<MobileKeyBar> — structure", () => {
  it('renders a role="toolbar" with the "Code symbols" name', () => {
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    const bar = container.querySelector('[role="toolbar"]');
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute("aria-label")).toBe("Code symbols");
  });

  it("renders one button per key in GO_KEYS by default", () => {
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    const buttons = container.querySelectorAll('[role="toolbar"] button');
    expect(buttons.length).toBe(GO_KEYS.length);
  });

  it("hides on desktop via lg:hidden", () => {
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    expect(container.querySelector('[role="toolbar"]')!.className).toContain("lg:hidden");
  });
});

describe("<MobileKeyBar> — a11y", () => {
  it("uses ariaLabel when provided (symbolic keys read as words)", () => {
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    const braceBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "{",
    );
    expect(braceBtn).toBeTruthy();
    expect(braceBtn!.getAttribute("aria-label")).toBe("open brace");
  });

  it("falls back to label when ariaLabel is absent", () => {
    const customKeys = [{ label: "X", insert: "X" }];
    const { container } = render(() => <MobileKeyBar keys={customKeys} onInsert={() => {}} />);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("X");
  });

  it("each key meets the 44×44 touch-target floor via min-w-11 min-h-11", () => {
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    const first = container.querySelector('[role="toolbar"] button')!;
    expect(first.className).toContain("min-w-11");
    expect(first.className).toContain("min-h-11");
  });
});

describe("<MobileKeyBar> — onInsert wiring", () => {
  it("calls onInsert with the key's insert text on click", () => {
    const insertSpy = vi.fn();
    const customKeys = [
      { label: "Tab", insert: "  " },
      { label: ":=", insert: ":=" },
    ];
    const { container } = render(() => <MobileKeyBar keys={customKeys} onInsert={insertSpy} />);
    const [tabBtn, walrusBtn] = Array.from(container.querySelectorAll("button"));
    fireEvent.click(tabBtn!);
    fireEvent.click(walrusBtn!);
    expect(insertSpy).toHaveBeenNthCalledWith(1, "  ");
    expect(insertSpy).toHaveBeenNthCalledWith(2, ":=");
  });

  it("⏎ key inserts a literal newline", () => {
    const insertSpy = vi.fn();
    const { container } = render(() => <MobileKeyBar onInsert={insertSpy} />);
    const newlineBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "⏎",
    )!;
    fireEvent.click(newlineBtn);
    expect(insertSpy).toHaveBeenCalledWith("\n");
  });
});

describe("<MobileKeyBar> — keyboard-overlap fallback", () => {
  it("starts at bottom: 0 when visualViewport is absent (jsdom path)", () => {
    /* jsdom doesn't implement visualViewport, so useKeyboardInset
     * returns 0 throughout. Pin that: the bar's inline `bottom`
     * style stays "0px" rather than NaN, undefined, or missing. */
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    const bar = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(bar.style.bottom).toBe("0px");
  });
});

describe("<MobileKeyBar> — Run shortcut", () => {
  it("omits the Run button when onRun is absent", () => {
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} />);
    expect(
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Run"),
    ).toBeUndefined();
  });

  it("renders a Run button when onRun is provided and fires the callback on click", () => {
    const runSpy = vi.fn();
    const { container } = render(() => <MobileKeyBar onInsert={() => {}} onRun={runSpy} />);
    const runBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Run",
    );
    expect(runBtn).toBeTruthy();
    fireEvent.click(runBtn!);
    expect(runSpy).toHaveBeenCalledTimes(1);
  });
});
