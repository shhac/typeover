import { describe, expect, it } from "vitest";
import { extractCanonicals, type ExerciseYaml } from "./prebake-compile-cache.ts";

/* Pin the "all variants get baked, not just variants[0]" contract.
 * The Rust track today has one freeform exercise with a single
 * canonical, so the multi-variant path doesn't fire in production
 * yet — but if a future exercise authors N variants and the
 * extractor regresses to `variants[0]`, learners on the other
 * variants quietly pay the cold-compile cost. */

const TEMPLATE_FREEFORM: ExerciseYaml = {
  target: "rust",
  themeId: "rust/foundations/hello",
  type: "freeform",
  order: 4,
  runtime: "server",
  generator: {
    kind: "template",
    canonical: 'fn main() { println!("hi"); }',
  },
};

describe("extractCanonicals", () => {
  it("returns the single canonical for a template freeform", () => {
    expect(extractCanonicals(TEMPLATE_FREEFORM)).toEqual([
      'fn main() { println!("hi"); }',
    ]);
  });

  it("returns every variant's canonical (not just variants[0])", () => {
    const variant: ExerciseYaml = {
      target: "rust",
      themeId: "rust/foundations/hello",
      type: "freeform",
      order: 4,
      runtime: "server",
      generator: {
        kind: "variant",
        variants: [
          { canonical: 'fn main() { println!("a"); }' },
          { canonical: 'fn main() { println!("b"); }' },
          { canonical: 'fn main() { println!("c"); }' },
        ],
      },
    };
    expect(extractCanonicals(variant)).toEqual([
      'fn main() { println!("a"); }',
      'fn main() { println!("b"); }',
      'fn main() { println!("c"); }',
    ]);
  });

  it("skips exercises whose runtime isn't `server`", () => {
    expect(
      extractCanonicals({ ...TEMPLATE_FREEFORM, runtime: "yaegi" }),
    ).toEqual([]);
    expect(
      extractCanonicals({ ...TEMPLATE_FREEFORM, runtime: "none" }),
    ).toEqual([]);
  });

  it("skips non-freeform exercises", () => {
    expect(extractCanonicals({ ...TEMPLATE_FREEFORM, type: "mcq" })).toEqual([]);
  });

  it("returns an empty array when there's no canonical and no variants", () => {
    const bare: ExerciseYaml = {
      target: "rust",
      themeId: "rust/foundations/hello",
      type: "freeform",
      order: 4,
      runtime: "server",
      generator: { kind: "template" },
    };
    expect(extractCanonicals(bare)).toEqual([]);
  });

  it("filters out variant entries whose canonical isn't a string", () => {
    const mixed: ExerciseYaml = {
      target: "rust",
      themeId: "rust/foundations/hello",
      type: "freeform",
      order: 4,
      runtime: "server",
      generator: {
        kind: "variant",
        variants: [
          { canonical: 'fn main() {}' },
          {},
          { canonical: 'fn main() { 1; }' },
        ],
      },
    };
    expect(extractCanonicals(mixed)).toEqual([
      "fn main() {}",
      "fn main() { 1; }",
    ]);
  });
});
