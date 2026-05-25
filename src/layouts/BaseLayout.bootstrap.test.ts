import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "~/lib/appearance-bootstrap";
import { DENSITIES, PALETTES, RADII, STYLES, STYLE_DEFAULT_PALETTE, THEMES } from "~/lib/theme";

/*
 * BaseLayout's inline pre-paint bootstrap script is generated from
 * shared appearance constants. It still has to inline literal JSON
 * so it can run before any JS bundle loads.
 *
 * This test inspects the generated script and asserts every enum
 * member appears as a quoted literal. Adding a new value to the
 * canonical constants without flowing it into the generated script
 * fails the test.
 *
 * design-docs/18 F-2.
 */

const here = dirname(fileURLToPath(import.meta.url));
const layoutPath = join(here, "BaseLayout.astro");

async function layoutSource(): Promise<string> {
  const layout = await readFile(layoutPath, "utf8");
  expect(layout).toContain("set:html={APPEARANCE_BOOTSTRAP_SCRIPT}");
  return layout;
}

async function bootstrapSource(): Promise<string> {
  await layoutSource();
  return APPEARANCE_BOOTSTRAP_SCRIPT;
}

describe("BaseLayout bootstrap — enum coverage", () => {
  it.each(THEMES)("theme literal %s appears in bootstrap", async (value) => {
    const src = await bootstrapSource();
    expect(src).toContain(`"${value}"`);
  });

  it.each(DENSITIES)("density literal %s appears in bootstrap", async (value) => {
    const src = await bootstrapSource();
    expect(src).toContain(`"${value}"`);
  });

  it.each(RADII)("radius literal %s appears in bootstrap", async (value) => {
    const src = await bootstrapSource();
    expect(src).toContain(`"${value}"`);
  });

  it.each(STYLES)("style literal %s appears in bootstrap", async (value) => {
    const src = await bootstrapSource();
    expect(src).toContain(`"${value}"`);
  });

  it.each(PALETTES)("palette literal %s appears in bootstrap", async (value) => {
    const src = await bootstrapSource();
    expect(src).toContain(`"${value}"`);
  });

  it("every style maps to a default palette that bootstrap can resolve", async () => {
    /* Drift guard — if theme.ts changes the default for a style, the
     * bootstrap's literal map must follow. Check every (style →
     * default-palette) pair appears as an object-literal pair in the
     * bootstrap source. */
    const src = await bootstrapSource();
    for (const [style, palette] of Object.entries(STYLE_DEFAULT_PALETTE)) {
      expect(src, `expected bootstrap to contain "${style}":"${palette}"`).toContain(
        `"${style}":"${palette}"`,
      );
    }
  });
});

/*
 * design-docs/25 P5 — hover/focus prefetch script. Inline because
 * it has to fire before any JS bundle loads and it's tiny enough
 * that a module import is more overhead than the script itself.
 *
 * Drift guards on the inline script's load-bearing predicates: if
 * a future edit drops the saveData gate, the slow-2g gate, or the
 * idempotence flag, the prefetch behaviour quietly degrades into
 * a per-event link injection — sanity in the source, not at runtime.
 */
describe("BaseLayout hover/focus runtime prefetch", () => {
  it('injects a <link rel="prefetch"> with the right shape', async () => {
    const src = await layoutSource();
    expect(src).toMatch(/link\.rel\s*=\s*"prefetch"/);
    /* prefetch href is parameterised (Yaegi for /go anchors, zig.wasm
     * for /zig anchors); verify both target paths appear as string
     * literals in the inline script body. */
    expect(src).toContain("/yaegi/yaegi.wasm");
    expect(src).toContain("/zig/zig.wasm");
    expect(src).toMatch(/link\.crossOrigin\s*=\s*"anonymous"/);
  });

  it("respects saveData + effectiveType slow-2g network signals", async () => {
    const src = await layoutSource();
    expect(src).toMatch(/saveData/);
    expect(src).toMatch(/slow-2g/);
  });

  it("is idempotent — fires at most once per page load", async () => {
    /* The closure-local `fired` flag is the load-bearing guard. */
    const src = await layoutSource();
    expect(src).toMatch(/var fired = false/);
    expect(src).toMatch(/if \(fired\) return/);
  });

  it("listens on pointerover, focusin, and touchstart", async () => {
    /* Three signals cover desktop hover, keyboard focus, and the
     * mobile tap-before-navigation moment. */
    const src = await layoutSource();
    expect(src).toMatch(/addEventListener\("pointerover"/);
    expect(src).toMatch(/addEventListener\("focusin"/);
    expect(src).toMatch(/addEventListener\("touchstart"/);
  });

  it("fires on /go/* and /zig/* anchors", async () => {
    const src = await layoutSource();
    expect(src).toMatch(/'a\[href\^="\/go\/"\]'/);
    expect(src).toMatch(/'a\[href\^="\/zig\/"\]'/);
  });
});
