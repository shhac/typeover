import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { ProgressChip } from "./ProgressChip";

/*
 * ProgressChip — pure presentational primitive. No localStorage,
 * no aggregation. Tests pin the visible copy and the aria-label
 * so the screen-reader rendering can't silently regress to the
 * unfriendly "six slash nine".
 */

describe("<ProgressChip kind='theme'>", () => {
  it('renders "P/T passed" body', () => {
    const { container } = render(() => <ProgressChip kind="theme" passed={6} total={9} />);
    expect(container.textContent).toContain("6/9 passed");
  });

  it("attaches a friendly aria-label", () => {
    const { container } = render(() => <ProgressChip kind="theme" passed={6} total={9} />);
    expect(container.querySelector("span")!.getAttribute("aria-label")).toBe(
      "6 of 9 exercises passed",
    );
  });

  it("uses mono class so the chip lines up with surrounding data labels", () => {
    const { container } = render(() => <ProgressChip kind="theme" passed={0} total={9} />);
    expect(container.querySelector("span")!.className).toContain("font-mono");
  });
});

describe("<ProgressChip kind='exercise'>", () => {
  it('renders "seen S · passed P" body', () => {
    const { container } = render(() => <ProgressChip kind="exercise" seen={3} passed={2} />);
    expect(container.textContent).toContain("seen 3 · passed 2");
  });

  it("attaches a friendly aria-label", () => {
    const { container } = render(() => <ProgressChip kind="exercise" seen={3} passed={2} />);
    expect(container.querySelector("span")!.getAttribute("aria-label")).toBe(
      "Seen 3 instances, passed 2",
    );
  });
});

describe("<ProgressChip minCh>", () => {
  it("reserves the requested min-width via inline style", () => {
    const { container } = render(() => (
      <ProgressChip kind="theme" passed={0} total={9} minCh={10} />
    ));
    expect(container.querySelector("span")!.getAttribute("style")).toContain("min-width: 10ch");
  });
});
