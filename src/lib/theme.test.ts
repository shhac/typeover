import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentChoice,
  currentDensity,
  currentRadius,
  currentTheme,
  DENSITY_STORAGE_KEY,
  RADIUS_STORAGE_KEY,
  setDensity,
  setRadius,
  setTheme,
  STORAGE_KEY,
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

describe("axes are independent", () => {
  it("setting density doesn't touch the colour theme attribute", () => {
    document.documentElement.dataset.theme = "dark";
    setDensity("compact");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("setting theme doesn't touch density or radius attributes", () => {
    setDensity("airy");
    setRadius("rounded");
    setTheme("light");
    expect(document.documentElement.dataset.density).toBe("airy");
    expect(document.documentElement.dataset.radius).toBe("rounded");
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
});
