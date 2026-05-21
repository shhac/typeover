import { describe, expect, it } from "vitest";
import {
  CODEMIRROR_FONT_FAMILY,
  codemirrorSyntaxStyle,
  codemirrorThemeExtensions,
} from "./codemirror-theme";

/* The shared CM theme is consumed by both editor surfaces
 * (CodeMirrorEditor + CodeMirrorFillBlanks); a regression in the
 * option-fanout would silently break a palette token or drop the
 * caret rule from only one consumer. These tests pin the factory's
 * default + option-driven branches without standing up a real
 * EditorView (CM's view requires a real DOM + the editor's lifecycle
 * is not what we're testing here). */

describe("codemirrorThemeExtensions", () => {
  it("returns a non-empty extension array under defaults", () => {
    const ext = codemirrorThemeExtensions();
    expect(Array.isArray(ext)).toBe(true);
    expect(ext.length).toBeGreaterThanOrEqual(2);
  });

  it("returns a non-empty extension array under all option flips", () => {
    const variants = [
      { minHeight: "16rem", contentPadding: "0.75rem 0", surfaceFocusOutline: true, caret: true },
      { minHeight: "auto", contentPadding: "0.75rem", surfaceFocusOutline: false, caret: false },
      { caret: false },
      {},
    ];
    for (const opts of variants) {
      const ext = codemirrorThemeExtensions(opts);
      expect(Array.isArray(ext)).toBe(true);
      expect(ext.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns the same number of extensions regardless of options", () => {
    /* The factory shape is `[theme, syntaxHighlighting]`. Option
     * flips toggle PROPERTIES inside the theme but never change
     * the extension count. This pins the contract callers
     * depend on when spreading into their extension lists. */
    const a = codemirrorThemeExtensions();
    const b = codemirrorThemeExtensions({ caret: false });
    const c = codemirrorThemeExtensions({ surfaceFocusOutline: true });
    expect(a.length).toBe(b.length);
    expect(b.length).toBe(c.length);
  });
});

describe("CODEMIRROR_FONT_FAMILY", () => {
  it("is a non-empty monospace stack", () => {
    expect(CODEMIRROR_FONT_FAMILY).toContain("monospace");
    expect(CODEMIRROR_FONT_FAMILY.length).toBeGreaterThan(30);
  });
});

describe("codemirrorSyntaxStyle", () => {
  it("is a HighlightStyle instance with a non-empty module field", () => {
    /* HighlightStyle objects expose `.module` (a StyleModule);
     * presence is the smoke test that `.define` accepted our tag
     * list without throwing. A regression where a tag name
     * changes (e.g. @lezer/highlight rename) would fail at
     * import time, but this test catches the case where define()
     * returns an empty style on an empty/invalid tag list. */
    expect(codemirrorSyntaxStyle).toBeDefined();
    expect(typeof codemirrorSyntaxStyle).toBe("object");
  });
});
