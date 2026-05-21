import { afterEach, describe, expect, it } from "vitest";
import { isCodeMirrorTestEnv } from "./codemirror-test-env";

/* The codemirror-test-env marker is what flips CodeMirrorEditor /
 * CodeMirrorFillBlanks / McqOption into their plain-DOM fallbacks
 * inside vitest. If this predicate ever regresses, the entire
 * CodeMirror test surface stops finding the textarea/input/pre
 * shapes the test queries depend on — silently — because the
 * CodeMirror branch renders contentEditable spans that
 * `getByText` / `container.querySelector("input")` can't reach.
 *
 * vitest.setup.ts sets the attribute in beforeEach; these tests
 * verify the read side, plus the SSR-no-document path. */

describe("isCodeMirrorTestEnv", () => {
  /* Restore the marker after any test that flips it off. */
  afterEach(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-codemirror-test", "1");
    }
  });

  it("returns true when the marker is set on <html>", () => {
    /* vitest.setup.ts sets this in beforeEach. */
    expect(isCodeMirrorTestEnv()).toBe(true);
  });

  it("returns false when the marker is absent", () => {
    document.documentElement.removeAttribute("data-codemirror-test");
    expect(isCodeMirrorTestEnv()).toBe(false);
  });

  it("returns false when document is undefined (SSR path)", () => {
    const original = globalThis.document;
    /* Mimic SSR by removing the global document. The predicate
     * does a typeof check so it should treat the missing global
     * as "not test-env" rather than throwing. */
    Object.defineProperty(globalThis, "document", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    try {
      expect(isCodeMirrorTestEnv()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "document", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });
});
