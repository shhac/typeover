import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { PALETTE_CHIP_COLORS, PaletteChip } from "./PaletteChip";
import { PALETTES } from "~/lib/theme";

/*
 * Two suites:
 *  1. Render contract — the chip is aria-hidden, sets data
 *     attributes, and paints the right colours inline.
 *  2. Drift guard — PALETTE_CHIP_COLORS duplicates `--color-bg-base`
 *     and `--color-accent-primary` from src/styles/global.css.
 *     This test parses the CSS and asserts every value agrees, so
 *     a future tweak to a palette's colours can't silently desync
 *     the picker swatches.
 */

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, "..", "..", "styles", "global.css");
const cssSource = readFileSync(cssPath, "utf8");

/** Pull a single CSS declaration out of a palette block by selector
 *  + variable name. Returns the hex literal. Throws when the
 *  selector or variable is missing — that's a test-authoring bug,
 *  not a graceful fallback. */
function readDecl(selector: string, varName: string): string {
  const blockRe = new RegExp(
    `^${selector.replace(/[[\]"]/g, (m) => "\\" + m)} \\{([\\s\\S]*?)^\\}`,
    "m",
  );
  const blockMatch = cssSource.match(blockRe);
  if (!blockMatch) throw new Error(`CSS block not found: ${selector}`);
  const declRe = new RegExp(`${varName}: (#[0-9a-fA-F]+);`);
  const declMatch = blockMatch[1].match(declRe);
  if (!declMatch) throw new Error(`${varName} not found in block ${selector}`);
  return declMatch[1].toLowerCase();
}

describe("<PaletteChip>", () => {
  it("renders aria-hidden with palette + theme data attributes", () => {
    const { getByTestId } = render(() => <PaletteChip palette="kraft" theme="dark" />);
    const chip = getByTestId("palette-chip");
    expect(chip.getAttribute("aria-hidden")).toBe("true");
    expect(chip.getAttribute("data-palette")).toBe("kraft");
    expect(chip.getAttribute("data-palette-theme")).toBe("dark");
  });

  it("paints background = bg-base, dot = accent-primary (kraft dark)", () => {
    const { getByTestId } = render(() => <PaletteChip palette="kraft" theme="dark" />);
    const chip = getByTestId("palette-chip");
    /* Inline background-color sourced from PALETTE_CHIP_COLORS.kraft.dark.bg.
     * The browser normalises hex → rgb, but jsdom preserves the raw inline. */
    expect(chip.style.backgroundColor).toMatch(/#1a1410|rgb\(26,\s*20,\s*16\)/i);
    const dot = chip.querySelector("span");
    if (!dot) throw new Error("accent dot missing");
    expect(dot.style.backgroundColor).toMatch(/#f4a437|rgb\(244,\s*164,\s*55\)/i);
  });

  it("respects explicit theme=light override", () => {
    const { getByTestId } = render(() => <PaletteChip palette="kraft" theme="light" />);
    const chip = getByTestId("palette-chip");
    expect(chip.getAttribute("data-palette-theme")).toBe("light");
    expect(chip.style.backgroundColor).toMatch(/#d8c7a3|rgb\(216,\s*199,\s*163\)/i);
  });
});

describe("PALETTE_CHIP_COLORS — drift guard against global.css", () => {
  it("includes every palette ID in PALETTES", () => {
    for (const p of PALETTES) {
      expect(PALETTE_CHIP_COLORS[p], `missing palette: ${p}`).toBeDefined();
    }
  });

  for (const palette of PALETTES) {
    it(`${palette} dark — bg + accent agree with global.css`, () => {
      const cssBg = readDecl(`:root[data-palette="${palette}"]`, "--color-bg-base");
      const cssAccent = readDecl(`:root[data-palette="${palette}"]`, "--color-accent-primary");
      expect(PALETTE_CHIP_COLORS[palette].dark.bg.toLowerCase()).toBe(cssBg);
      expect(PALETTE_CHIP_COLORS[palette].dark.accent.toLowerCase()).toBe(cssAccent);
    });
    it(`${palette} light — bg + accent agree with global.css`, () => {
      const cssBg = readDecl(
        `:root[data-palette="${palette}"][data-theme="light"]`,
        "--color-bg-base",
      );
      const cssAccent = readDecl(
        `:root[data-palette="${palette}"][data-theme="light"]`,
        "--color-accent-primary",
      );
      expect(PALETTE_CHIP_COLORS[palette].light.bg.toLowerCase()).toBe(cssBg);
      expect(PALETTE_CHIP_COLORS[palette].light.accent.toLowerCase()).toBe(cssAccent);
    });
  }
});
