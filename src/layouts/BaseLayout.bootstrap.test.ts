import { describe, expect, it } from "vitest";
import { DENSITIES, PALETTES, RADII, STYLES, STYLE_DEFAULT_PALETTE, THEMES } from "~/lib/theme";
import { appearanceBootstrapScript } from "./appearance-bootstrap.inline";
import { runtimePrefetchScript } from "~/lib/runtime-prefetch-script";

/*
 * BaseLayout's inline pre-paint bootstrap script duplicates every
 * enum from `theme.ts` as a string literal (it can't import — it
 * runs before any JS bundle loads). The drift risk: add a new
 * style to `STYLES` in theme.ts and forget the matching literal
 * in the bootstrap, and the new value silently falls back to
 * default with no FOUC signal at first paint.
 *
 * This test reads the bootstrap source as plain text and asserts
 * every enum member appears as a quoted literal. Adding a new
 * value to either side without updating the other fails the test.
 *
 * design-docs/18 F-2.
 */

describe("appearanceBootstrapScript — enum coverage", () => {
  /* Drift guards on the inline pre-paint bootstrap. The script
   * lives in `./appearance-bootstrap.inline.ts` and the layout
   * inlines the exported string verbatim. The lists below have to
   * stay in sync with the enums in `~/lib/{theme,appearance}.ts`;
   * a new value in either side without updating the other fails
   * these assertions. */
  it.each(THEMES)("theme literal %s appears in bootstrap", (value) => {
    expect(appearanceBootstrapScript).toContain(`"${value}"`);
  });

  it.each(DENSITIES)("density literal %s appears in bootstrap", (value) => {
    expect(appearanceBootstrapScript).toContain(`"${value}"`);
  });

  it.each(RADII)("radius literal %s appears in bootstrap", (value) => {
    expect(appearanceBootstrapScript).toContain(`"${value}"`);
  });

  it.each(STYLES)("style literal %s appears in bootstrap", (value) => {
    expect(appearanceBootstrapScript).toContain(`"${value}"`);
  });

  it.each(PALETTES)("palette literal %s appears in bootstrap", (value) => {
    expect(appearanceBootstrapScript).toContain(`"${value}"`);
  });

  it("every style maps to a default palette that bootstrap can resolve", () => {
    /* Drift guard — if theme.ts changes the default for a style, the
     * bootstrap's literal map must follow. Check every (style →
     * default-palette) pair appears as an object-literal pair in the
     * bootstrap source. */
    for (const [style, palette] of Object.entries(STYLE_DEFAULT_PALETTE)) {
      expect(
        appearanceBootstrapScript,
        `expected bootstrap to contain "${style}: \\"${palette}\\""`,
      ).toMatch(new RegExp(`${style}:\\s*"${palette}"`));
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
describe("runtimePrefetchScript hover/focus prefetch body", () => {
  /* The script body now lives in `~/lib/runtime-prefetch-script` so
   * we assert against the imported constant directly — no file I/O,
   * no path resolution. The BaseLayout still inlines it verbatim via
   * `<script is:inline set:html={runtimePrefetchScript} />`. */
  it('injects a <link rel="prefetch"> with the right shape', () => {
    expect(runtimePrefetchScript).toMatch(/link\.rel\s*=\s*"prefetch"/);
    /* prefetch href is parameterised (Yaegi for /go anchors, zig.wasm
     * for /zig anchors); both target paths must appear as string
     * literals in the inline script body. */
    expect(runtimePrefetchScript).toContain("/yaegi/yaegi.wasm");
    expect(runtimePrefetchScript).toContain("/zig/zig.wasm");
    expect(runtimePrefetchScript).toMatch(/link\.crossOrigin\s*=\s*"anonymous"/);
  });

  it("respects saveData + effectiveType slow-2g network signals", () => {
    expect(runtimePrefetchScript).toMatch(/saveData/);
    expect(runtimePrefetchScript).toMatch(/slow-2g/);
  });

  it("is idempotent — fires at most once per page load", () => {
    /* The closure-local `fired` flag is the load-bearing guard. */
    expect(runtimePrefetchScript).toMatch(/var fired = false/);
    expect(runtimePrefetchScript).toMatch(/if \(fired\) return/);
  });

  it("listens on pointerover, focusin, and touchstart", () => {
    /* Three signals cover desktop hover, keyboard focus, and the
     * mobile tap-before-navigation moment. */
    expect(runtimePrefetchScript).toMatch(/addEventListener\("pointerover"/);
    expect(runtimePrefetchScript).toMatch(/addEventListener\("focusin"/);
    expect(runtimePrefetchScript).toMatch(/addEventListener\("touchstart"/);
  });

  it("fires on /go/* and /zig/* anchors", () => {
    expect(runtimePrefetchScript).toMatch(/'a\[href\^="\/go\/"\]'/);
    expect(runtimePrefetchScript).toMatch(/'a\[href\^="\/zig\/"\]'/);
  });
});
