import { describe, expect, it } from "vitest";
import { normaliseSubmission } from "./submission-normalise";

/* Direct unit tests for the load-bearing grading helper. The
 * function powers BOTH wrong-pattern feedback (a learner's typo of
 * an authored distractor should still trigger its targeted explain)
 * AND alternate-canonical grading (a perfect modern submission
 * grades correct even when Yaegi can't run it). A regression in
 * the case-folding or whitespace logic would silently weaken both
 * paths; these tests pin each transformation independently. */

describe("normaliseSubmission", () => {
  it("collapses interior whitespace runs to a single space", () => {
    expect(normaliseSubmission("a  b   c")).toBe("a b c");
    expect(normaliseSubmission("var  x   =  1")).toBe("var x = 1");
  });

  it("collapses tabs + newlines as whitespace, not just spaces", () => {
    expect(normaliseSubmission("a\tb\nc")).toBe("a b c");
    expect(normaliseSubmission("a\t\t b")).toBe("a b");
    expect(normaliseSubmission("x\r\ny")).toBe("x y");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normaliseSubmission("  hello  ")).toBe("hello");
    expect(normaliseSubmission("\thello\n")).toBe("hello");
  });

  it("lowercases for case-folding match", () => {
    expect(normaliseSubmission("Var x := 1")).toBe("var x := 1");
    expect(normaliseSubmission("USER := lookup(id)")).toBe("user := lookup(id)");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normaliseSubmission("")).toBeNull();
    expect(normaliseSubmission("   ")).toBeNull();
    expect(normaliseSubmission("\t\n\r ")).toBeNull();
  });

  it("is idempotent — normalising twice equals normalising once", () => {
    const inputs = ["VAR  x  :=  1", "  spaces\t\there  ", "PLAIN"];
    for (const s of inputs) {
      const once = normaliseSubmission(s);
      expect(once).not.toBeNull();
      expect(normaliseSubmission(once!)).toBe(once);
    }
    expect(normaliseSubmission("")).toBeNull();
  });

  it("preserves operators / punctuation literally", () => {
    expect(normaliseSubmission("a != nil && b == c")).toBe("a != nil && b == c");
    expect(normaliseSubmission("xs[0] = 99")).toBe("xs[0] = 99");
  });

  it("preserves go strings literally (modulo whitespace + case)", () => {
    expect(normaliseSubmission('fmt.Println("Hello, World!")')).toBe(
      'fmt.println("hello, world!")',
    );
  });
});
