import { describe, expect, it } from "vitest";
import { buildCandidatePool, substituteAtBlank } from "./fill-blank";
import type { ExerciseInstance, FillSegment, GeneratorSpec } from "./generator";

/*
 * Tests for the fill-line candidate-pool helper. Pins:
 *  - pool = [picked vars value] + [substituted distractors]
 *  - dedupe (correct-in-distractors-by-mistake → one tile, not two)
 *  - same seed → same pool order (determinism contract for stable URLs)
 *  - different seeds → different pool orders
 *  - "::tiles" seed-namespace suffix is part of the contract
 *  - non-template generators → []
 *  - empty blanks → []
 *  - missing values + missing vars[blank] → []
 *  - distractors with ${refs} substitute against the same values map
 *
 * Shape: vars[blank] holds the correct answer(s); distractors holds
 * the wrong tiles. The framework picks one entry from vars[blank] as
 * the expected value (via the upstream useExerciseInstance call) and
 * combines it with the distractor pool for the tile shuffle.
 */

const CORRECT = "a, b := 1, 2";
const TEMPLATE: GeneratorSpec = {
  kind: "template",
  vars: {
    line: [CORRECT],
  },
  ts: "let a = 1, b = 2;",
  canonical: "${line}",
  distractors: ["a := 1, b := 2", "var a, b = 1, 2", "a, b = 1, 2", "let a, b = 1, 2"],
};

const VALUES = { line: CORRECT };

describe("buildCandidatePool", () => {
  it("returns the expected line + every distractor, shuffled", () => {
    const out = buildCandidatePool(TEMPLATE, VALUES, ["line"], "ex-1::0");
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual(
      [CORRECT, "a := 1, b := 2", "var a, b = 1, 2", "a, b = 1, 2", "let a, b = 1, 2"].sort(),
    );
    expect(out).toContain(CORRECT);
  });

  it("the picked vars value is always present (so the correct tile exists)", () => {
    /* The bug this rewrite closes: if vars[blank] held a mix of
     * correct + distractors and the rng landed on a distractor,
     * the "correct" tile was actually wrong. With the new shape,
     * vars[blank] is correct-only and the picked value IS the
     * expected the BlankInput grades against. Pin: across many
     * seeds, the picked value is always in the pool. */
    for (let i = 0; i < 20; i++) {
      const out = buildCandidatePool(TEMPLATE, VALUES, ["line"], `ex::${i}`);
      expect(out).toContain(CORRECT);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(buildCandidatePool(TEMPLATE, VALUES, ["line"], "ex-1::0")).toEqual(
      buildCandidatePool(TEMPLATE, VALUES, ["line"], "ex-1::0"),
    );
  });

  it("produces different orders across seeds (probabilistic)", () => {
    const observed = new Set<string>();
    for (let i = 0; i < 10; i++) {
      observed.add(buildCandidatePool(TEMPLATE, VALUES, ["line"], `ex::${i}`).join("|"));
    }
    expect(observed.size).toBeGreaterThan(1);
  });

  it("namespaces the seed with ::tiles (changing the seed shifts the order)", () => {
    const a = buildCandidatePool(TEMPLATE, VALUES, ["line"], "fixed-seed");
    const b = buildCandidatePool(TEMPLATE, VALUES, ["line"], "fixed-seed-other");
    expect(a).not.toEqual(b);
  });

  it("dedupes when an author accidentally lists the correct line in distractors too", () => {
    const tpl: GeneratorSpec = {
      kind: "template",
      vars: { line: ["correct"] },
      ts: "anything",
      canonical: "${line}",
      distractors: ["correct", "wrong-1", "wrong-2"],
    };
    const out = buildCandidatePool(tpl, { line: "correct" }, ["line"], "seed");
    expect(out).toHaveLength(3);
    expect(out.filter((v) => v === "correct")).toHaveLength(1);
  });

  it("substitutes ${refs} in distractors against the values map", () => {
    const tpl: GeneratorSpec = {
      kind: "template",
      vars: { line: ["x := 5"], name: ["x"], value: ["5"] },
      ts: "anything",
      canonical: "${line}",
      distractors: ["var ${name} = ${value}", "${name} = ${value}"],
    };
    const out = buildCandidatePool(
      tpl,
      { line: "x := 5", name: "x", value: "5" },
      ["line"],
      "seed",
    );
    expect(out).toContain("x := 5");
    expect(out).toContain("var x = 5");
    expect(out).toContain("x = 5");
  });

  it("returns [] for a non-template generator (variant)", () => {
    const variant: GeneratorSpec = {
      kind: "variant",
      variants: [{ id: "v1", ts: "x", canonical: "y" }],
    };
    expect(buildCandidatePool(variant, undefined, ["line"], "any")).toEqual([]);
  });

  it("returns [] for a non-template generator (procedural)", () => {
    const proc: GeneratorSpec = { kind: "procedural", module: "irrelevant" };
    expect(buildCandidatePool(proc, undefined, ["line"], "any")).toEqual([]);
  });

  it("returns [] for an empty blanks list", () => {
    expect(buildCandidatePool(TEMPLATE, VALUES, [], "any")).toEqual([]);
  });

  it("returns [] when the blank var isn't in spec.vars and values is undefined", () => {
    expect(buildCandidatePool(TEMPLATE, undefined, ["nope"], "any")).toEqual([]);
  });

  it("falls back to vars[blank][0] when values is undefined (test convenience)", () => {
    /* Lets callers that don't go through useExerciseInstance still
     * exercise the helper. Pinned so we don't accidentally tighten
     * the contract. */
    const out = buildCandidatePool(TEMPLATE, undefined, ["line"], "seed");
    expect(out).toContain(CORRECT);
  });
});

describe("substituteAtBlank", () => {
  const makeInstance = (segments: FillSegment[]): ExerciseInstance => ({
    ts: "",
    canonical: "",
    blankSegments: segments,
  });

  it("substitutes the user's line at the blank position", () => {
    const instance = makeInstance([
      { kind: "text", text: "before\n" },
      { kind: "blank", varName: "line", expected: "x := 1" },
      { kind: "text", text: "\nafter" },
    ]);
    expect(substituteAtBlank(instance, "y := 2")).toBe("before\ny := 2\nafter");
  });

  it("preserves the scaffold around the blank exactly", () => {
    const instance = makeInstance([
      { kind: "text", text: 'package main\n\nimport "fmt"\n\nfunc main() {\n\t' },
      { kind: "blank", varName: "line", expected: "doubled := count * 2" },
      { kind: "text", text: "\n\tfmt.Println(doubled)\n}" },
    ]);
    expect(substituteAtBlank(instance, "doubled := count * 2")).toBe(
      'package main\n\nimport "fmt"\n\nfunc main() {\n\tdoubled := count * 2\n\tfmt.Println(doubled)\n}',
    );
  });

  it("returns empty string when there are no segments (defence in depth)", () => {
    const instance: ExerciseInstance = { ts: "", canonical: "" };
    expect(substituteAtBlank(instance, "anything")).toBe("");
  });

  it("substitutes the same userLine into every blank when multiple blanks exist", () => {
    /* Today fill-line components only declare one blank, but the
     * helper is segment-agnostic — pin the contract so a future
     * multi-blank surface knows what it gets. */
    const instance = makeInstance([
      { kind: "blank", varName: "a", expected: "1" },
      { kind: "text", text: " + " },
      { kind: "blank", varName: "b", expected: "2" },
    ]);
    expect(substituteAtBlank(instance, "X")).toBe("X + X");
  });

  it("handles the no-blank case (variant generator → no blankSegments)", () => {
    const instance = makeInstance([{ kind: "text", text: "plain text only" }]);
    expect(substituteAtBlank(instance, "ignored")).toBe("plain text only");
  });
});
