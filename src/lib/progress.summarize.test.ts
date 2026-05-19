import { beforeEach, describe, expect, it } from "vitest";
import { recordInstancePassed, recordInstanceSeen, summarizeTheme } from "./progress";

/*
 * summarizeTheme — the single source of truth for the "theme
 * complete" predicate per design-docs/11. ModuleCompleteCard and
 * ProgressChip both call it; the test pins the contract so they
 * can't drift apart.
 *
 * Relies on the vitest.setup localStorage shim (fresh per test).
 */

describe("summarizeTheme — empty input", () => {
  it("returns zeros and themeComplete: false on empty list", () => {
    expect(summarizeTheme([])).toEqual({ passed: 0, total: 0, themeComplete: false });
  });

  it("treats a never-touched theme as 0/N, themeComplete: false", () => {
    expect(summarizeTheme(["a", "b", "c"])).toEqual({
      passed: 0,
      total: 3,
      themeComplete: false,
    });
  });
});

describe("summarizeTheme — partial pass", () => {
  beforeEach(() => {
    recordInstanceSeen("foundations/x/01");
    recordInstancePassed("foundations/x/01");
    recordInstanceSeen("foundations/x/02");
    /* exercise 02 was seen but not passed */
  });

  it("counts exercises with instancesPassed > 0", () => {
    const s = summarizeTheme(["foundations/x/01", "foundations/x/02", "foundations/x/03"]);
    expect(s.passed).toBe(1);
    expect(s.total).toBe(3);
    expect(s.themeComplete).toBe(false);
  });
});

describe("summarizeTheme — full pass", () => {
  beforeEach(() => {
    for (const id of ["foundations/y/01", "foundations/y/02", "foundations/y/03"]) {
      recordInstanceSeen(id);
      recordInstancePassed(id);
    }
  });

  it("flips themeComplete to true when every exercise passed", () => {
    const s = summarizeTheme(["foundations/y/01", "foundations/y/02", "foundations/y/03"]);
    expect(s).toEqual({ passed: 3, total: 3, themeComplete: true });
  });

  it("themeComplete stays false if an unrelated id is included that isn't passed", () => {
    const s = summarizeTheme([
      "foundations/y/01",
      "foundations/y/02",
      "foundations/y/03",
      "foundations/y/04",
    ]);
    expect(s).toEqual({ passed: 3, total: 4, themeComplete: false });
  });
});

describe("summarizeTheme — pin: empty theme is NOT complete", () => {
  it("total: 0 means themeComplete: false (no false-credit for stub themes)", () => {
    expect(summarizeTheme([]).themeComplete).toBe(false);
  });
});
