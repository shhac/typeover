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
