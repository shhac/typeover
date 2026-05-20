import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentChoice,
  currentDensity,
  currentPalette,
  currentPaletteChoice,
  currentRadius,
  currentStyle,
  currentTheme,
  DENSITY_STORAGE_KEY,
  PALETTE_HOME_STYLE,
  PALETTE_STORAGE_KEY,
  PALETTES,
  RADIUS_STORAGE_KEY,
  reapplyDefaultPaletteForCurrentStyle,
  setDensity,
  setPalette,
  setRadius,
  setStyle,
  setTheme,
  STORAGE_KEY,
  STYLE_DEFAULT_PALETTE,
  STYLE_STORAGE_KEY,
} from "./theme";

/*
 * Theme helpers. Pinned: localStorage round-trip, DOM data-theme is
 * the runtime source of truth, "system" clears the pin and re-derives
 * from prefers-color-scheme.
 *
 * jsdom doesn't implement window.matchMedia; we stub it per-test so
 * we can drive both branches of the OS-preference fallback.
 */

const matchMediaStub = (prefersLight: boolean) => {
  return (query: string) =>
    ({
      matches: query.includes("light") && prefersLight,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
};

beforeEach(() => {
  /* vitest.setup.ts already gives us a fresh localStorage shim per
   * test. Reset the DOM attributes too. */
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.density;
  delete document.documentElement.dataset.radius;
  delete document.documentElement.dataset.style;
  delete document.documentElement.dataset.palette;
  vi.stubGlobal("matchMedia", matchMediaStub(false));
  /* matchMedia lives on window, not just globalThis */
  Object.defineProperty(window, "matchMedia", {
    value: matchMediaStub(false),
    writable: true,
    configurable: true,
  });
});

describe("currentTheme", () => {
  it("returns the DOM attribute when set", () => {
    document.documentElement.dataset.theme = "light";
    expect(currentTheme()).toBe("light");
  });

  it("falls back to OS preference when no attribute is set (dark OS)", () => {
    expect(currentTheme()).toBe("dark");
  });

  it("falls back to OS preference when no attribute is set (light OS)", () => {
    Object.defineProperty(window, "matchMedia", {
      value: matchMediaStub(true),
      writable: true,
      configurable: true,
    });
    expect(currentTheme()).toBe("light");
  });

  it("ignores an unknown attribute and falls back to OS", () => {
    document.documentElement.dataset.theme = "futuristic";
    expect(currentTheme()).toBe("dark");
  });
});

describe("currentChoice", () => {
  it('returns "system" when no pin', () => {
    expect(currentChoice()).toBe("system");
  });

  it("returns the pin when set", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    expect(currentChoice()).toBe("light");
  });

  it('returns "system" when pin is an unknown value', () => {
    localStorage.setItem(STORAGE_KEY, "futuristic");
    expect(currentChoice()).toBe("system");
  });
});

describe("setTheme", () => {
  it('writes the pin and updates the DOM for "dark" / "light"', () => {
    setTheme("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    setTheme("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it('"system" clears the pin and re-derives from OS', () => {
    setTheme("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    setTheme("system");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    /* OS is stubbed as not-light, so we re-derive to dark. */
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("DOM is the source of truth at runtime — currentTheme() reflects it after setTheme", () => {
    setTheme("light");
    expect(currentTheme()).toBe("light");
  });
});

describe("density axis", () => {
  it("currentDensity defaults to 'normal' when no DOM attribute", () => {
    expect(currentDensity()).toBe("normal");
  });

  it("currentDensity reads the DOM attribute when set", () => {
    document.documentElement.dataset.density = "compact";
    expect(currentDensity()).toBe("compact");
  });

  it("currentDensity falls back to 'normal' on an unknown attribute", () => {
    document.documentElement.dataset.density = "ultra";
    expect(currentDensity()).toBe("normal");
  });

  it("setDensity writes the pin and updates the DOM", () => {
    setDensity("airy");
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("airy");
    expect(document.documentElement.dataset.density).toBe("airy");
    expect(currentDensity()).toBe("airy");
  });
});

describe("radius axis", () => {
  it("currentRadius defaults to 'normal' when no DOM attribute", () => {
    expect(currentRadius()).toBe("normal");
  });

  it("currentRadius reads the DOM attribute when set", () => {
    document.documentElement.dataset.radius = "rounded";
    expect(currentRadius()).toBe("rounded");
  });

  it("currentRadius falls back to 'normal' on an unknown attribute", () => {
    document.documentElement.dataset.radius = "spiky";
    expect(currentRadius()).toBe("normal");
  });

  it("setRadius writes the pin and updates the DOM", () => {
    setRadius("sharp");
    expect(localStorage.getItem(RADIUS_STORAGE_KEY)).toBe("sharp");
    expect(document.documentElement.dataset.radius).toBe("sharp");
    expect(currentRadius()).toBe("sharp");
  });
});

describe("style axis", () => {
  it("currentStyle defaults to 'terminal' when no DOM attribute", () => {
    expect(currentStyle()).toBe("terminal");
  });

  it("currentStyle reads the DOM attribute when set", () => {
    document.documentElement.dataset.style = "glass";
    expect(currentStyle()).toBe("glass");
  });

  it("currentStyle falls back to 'terminal' on an unknown attribute", () => {
    document.documentElement.dataset.style = "neon";
    expect(currentStyle()).toBe("terminal");
  });

  it("setStyle writes the pin and updates the DOM", () => {
    setStyle("cardboard");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("cardboard");
    expect(document.documentElement.dataset.style).toBe("cardboard");
    expect(currentStyle()).toBe("cardboard");
  });

  it("accepts all five documented styles", () => {
    for (const s of ["terminal", "cardboard", "textbook", "glass", "islands"] as const) {
      setStyle(s);
      expect(currentStyle()).toBe(s);
    }
  });
});

describe("palette axis", () => {
  /* design-docs/22. Palette has the same factory-axis shape as
   * density/radius/style for storage + DOM I/O, plus a bespoke
   * "default" magic value (the colour axis's "system" is the
   * precedent). Pin every contract the settings UI depends on. */

  it('currentPaletteChoice defaults to "default" when no localStorage pin', () => {
    expect(currentPaletteChoice()).toBe("default");
  });

  it('currentPaletteChoice returns "default" for an unknown pin', () => {
    localStorage.setItem(PALETTE_STORAGE_KEY, "neon-mango");
    expect(currentPaletteChoice()).toBe("default");
  });

  it("currentPaletteChoice surfaces a valid pinned ID verbatim", () => {
    localStorage.setItem(PALETTE_STORAGE_KEY, "manila");
    expect(currentPaletteChoice()).toBe("manila");
  });

  it('setPalette("default") clears the pin AND resolves DOM to active style\'s default', () => {
    setStyle("textbook");
    localStorage.setItem(PALETTE_STORAGE_KEY, "manila");
    setPalette("default");
    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.palette).toBe(STYLE_DEFAULT_PALETTE.textbook);
  });

  it("setPalette(<id>) writes both the pin and the DOM attribute", () => {
    setPalette("manila");
    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBe("manila");
    expect(document.documentElement.dataset.palette).toBe("manila");
    expect(currentPalette()).toBe("manila");
  });

  it("reapplyDefaultPaletteForCurrentStyle re-resolves DOM when on Default", () => {
    /* the "leaving Default selected and changing Style means the
     * palette changes too" contract. */
    setStyle("terminal");
    setPalette("default");
    expect(document.documentElement.dataset.palette).toBe(STYLE_DEFAULT_PALETTE.terminal);
    setStyle("glass");
    reapplyDefaultPaletteForCurrentStyle();
    expect(document.documentElement.dataset.palette).toBe(STYLE_DEFAULT_PALETTE.glass);
  });

  it("reapplyDefaultPaletteForCurrentStyle is a NO-OP when a custom palette is pinned", () => {
    /* the "custom pin persists across style switches" contract. */
    setPalette("manila");
    setStyle("textbook");
    reapplyDefaultPaletteForCurrentStyle();
    expect(document.documentElement.dataset.palette).toBe("manila");
  });

  it("PALETTE_HOME_STYLE maps every palette — drift guard", () => {
    /* If a future commit adds an ID to PALETTES but forgets the
     * PALETTE_HOME_STYLE entry, the settings UI's per-style
     * grouping silently breaks. This catches it. */
    expect(Object.keys(PALETTE_HOME_STYLE).sort()).toEqual([...PALETTES].sort());
  });

  it("currentPalette SSR fallback resolves through current style", () => {
    /* No DOM palette attribute set; currentPalette should fall
     * back to the active style's default rather than throwing or
     * returning undefined. */
    setStyle("islands");
    expect(currentPalette()).toBe(STYLE_DEFAULT_PALETTE.islands);
  });
});

describe("axes are independent", () => {
  it("setting density doesn't touch the colour theme attribute", () => {
    document.documentElement.dataset.theme = "dark";
    setDensity("compact");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("setting theme doesn't touch density / radius / style attributes", () => {
    setDensity("airy");
    setRadius("rounded");
    setStyle("glass");
    setTheme("light");
    expect(document.documentElement.dataset.density).toBe("airy");
    expect(document.documentElement.dataset.radius).toBe("rounded");
    expect(document.documentElement.dataset.style).toBe("glass");
  });

  it("setting style doesn't touch any other axis", () => {
    setTheme("light");
    setDensity("compact");
    setRadius("pill");
    setStyle("islands");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.density).toBe("compact");
    expect(document.documentElement.dataset.radius).toBe("pill");
  });
});

describe("theme — SSR path (no localStorage)", () => {
  /* Parallel to progress.test.ts's SSR section. The theme helpers
   * run inside the BaseLayout bootstrap script before paint; an SSR
   * crash on the no-localStorage path would block first frame. */
  beforeEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('currentChoice() returns "system" when localStorage is undefined', () => {
    expect(currentChoice()).toBe("system");
  });

  it('setTheme("dark") updates the DOM without throwing when localStorage is undefined', () => {
    expect(() => setTheme("dark")).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it('setTheme("system") re-derives from OS without throwing when localStorage is undefined', () => {
    expect(() => setTheme("system")).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("setDensity updates the DOM without throwing when localStorage is undefined", () => {
    expect(() => setDensity("compact")).not.toThrow();
    expect(document.documentElement.dataset.density).toBe("compact");
  });

  it("setRadius updates the DOM without throwing when localStorage is undefined", () => {
    expect(() => setRadius("rounded")).not.toThrow();
    expect(document.documentElement.dataset.radius).toBe("rounded");
  });

  it("setStyle updates the DOM without throwing when localStorage is undefined", () => {
    expect(() => setStyle("glass")).not.toThrow();
    expect(document.documentElement.dataset.style).toBe("glass");
  });
});
