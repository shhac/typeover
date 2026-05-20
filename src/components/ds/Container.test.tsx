import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Container } from "./Container";

/*
 * Container — width contract per design-docs/21 #4 (revised
 * 2026-05-20). The original rebind tied `width="default"` to the
 * style-axis `--measure` token, but that squashed non-prose
 * layouts (like /settings's 2-col grid) under textbook's 60ch.
 * Now only `width="prose"` consumes `--measure` — every other
 * width keeps a deterministic max-w utility regardless of style.
 */

describe("<Container>", () => {
  it('width="default" yields max-w-4xl and NO inline max-width override', () => {
    const { container } = render(() => <Container>child</Container>);
    const el = container.querySelector("div")!;
    expect(el.className).toContain("max-w-4xl");
    expect(el.getAttribute("style") ?? "").not.toContain("max-width");
  });

  it('width="wide" yields max-w-6xl and NO inline override', () => {
    const { container } = render(() => <Container width="wide">child</Container>);
    const el = container.querySelector("div")!;
    expect(el.className).toContain("max-w-6xl");
    expect(el.getAttribute("style") ?? "").not.toContain("max-width");
  });

  it('width="narrow" yields max-w-2xl and NO inline override', () => {
    const { container } = render(() => <Container width="narrow">child</Container>);
    const el = container.querySelector("div")!;
    expect(el.className).toContain("max-w-2xl");
    expect(el.getAttribute("style") ?? "").not.toContain("max-width");
  });

  it('width="full" yields max-w-none and NO inline override', () => {
    const { container } = render(() => <Container width="full">child</Container>);
    const el = container.querySelector("div")!;
    expect(el.className).toContain("max-w-none");
    expect(el.getAttribute("style") ?? "").not.toContain("max-width");
  });

  it('width="prose" consumes --measure via inline style and NO Tailwind max-w utility', () => {
    /* The load-bearing assertion. design-docs/21 #4 revised. */
    const { container } = render(() => <Container width="prose">child</Container>);
    const el = container.querySelector("div")!;
    const style = el.getAttribute("style") ?? "";
    expect(style).toContain("max-width: var(--measure)");
    /* Should NOT carry a competing max-w-* utility. */
    expect(el.className).not.toMatch(/\bmax-w-(2xl|4xl|6xl|none)\b/);
  });

  it("base classes (mx-auto + padding) apply at every width", () => {
    const { container } = render(() => <Container width="prose">child</Container>);
    const el = container.querySelector("div")!;
    expect(el.className).toContain("mx-auto");
    expect(el.className).toContain("px-6");
    expect(el.className).toContain("sm:px-8");
    expect(el.className).toContain("w-full");
  });
});
