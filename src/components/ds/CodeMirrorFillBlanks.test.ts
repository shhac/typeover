import { describe, expect, it } from "vitest";
import type { FillSegment } from "~/lib/generator-runtime";
import { buildDocAndRanges } from "./CodeMirrorFillBlanks";

/*
 * Pin `buildDocAndRanges`'s math. The function is pure — segments
 * → (joined doc string, per-blank from/to ranges). An off-by-one
 * here silently breaks decoration placement in production (widgets
 * mount at the wrong position; learner input lands outside the
 * expected blank). Tested in isolation because the CM scaffold's
 * jsdom fallback bypasses this function entirely (LegacyFallback
 * renders a span tree instead of the doc-with-decorations).
 */

describe("buildDocAndRanges", () => {
  it("returns empty doc + no ranges for empty segments", () => {
    expect(buildDocAndRanges([])).toEqual({ doc: "", blankRanges: [] });
  });

  it("joins text-only segments without altering content", () => {
    const segs: FillSegment[] = [
      { kind: "text", text: "hello " },
      { kind: "text", text: "world" },
    ];
    expect(buildDocAndRanges(segs)).toEqual({ doc: "hello world", blankRanges: [] });
  });

  it("substitutes blank expected values into the doc + records ranges", () => {
    const segs: FillSegment[] = [
      { kind: "text", text: "x := " },
      { kind: "blank", varName: "a", expected: "1" },
      { kind: "text", text: " + " },
      { kind: "blank", varName: "b", expected: "2" },
    ];
    const { doc, blankRanges } = buildDocAndRanges(segs);
    expect(doc).toBe("x := 1 + 2");
    expect(blankRanges).toHaveLength(2);
    /* First blank: at position 5 ("x := " is 5 chars), one-char wide. */
    expect(blankRanges[0]).toEqual({ from: 5, to: 6, slotIdx: 1, varName: "a", expected: "1" });
    /* Second blank: at position 9 ("x := 1 + " is 9 chars), one-char wide. */
    expect(blankRanges[1]).toEqual({ from: 9, to: 10, slotIdx: 3, varName: "b", expected: "2" });
  });

  it("handles multi-character expected values", () => {
    const segs: FillSegment[] = [
      { kind: "text", text: "fn " },
      { kind: "blank", varName: "name", expected: "greet" },
      { kind: "text", text: "() {}" },
    ];
    const { doc, blankRanges } = buildDocAndRanges(segs);
    expect(doc).toBe("fn greet() {}");
    expect(blankRanges[0]).toEqual({
      from: 3,
      to: 8 /* "greet" is 5 chars; 3 + 5 = 8 */,
      slotIdx: 1,
      varName: "name",
      expected: "greet",
    });
  });

  it("preserves slotIdx as the segment index (not the blank rank)", () => {
    /* If the same var appears twice (e.g. `${x} == ${x}`), each
     * occurrence is its own segment. The slotIdx tracks the
     * segment position so the two widgets render independently. */
    const segs: FillSegment[] = [
      { kind: "blank", varName: "x", expected: "1" },
      { kind: "text", text: " == " },
      { kind: "blank", varName: "x", expected: "1" },
    ];
    const { blankRanges } = buildDocAndRanges(segs);
    expect(blankRanges).toHaveLength(2);
    expect(blankRanges[0]?.slotIdx).toBe(0); /* first segment */
    expect(blankRanges[1]?.slotIdx).toBe(2); /* third segment, skip the text in between */
  });
});
