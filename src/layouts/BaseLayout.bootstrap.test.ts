import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DENSITIES, RADII, STYLES, THEMES } from "~/lib/theme";

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

const here = dirname(fileURLToPath(import.meta.url));
const layoutPath = join(here, "BaseLayout.astro");

async function bootstrapSource(): Promise<string> {
  return readFile(layoutPath, "utf8");
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
});
