import { describe, expect, it } from "vitest";
import {
  extractCanonicals,
  substituteFillLineAnswer,
  substituteCanonicalVars,
  type ExerciseYaml,
} from "./prebake-compile-cache.ts";

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
    expect(extractCanonicals(TEMPLATE_FREEFORM)).toEqual(['fn main() { println!("hi"); }']);
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
    expect(extractCanonicals({ ...TEMPLATE_FREEFORM, runtime: "yaegi" })).toEqual([]);
    expect(extractCanonicals({ ...TEMPLATE_FREEFORM, runtime: "none" })).toEqual([]);
  });

  it("skips mcq and fill-word exercises", () => {
    expect(extractCanonicals({ ...TEMPLATE_FREEFORM, type: "mcq" })).toEqual([]);
    expect(extractCanonicals({ ...TEMPLATE_FREEFORM, type: "fill-word" })).toEqual([]);
  });

  /* fill-line is graded by running the substituted canonical
   * against expectStdout. The compilable program is the canonical
   * scaffold with `${var}` replaced by the var's first option —
   * exactly what the runtime POSTs when the learner types the
   * canonical answer, so the SHA-256 lines up with the cache. */
  it("substitutes ${var} placeholders for fill-line exercises", () => {
    const fillLine: ExerciseYaml = {
      target: "rust",
      themeId: "rust/foundations/variables",
      type: "fill-line",
      order: 5,
      runtime: "server",
      generator: {
        kind: "template",
        canonical: 'fn main() {\n    ${line}\n    println!("{}", x);\n}',
        vars: { line: ["let mut x: i32 = 0;"] },
      },
    };
    expect(extractCanonicals(fillLine)).toEqual([
      'fn main() {\n    let mut x: i32 = 0;\n    println!("{}", x);\n}',
    ]);
  });

  it("includes alternateCanonicals for fill-line", () => {
    const fillLine: ExerciseYaml = {
      target: "rust",
      themeId: "rust/foundations/variables",
      type: "fill-line",
      order: 5,
      runtime: "server",
      alternateCanonicals: ['fn main() { let x = 1; println!("{x}"); }'],
      generator: {
        kind: "template",
        canonical: 'fn main() {\n    ${line}\n    println!("{}", x);\n}',
        vars: { line: ["let x: i32 = 1;"] },
      },
    };
    const out = extractCanonicals(fillLine);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("let x: i32 = 1;");
    expect(out[1]).toBe('fn main() { let x = 1; println!("{x}"); }');
  });

  it("includes acceptedAnswers marked prebake for fill-line", () => {
    const fillLine: ExerciseYaml = {
      target: "rust",
      themeId: "rust/foundations/variables",
      type: "fill-line",
      order: 5,
      runtime: "server",
      blanks: ["line"],
      acceptedAnswers: [
        { match: "let x = 2 * ${name};", prebake: true },
        { match: "let x = ${name} + ${name};", prebake: false },
      ],
      generator: {
        kind: "template",
        canonical: 'fn main() {\n    let ${name} = 21;\n    ${line}\n    println!("{}", x);\n}',
        vars: { name: ["foo"], line: ["let x = foo * 2;"] },
      },
    };
    expect(extractCanonicals(fillLine)).toEqual([
      'fn main() {\n    let foo = 21;\n    let x = foo * 2;\n    println!("{}", x);\n}',
      'fn main() {\n    let foo = 21;\n    let x = 2 * foo;\n    println!("{}", x);\n}',
    ]);
  });
});

describe("substituteCanonicalVars", () => {
  it("returns the input unchanged when vars is undefined", () => {
    expect(substituteCanonicalVars("fn main() { ${x} }", undefined)).toBe("fn main() { ${x} }");
  });

  it("replaces every occurrence of a single var", () => {
    /* The template can reference the same var multiple times
     * (e.g. `${name} == ${name}`); replaceAll handles that. */
    expect(substituteCanonicalVars("let ${k} = 1; print(${k});", { k: ["foo"] })).toBe(
      "let foo = 1; print(foo);",
    );
  });

  it("replaces multiple distinct vars", () => {
    expect(substituteCanonicalVars("${a} + ${b}", { a: ["1"], b: ["2"] })).toBe("1 + 2");
  });

  it("uses options[0] only — additional options are ignored", () => {
    /* The canonical is `options[0]` by convention; other options
     * are kept for runtime variation but the prebake hashes the
     * canonical, not the alternates. */
    expect(substituteCanonicalVars("${k}", { k: ["first", "second"] })).toBe("first");
  });

  it("skips vars with no options or non-string first option", () => {
    expect(substituteCanonicalVars("${k} stays", { k: [] })).toBe("${k} stays");
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

  it("substitutes a fill-line accepted answer into the blank", () => {
    expect(
      substituteFillLineAnswer(
        "fn main() { ${line} }",
        { line: ["let x = 1;"] },
        ["line"],
        "let x = 2;",
      ),
    ).toBe("fn main() { let x = 2; }");
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
        variants: [{ canonical: "fn main() {}" }, {}, { canonical: "fn main() { 1; }" }],
      },
    };
    expect(extractCanonicals(mixed)).toEqual(["fn main() {}", "fn main() { 1; }"]);
  });
});
