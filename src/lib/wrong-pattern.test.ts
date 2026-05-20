import { describe, expect, it } from "vitest";
import { matchWrongPattern } from "./wrong-pattern";

/*
 * matchWrongPattern — fill-line wrong-pattern feedback per
 * design-docs/99. The lib is the matcher; FillBlankLineInput is
 * the consumer. Tests pin the whitespace-normalisation contract
 * + back-compat with bare-string distractors.
 */

describe("matchWrongPattern", () => {
  it("returns null when distractors is undefined", () => {
    expect(matchWrongPattern("doubled := count * 2", undefined)).toBeNull();
  });

  it("returns null when distractors is empty", () => {
    expect(matchWrongPattern("doubled := count * 2", [])).toBeNull();
  });

  it("returns null when submission is empty / whitespace", () => {
    expect(matchWrongPattern("", [{ match: "x", explain: "y" }])).toBeNull();
    expect(matchWrongPattern("   ", [{ match: "x", explain: "y" }])).toBeNull();
  });

  it("matches a structured entry exactly and returns its explain", () => {
    const result = matchWrongPattern("var doubled = count * 2", [
      { match: "var doubled = count * 2", explain: "Use := inside a function." },
    ]);
    expect(result).toEqual({ explain: "Use := inside a function." });
  });

  it("normalises whitespace — extra interior spaces still match", () => {
    /* Whitespace runs collapse to a single space, but the lib does
     * NOT normalise operator spacing (missing space around `=` or
     * `*` is genuinely a different shape). Extras collapse; gaps
     * stay gaps. */
    const result = matchWrongPattern("var  doubled  =  count  *  2", [
      { match: "var doubled = count * 2", explain: "Use := inside a function." },
    ]);
    expect(result).toEqual({ explain: "Use := inside a function." });
  });

  it("does NOT match when operator spacing differs", () => {
    /* Pin: matchWrongPattern is intentionally conservative — it
     * normalises whitespace runs but doesn't strip them entirely.
     * "count*2" and "count * 2" are genuinely different shapes; a
     * future AST-equivalence pass could collapse them but v0
     * doesn't. */
    expect(
      matchWrongPattern("var doubled = count*2", [
        { match: "var doubled = count * 2", explain: "x" },
      ]),
    ).toBeNull();
  });

  it("normalises whitespace via leading/trailing trim", () => {
    const result = matchWrongPattern("  var doubled = count * 2  ", [
      { match: "var doubled = count * 2", explain: "explanation" },
    ]);
    expect(result).toEqual({ explain: "explanation" });
  });

  it("returns null when nothing in the bank matches", () => {
    expect(
      matchWrongPattern("doubled = count + 2", [
        { match: "var doubled = count * 2", explain: "x" },
        { match: "const doubled := count * 2", explain: "y" },
      ]),
    ).toBeNull();
  });

  it("treats a matched bare-string distractor as 'no explanation' (back-compat)", () => {
    /* The bare-string form is the v0 shape — still a known wrong
     * pattern but no authored explanation. The caller falls back
     * to the generic wrong message. */
    expect(matchWrongPattern("var doubled = count * 2", ["var doubled = count * 2"])).toBeNull();
  });

  it("mixed bank: bare strings pass through, structured entries fire", () => {
    const distractors = [
      "let doubled = count * 2", // bare — no explain
      { match: "var doubled = count * 2", explain: "Use := inside a function." },
    ];
    expect(matchWrongPattern("let doubled = count * 2", distractors)).toBeNull();
    expect(matchWrongPattern("var doubled = count * 2", distractors)).toEqual({
      explain: "Use := inside a function.",
    });
  });

  it("case-insensitive match — learner's TS-habit capitalisation still fires distractor", () => {
    /* design-docs/19 F-16. A learner who types `Var doubled = count * 2`
     * out of TS habit should still trip the authored distractor
     * explainer; the Go compiler error they'd get otherwise isn't
     * specific enough to be useful. Authored display stays exact. */
    expect(
      matchWrongPattern("Var doubled = count * 2", [
        { match: "var doubled = count * 2", explain: "Use := inside a function." },
      ]),
    ).toEqual({ explain: "Use := inside a function." });
  });

  it("first matching entry wins (authoring order matters)", () => {
    const result = matchWrongPattern("x", [
      { match: "x", explain: "first" },
      { match: "x", explain: "second" },
    ]);
    expect(result).toEqual({ explain: "first" });
  });
});
