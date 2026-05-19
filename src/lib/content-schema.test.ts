import { describe, expect, it } from "vitest";
import { exerciseSchema } from "./content-schema";
import { GeneratorSchema } from "./generator";

/*
 * Cross-field refinement tests (task #38). The runtime tests for
 * generator.ts itself cover happy-path parsing of valid specs; these
 * tests pin the build-time rejections that protect authoring.
 *
 * Shape of the helpers below:
 *   - tplGen: build a minimal template GeneratorSchema input.
 *   - mcqEx: build a minimal exercise wrapped around that generator.
 *
 * Tests assert on the issue path so the error points the author to
 * the exact field that needs fixing.
 */

const tplGen = (
  overrides: Partial<{
    vars: Record<string, string[]>;
    ts: string;
    canonical: string;
    distractors: string[];
  }> = {},
) => ({
  kind: "template" as const,
  vars: { x: ["1"] },
  ts: "${x}",
  canonical: "${x}",
  ...overrides,
});

const variantGen = (
  variants: Array<{ id: string; ts: string; canonical: string; distractors?: string[] }>,
) => ({
  kind: "variant" as const,
  variants,
});

const baseEx = (overrides: Record<string, unknown> = {}) => ({
  target: "go" as const,
  themeId: "foundations/variables",
  type: "mcq" as const,
  order: 1,
  prompt: "p",
  generator: tplGen({ distractors: ["${x}+1"] }),
  hints: ["a", "b", "c"] as [string, string, string],
  ...overrides,
});

const paths = (issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>) =>
  issues.map((i) => i.path.map(String).join("."));

describe("GeneratorSchema — template refinements (#38)", () => {
  it("rejects an empty value pool", () => {
    const r = GeneratorSchema.safeParse(tplGen({ vars: { x: [] }, ts: "${x}", canonical: "${x}" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("vars.x");
  });

  it("rejects an undeclared var in `ts`", () => {
    const r = GeneratorSchema.safeParse(
      tplGen({ vars: { x: ["1"] }, ts: "${y}", canonical: "${x}" }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(paths(r.error.issues)).toContain("ts");
      expect(r.error.issues[0]!.message).toContain("${y}");
    }
  });

  it("rejects an undeclared var in `canonical`", () => {
    const r = GeneratorSchema.safeParse(
      tplGen({ vars: { x: ["1"] }, ts: "${x}", canonical: "${zz}" }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("canonical");
  });

  it("rejects an undeclared var in distractors and pinpoints the index", () => {
    const r = GeneratorSchema.safeParse(
      tplGen({
        vars: { x: ["1"] },
        ts: "${x}",
        canonical: "${x}",
        distractors: ["${x}", "${nope}"],
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("distractors.1");
  });

  it("accepts a well-formed template with no placeholders and empty vars", () => {
    /* vars: {} is fine when ts/canonical have no ${refs}. */
    const r = GeneratorSchema.safeParse({
      kind: "template",
      vars: {},
      ts: "literal",
      canonical: "literal",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a well-formed template referencing all declared vars", () => {
    const r = GeneratorSchema.safeParse(
      tplGen({
        vars: { a: ["1"], b: ["2"] },
        ts: "${a}+${b}",
        canonical: "${a}+${b}",
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe("GeneratorSchema — variant refinements (#38)", () => {
  it("rejects an empty variants array", () => {
    const r = GeneratorSchema.safeParse(variantGen([]));
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("variants");
  });

  it("rejects duplicate variant IDs and pinpoints the second occurrence", () => {
    const r = GeneratorSchema.safeParse(
      variantGen([
        { id: "a", ts: "1", canonical: "1" },
        { id: "a", ts: "2", canonical: "2" },
      ]),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(paths(r.error.issues)).toContain("variants.1.id");
      expect(r.error.issues[0]!.message).toContain("index 0");
    }
  });

  it("accepts variants with unique IDs", () => {
    const r = GeneratorSchema.safeParse(
      variantGen([
        { id: "a", ts: "1", canonical: "1" },
        { id: "b", ts: "2", canonical: "2" },
      ]),
    );
    expect(r.success).toBe(true);
  });
});

describe("exerciseSchema — fill-* require non-empty blanks (#38)", () => {
  it("rejects fill-word without blanks", () => {
    const r = exerciseSchema.safeParse(baseEx({ type: "fill-word", generator: tplGen() }));
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("blanks");
  });

  it("rejects fill-word with empty blanks", () => {
    const r = exerciseSchema.safeParse(
      baseEx({ type: "fill-word", blanks: [], generator: tplGen() }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("blanks");
  });

  it("rejects fill-line without blanks", () => {
    const r = exerciseSchema.safeParse(baseEx({ type: "fill-line", generator: tplGen() }));
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("blanks");
  });

  it("rejects fill-word with a variant generator", () => {
    const r = exerciseSchema.safeParse(
      baseEx({
        type: "fill-word",
        blanks: ["x"],
        generator: variantGen([{ id: "a", ts: "1", canonical: "1", distractors: ["2"] }]),
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("generator.kind");
  });

  it("rejects fill-word with a blank that's not a declared template var", () => {
    const r = exerciseSchema.safeParse(
      baseEx({
        type: "fill-word",
        blanks: ["typo"],
        generator: tplGen({ vars: { x: ["1"] }, ts: "${x}", canonical: "${x}" }),
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("blanks.0");
  });

  it("accepts a well-formed fill-word", () => {
    const r = exerciseSchema.safeParse(
      baseEx({
        type: "fill-word",
        blanks: ["x"],
        generator: tplGen({ vars: { x: ["1"] }, ts: "${x}", canonical: "${x}" }),
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe("exerciseSchema — MCQ requires distractors (#38)", () => {
  it("rejects an MCQ template generator with no distractors", () => {
    const r = exerciseSchema.safeParse(
      baseEx({ type: "mcq", generator: tplGen({ distractors: [] }) }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("generator.distractors");
  });

  it("rejects an MCQ variant where any variant has no distractors", () => {
    const r = exerciseSchema.safeParse(
      baseEx({
        type: "mcq",
        generator: variantGen([
          { id: "a", ts: "1", canonical: "1", distractors: ["2"] },
          { id: "b", ts: "1", canonical: "1" }, // missing distractors
        ]),
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("generator.variants.1.distractors");
  });

  it("accepts an MCQ with a template generator + distractors", () => {
    const r = exerciseSchema.safeParse(
      baseEx({
        type: "mcq",
        generator: tplGen({ distractors: ["${x}+1"] }),
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe("exerciseSchema — stray blanks on non-fill types (#38)", () => {
  it("rejects MCQ with blanks set (likely copy-paste from a fill exercise)", () => {
    const r = exerciseSchema.safeParse(
      baseEx({
        type: "mcq",
        blanks: ["x"],
        generator: tplGen({ distractors: ["${x}+1"] }),
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(paths(r.error.issues)).toContain("blanks");
  });

  it("accepts freeform with no blanks", () => {
    const r = exerciseSchema.safeParse(baseEx({ type: "freeform", generator: tplGen() }));
    expect(r.success).toBe(true);
  });
});
