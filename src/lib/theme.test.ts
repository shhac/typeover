import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentChoice, currentTheme, setTheme, STORAGE_KEY } from "./theme";

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
   * test. Reset the DOM attribute too. */
  delete document.documentElement.dataset.theme;
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
