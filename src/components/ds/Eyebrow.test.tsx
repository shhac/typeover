import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Eyebrow } from "./Eyebrow";

/*
 * Eyebrow — small mono uppercase label used as a low-key section
 * cue per design-docs/15 pattern 1. The structural contract is
 * just "this renders mono, uppercase, tracked-out, with the right
 * tone color." Easy to break by accident in a refactor, easy to
 * pin here once.
 */

describe("<Eyebrow>", () => {
  it("renders its children inside a span with the mono uppercase classes", () => {
    const { container } = render(() => <Eyebrow>section</Eyebrow>);
    const el = container.querySelector("span");
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe("section");
    /* The "structural classes" — these are the load-bearing rhythm
     * cues; a refactor that drops uppercase or mono is a regression. */
    expect(el!.className).toContain("font-mono");
    expect(el!.className).toContain("uppercase");
    expect(el!.className).toContain("tracking-widest");
  });

  it("defaults to the 'default' tone (fg-secondary)", () => {
    const { container } = render(() => <Eyebrow>x</Eyebrow>);
    expect(container.querySelector("span")!.className).toContain("text-fg-secondary");
  });

  it("applies the requested tone class when 'tone' is set", () => {
    const { container } = render(() => <Eyebrow tone="ts">typescript</Eyebrow>);
    expect(container.querySelector("span")!.className).toContain("text-accent-ts");
  });

  it("forwards arbitrary HTML attrs (id, data-*) to the span", () => {
    const { container } = render(() => (
      <Eyebrow id="hero-eyebrow" data-section="hero">
        hero
      </Eyebrow>
    ));
    const el = container.querySelector("span")!;
    expect(el.id).toBe("hero-eyebrow");
    expect(el.dataset.section).toBe("hero");
  });
});
