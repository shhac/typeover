import { describe, expect, it } from "vitest";
import { evaluateBlanks, extractBlankPositions } from "./fill-blank";
import type { FillSegment } from "./generator";

/*
 * Tests for the FillBlankWord pure helpers. The "empty positions → both
 * false" guard exists because `Array.prototype.every` returns true on
 * an empty positions list — without the guard, a fill-word exercise
 * authored with `blanks: []` would silently auto-pass with no input.
 */

const text = (s: string): FillSegment => ({ kind: "text", text: s });
const blank = (varName: string, expected: string): FillSegment => ({
  kind: "blank",
  varName,
  expected,
});

describe("extractBlankPositions", () => {
  it("returns blank segments tagged with their original index", () => {
    const segs = [text("name = "), blank("name", "x"), text(" + "), blank("op", ":=")];
    expect(extractBlankPositions(segs)).toEqual([
      { idx: 1, seg: { kind: "blank", varName: "name", expected: "x" } },
      { idx: 3, seg: { kind: "blank", varName: "op", expected: ":=" } },
    ]);
  });

  it("returns [] for an all-text segment list", () => {
    expect(extractBlankPositions([text("a"), text("b")])).toEqual([]);
  });

  it("returns [] for an empty input", () => {
    expect(extractBlankPositions([])).toEqual([]);
  });

  it("preserves segment index for the same var appearing twice", () => {
    /* The component renders one input per occurrence — so two
     * positions with the same varName but different idx are correct. */
    const segs = [blank("x", "v"), text(" + "), blank("x", "v")];
    const positions = extractBlankPositions(segs);
    expect(positions.map((p) => p.idx)).toEqual([0, 2]);
  });
});

describe("evaluateBlanks", () => {
  const positions = [
    { idx: 1, seg: { kind: "blank" as const, varName: "x", expected: "1" } },
    { idx: 3, seg: { kind: "blank" as const, varName: "y", expected: "2" } },
  ];

  it("returns { allFilled: false, allCorrect: false } for empty positions (vacuous-truth guard)", () => {
    /* Array.prototype.every on [] returns true; without the guard,
     * a fill-word exercise authored with blanks: [] would auto-pass
     * with no input. */
    expect(evaluateBlanks([], {})).toEqual({
      allFilled: false,
      allCorrect: false,
    });
  });

  it("returns allFilled=false when at least one input is empty", () => {
    expect(evaluateBlanks(positions, { 1: "1" })).toEqual({
      allFilled: false,
      allCorrect: false,
    });
  });

  it("returns allFilled=true, allCorrect=false when filled but one is wrong", () => {
    expect(evaluateBlanks(positions, { 1: "1", 3: "wrong" })).toEqual({
      allFilled: true,
      allCorrect: false,
    });
  });

  it("returns allFilled=true, allCorrect=true when everything matches", () => {
    expect(evaluateBlanks(positions, { 1: "1", 3: "2" })).toEqual({
      allFilled: true,
      allCorrect: true,
    });
  });

  it("treats missing-key the same as empty string (both → not filled)", () => {
    expect(evaluateBlanks(positions, { 1: "1" }).allFilled).toBe(false);
    expect(evaluateBlanks(positions, { 1: "1", 3: "" }).allFilled).toBe(false);
  });
});
