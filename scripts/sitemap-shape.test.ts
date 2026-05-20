import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Pins the contract that:
 *   1. `pnpm build` emits sitemap-index.xml + sitemap-0.xml + robots.txt.
 *   2. The sitemap uses the canonical origin from astro.config.mjs.
 *   3. The two dev-only routes (/design-system, /runtime-smoke) are
 *      filtered out — they aren't learner-facing pages.
 *
 * Skips when dist/ doesn't exist (developer running tests without
 * a recent build). Run after a `pnpm build` to catch regressions
 * before they ship.
 */

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "..", "dist");

const skipUnlessBuilt = existsSync(distDir) ? describe : describe.skip;

skipUnlessBuilt("sitemap + robots — release hygiene", () => {
  it("emits sitemap-index.xml + sitemap-0.xml + robots.txt in dist/", () => {
    expect(existsSync(join(distDir, "sitemap-index.xml"))).toBe(true);
    expect(existsSync(join(distDir, "sitemap-0.xml"))).toBe(true);
    expect(existsSync(join(distDir, "robots.txt"))).toBe(true);
  });

  it("sitemap URLs use the canonical origin", () => {
    const xml = readFileSync(join(distDir, "sitemap-0.xml"), "utf8");
    expect(xml).toContain("https://typeover.paulie.app/");
  });

  it("excludes /design-system and /runtime-smoke (internal dev tools)", () => {
    const xml = readFileSync(join(distDir, "sitemap-0.xml"), "utf8");
    expect(xml).not.toContain("/design-system");
    expect(xml).not.toContain("/runtime-smoke");
  });

  it("includes the high-priority learner-facing routes", () => {
    const xml = readFileSync(join(distDir, "sitemap-0.xml"), "utf8");
    /* The home page, the curriculum index, and Module 1's first
     * exercise — the three URLs a discovery crawler should land
     * on first. */
    expect(xml).toContain("<loc>https://typeover.paulie.app/</loc>");
    expect(xml).toContain("https://typeover.paulie.app/go/");
    expect(xml).toContain("https://typeover.paulie.app/go/foundations/variables/01/");
  });

  it("robots.txt points at the sitemap-index", () => {
    const txt = readFileSync(join(distDir, "robots.txt"), "utf8");
    expect(txt).toMatch(/Sitemap:\s*https:\/\/typeover\.paulie\.app\/sitemap-index\.xml/);
    expect(txt).toMatch(/Disallow:\s*\/design-system/);
    expect(txt).toMatch(/Disallow:\s*\/runtime-smoke/);
  });
});
