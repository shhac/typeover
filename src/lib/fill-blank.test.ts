import { describe, expect, it } from "vitest";
import {
  buildCandidatePool,
  evaluateBlanks,
  extractBlankPositions,
  substituteAtBlank,
  type BlankPosition,
} from "./fill-blank";
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

describe("extractBlankPositions", () => {
  const text = (s: string): FillSegment => ({ kind: "text", text: s });
  const blank = (varName: string, expected: string): FillSegment => ({
    kind: "blank",
    varName,
    expected,
  });

  it("returns the blank segments tagged with their original segment indices", () => {
    const segments: FillSegment[] = [
      text("var "),
      blank("name", "age"),
      text(" "),
      blank("type", "int"),
      text(" = 42"),
    ];
    expect(extractBlankPositions(segments)).toEqual([
      { idx: 1, seg: { kind: "blank", varName: "name", expected: "age" } },
      { idx: 3, seg: { kind: "blank", varName: "type", expected: "int" } },
    ]);
  });

  it("returns [] when the segment stream has no blanks (variant generator shape)", () => {
    const segments: FillSegment[] = [text("plain text only")];
    expect(extractBlankPositions(segments)).toEqual([]);
  });

  it("returns [] for an empty segment stream", () => {
    expect(extractBlankPositions([])).toEqual([]);
  });

  it("preserves the repeated-blank case as TWO independent positions", () => {
    /* `${x} == ${x}` renders two BlankInputs that share the same
     * varName but get independent slot keys via their segment idx —
     * critical for the FillBlankWord component's per-input state. */
    const segments: FillSegment[] = [blank("x", "a"), text(" == "), blank("x", "a")];
    const positions = extractBlankPositions(segments);
    expect(positions).toHaveLength(2);
    expect(positions[0]!.idx).toBe(0);
    expect(positions[1]!.idx).toBe(2);
    /* Both share varName + expected, but the consumer keys on idx. */
    expect(positions[0]!.seg.varName).toBe(positions[1]!.seg.varName);
  });

  it("does not mutate the input array order", () => {
    const segments: FillSegment[] = [blank("a", "x"), text("|"), blank("b", "y")];
    const before = [...segments];
    extractBlankPositions(segments);
    expect(segments).toEqual(before);
  });
});

describe("evaluateBlanks — vacuous-truth guard", () => {
  /* The load-bearing contract per fill-blank.ts:46. `Array.every`
   * returns true on an empty array; a regression that drops the
   * positions.length===0 short-circuit would silently auto-pass any
   * fill-word authored with `blanks: []`. */
  it("returns both flags false when positions is empty (NOT true)", () => {
    expect(evaluateBlanks([], {})).toEqual({ allFilled: false, allCorrect: false });
  });

  it("returns both flags false when positions is empty even when inputs has entries", () => {
    /* Inputs map keyed against non-existent positions must not flip
     * the guard to true. */
    expect(evaluateBlanks([], { 0: "anything", 5: "stuff" })).toEqual({
      allFilled: false,
      allCorrect: false,
    });
  });
});

describe("evaluateBlanks — allFilled", () => {
  const pos = (idx: number, expected: string): BlankPosition => ({
    idx,
    seg: { kind: "blank", varName: `v${idx}`, expected },
  });

  it("is false when any position has no input entry", () => {
    expect(evaluateBlanks([pos(1, "a"), pos(2, "b")], { 1: "a" }).allFilled).toBe(false);
  });

  it("is false when any position has an empty-string input", () => {
    expect(evaluateBlanks([pos(1, "a"), pos(2, "b")], { 1: "a", 2: "" }).allFilled).toBe(false);
  });

  it("is true when every position has a non-empty string (regardless of correctness)", () => {
    expect(
      evaluateBlanks([pos(1, "a"), pos(2, "b")], { 1: "wrong", 2: "also-wrong" }).allFilled,
    ).toBe(true);
  });

  it("treats undefined inputs[idx] same as empty (the `?? ''` fallback)", () => {
    /* Spec: positions whose slot was never typed-into appear as
     * undefined in the inputs map. The helper coerces to "" so the
     * filled-check is consistent. */
    expect(evaluateBlanks([pos(1, "a")], {}).allFilled).toBe(false);
  });
});

describe("evaluateBlanks — allCorrect", () => {
  const pos = (idx: number, expected: string): BlankPosition => ({
    idx,
    seg: { kind: "blank", varName: `v${idx}`, expected },
  });

  it("is true when every position matches its expected exactly", () => {
    expect(evaluateBlanks([pos(0, "var"), pos(2, "int")], { 0: "var", 2: "int" }).allCorrect).toBe(
      true,
    );
  });

  it("is false when any position mismatches expected", () => {
    expect(
      evaluateBlanks([pos(0, "var"), pos(2, "int")], { 0: "var", 2: "string" }).allCorrect,
    ).toBe(false);
  });

  it("matches by EXACT string — no trimming, no case-folding", () => {
    /* Submission-normalisation is the consumer's job; this helper
     * is intentionally strict-equality on the typed value. */
    expect(evaluateBlanks([pos(0, "var")], { 0: " var" }).allCorrect).toBe(false);
    expect(evaluateBlanks([pos(0, "var")], { 0: "VAR" }).allCorrect).toBe(false);
    expect(evaluateBlanks([pos(0, "var")], { 0: "var " }).allCorrect).toBe(false);
  });

  it("the same canonical blank repeated at two slots must BOTH match independently", () => {
    /* The `${x} == ${x}` case: positions share varName+expected,
     * but the inputs map keys on slot idx — each occurrence is
     * graded separately. */
    const positions = [pos(0, "a"), pos(2, "a")];
    expect(evaluateBlanks(positions, { 0: "a", 2: "a" }).allCorrect).toBe(true);
    expect(evaluateBlanks(positions, { 0: "a", 2: "b" }).allCorrect).toBe(false);
    expect(evaluateBlanks(positions, { 0: "b", 2: "a" }).allCorrect).toBe(false);
  });

  it("is false when a position's input is empty (allCorrect requires equality with non-empty expected)", () => {
    /* Empty string can only match an expected of empty string; the
     * fill-blank schema rejects empty expected at authoring time, so
     * an empty input always fails allCorrect. */
    expect(evaluateBlanks([pos(0, "var")], { 0: "" }).allCorrect).toBe(false);
  });
});
