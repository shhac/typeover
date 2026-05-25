import { describe, expect, it } from "vitest";
import { matchesAcceptedAnswer, matchKnownAttempt } from "./fill-line-attempts";

describe("fill-line attempt matching", () => {
  it("matches accepted answers with whitespace normalization", () => {
    expect(
      matchesAcceptedAnswer("foo  *  2", [{ match: "foo * 2", prebake: true }], undefined),
    ).toEqual({ match: "foo * 2", prebake: true });
  });

  it("substitutes template vars before matching", () => {
    expect(
      matchesAcceptedAnswer("count * 2", [{ match: "${name} * 2" }], { name: "count" }),
    ).toEqual({ match: "${name} * 2" });
  });

  it("returns a synthetic RunResult for a known attempt", () => {
    expect(
      matchKnownAttempt(
        "foo + 2",
        [
          {
            match: "foo + 2",
            outcome: "wrong-output",
            stdout: "23\n",
            stderr: "",
            error: "",
            explain: "That adds instead of doubles.",
          },
        ],
        undefined,
      ),
    ).toEqual({
      match: "foo + 2",
      outcome: "wrong-output",
      stdout: "23\n",
      stderr: "",
      error: "",
      explain: "That adds instead of doubles.",
      runResult: { stdout: "23\n", stderr: "", error: "", durationMs: 0 },
    });
  });
});

describe("matchesAcceptedAnswer — empty-target guard + miss cases", () => {
  /* The `if (target === "") return null` short-circuit is load-
   * bearing: without it, an authored `acceptedAnswers: [{ match: "" }]`
   * (or a whitespace-only entry that normalises to "") would
   * silently auto-pass any blank submission. Pin every branch of
   * the guard + miss matrix. */

  it("returns null for an empty submission against a non-empty list", () => {
    expect(
      matchesAcceptedAnswer("", [{ match: "foo * 2" }], undefined),
    ).toBeNull();
  });

  it("returns null for a whitespace-only submission (normaliseSubmission trims)", () => {
    /* normaliseSubmission collapses whitespace; an all-spaces
     * submission becomes "", which the empty-target guard rejects. */
    expect(
      matchesAcceptedAnswer("   \t  ", [{ match: "foo" }], undefined),
    ).toBeNull();
  });

  it("returns null for an empty submission EVEN when the list contains an empty match (the load-bearing guard)", () => {
    /* This is the regression-pinning case. Without the empty-target
     * short-circuit, both sides would normalise to "" and the
     * `===` check would return true — silently auto-passing the
     * blank submission as a "correct" answer. */
    expect(
      matchesAcceptedAnswer("", [{ match: "" }], undefined),
    ).toBeNull();
  });

  it("returns null for an undefined acceptedAnswers list", () => {
    /* `acceptedAnswers` is optional on the exercise schema; the
     * function must tolerate undefined and return null. */
    expect(matchesAcceptedAnswer("foo", undefined, undefined)).toBeNull();
  });

  it("returns null for an empty acceptedAnswers list", () => {
    expect(matchesAcceptedAnswer("foo", [], undefined)).toBeNull();
  });

  it("returns null when no entry in the list matches", () => {
    expect(
      matchesAcceptedAnswer(
        "foo * 3",
        [
          { match: "foo * 2" },
          { match: "bar * 2" },
        ],
        undefined,
      ),
    ).toBeNull();
  });
});

describe("matchKnownAttempt — empty-target guard + defaults", () => {
  /* Same guard as the accepted-answer matcher, plus the synthetic
   * RunResult default-fill contract (missing stdout/stderr/error/
   * durationMs default to ""/0). */

  it("returns null for an empty submission against a non-empty list", () => {
    expect(
      matchKnownAttempt(
        "",
        [{ match: "foo + 2", outcome: "wrong-output", explain: "…" }],
        undefined,
      ),
    ).toBeNull();
  });

  it("returns null for an undefined knownAttempts list", () => {
    expect(matchKnownAttempt("foo", undefined, undefined)).toBeNull();
  });

  it("returns null when no entry matches", () => {
    expect(
      matchKnownAttempt(
        "not in list",
        [{ match: "foo + 2", outcome: "wrong-output", explain: "…" }],
        undefined,
      ),
    ).toBeNull();
  });

  it("defaults missing stdout/stderr/error/durationMs to ''/0 in the synthetic RunResult", () => {
    /* The author can omit any of the four fields — the matcher fills
     * defaults so downstream grading reads a complete RunResult
     * shape. Pin this so a defaulting regression doesn't surface
     * as a confusing undefined in the result panel. */
    const result = matchKnownAttempt(
      "foo + 2",
      [
        {
          match: "foo + 2",
          outcome: "does-not-compile",
          explain: "Missing trailing semicolon.",
        },
      ],
      undefined,
    );
    expect(result).not.toBeNull();
    if (result) {
      expect(result.runResult).toEqual({
        stdout: "",
        stderr: "",
        error: "",
        durationMs: 0,
      });
    }
  });
});
