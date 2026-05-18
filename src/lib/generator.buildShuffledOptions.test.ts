import { describe, expect, it } from "vitest";
import { buildShuffledOptions } from "./generator";
import { mulberry32 } from "./seed";

/*
 * Direct tests for the MCQ dedup + shuffle bottleneck. Pinned per
 * design-docs/12-test-plan.md P0 cases. The function is small but
 * load-bearing: it decides every MCQ's options array and where the
 * canonical lives in it.
 */

describe("buildShuffledOptions", () => {
  it("returns just the canonical when distractors is empty", () => {
    const out = buildShuffledOptions(mulberry32(0), "ans", []);
    expect(out.options).toEqual(["ans"]);
    expect(out.correctIndex).toBe(0);
  });

  it("dedupes distractors that exactly equal the canonical", () => {
    const out = buildShuffledOptions(mulberry32(0), "ans", ["ans", "ans"]);
    expect(out.options).toEqual(["ans"]);
    expect(out.correctIndex).toBe(0);
  });

  it("keeps non-duplicate distractors and points correctIndex at the canonical", () => {
    const out = buildShuffledOptions(mulberry32(0), "ans", ["a", "b", "ans"]);
    expect(out.options).toHaveLength(3);
    expect(out.options).toContain("ans");
    expect(out.options).toContain("a");
    expect(out.options).toContain("b");
    expect(out.options[out.correctIndex]).toBe("ans");
  });

  it("is deterministic for the same rng seed", () => {
    const a = buildShuffledOptions(mulberry32(42), "ans", ["d1", "d2", "d3"]);
    const b = buildShuffledOptions(mulberry32(42), "ans", ["d1", "d2", "d3"]);
    expect(a).toEqual(b);
  });

  it("drops only the duplicate, keeping other distractors intact", () => {
    /* "a" appears as both distractor and canonical — drop just it,
     * leaving "b" and "c" alongside the canonical. */
    const out = buildShuffledOptions(mulberry32(0), "a", ["a", "b", "c"]);
    expect(out.options).toHaveLength(3);
    expect(out.options.filter((o) => o === "a")).toHaveLength(1);
    expect(out.options[out.correctIndex]).toBe("a");
  });
});
