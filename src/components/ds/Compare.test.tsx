import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Compare } from "./Compare";

/*
 * Compare — figure/figcaption wrapper around Adaptive. Pin the
 * semantic structure (figure + figcaption) because that's what
 * makes the comparison feel intentional vs. "two things next to
 * each other" (design-docs/15 pattern 4).
 */

describe("<Compare>", () => {
  it("wraps children in a <figure>", () => {
    const { container } = render(() => (
      <Compare>
        <div>left</div>
        <div>right</div>
      </Compare>
    ));
    expect(container.querySelector("figure")).not.toBeNull();
  });

  it("renders a <figcaption> when caption is provided", () => {
    const { container, getByText } = render(() => (
      <Compare caption="Shared note about both columns">
        <div>left</div>
        <div>right</div>
      </Compare>
    ));
    const cap = container.querySelector("figcaption");
    expect(cap).not.toBeNull();
    expect(getByText("Shared note about both columns")).toBeTruthy();
  });

  it("omits the <figcaption> when caption is absent", () => {
    const { container } = render(() => (
      <Compare>
        <div>left</div>
        <div>right</div>
      </Compare>
    ));
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("renders all children inside the inner Adaptive grid", () => {
    const { container } = render(() => (
      <Compare>
        <div data-testid="a">left</div>
        <div data-testid="b">right</div>
      </Compare>
    ));
    expect(container.querySelector('[data-testid="a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="b"]')).not.toBeNull();
  });
});
