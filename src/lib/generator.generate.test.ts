import { describe, expect, it } from "vitest";
import { generate } from "./generator";

/*
 * End-to-end tests for the `generate()` dispatcher. Pins the
 * (spec, seed) → instance contract that powers stable exercise URLs
 * and "Try again with the same instance" — any silent reshuffle here
 * silently re-rolls every learner's attempt-0 instance.
 *
 * The golden assertions are inline literals (not snapshots) so the
 * expected values land in code review — a generator refactor that
 * changes them needs explicit author sign-off, not a "press u to
 * accept" reflex.
 */

describe("generate — template path", () => {
  it("renders ts + canonical from the same picked vars (no cross-contamination)", () => {
    /* Parse the rendered ts back into its name/value pair, then check
     * the canonical is built from the *same* pair. Doesn't depend on
     * the seed's picks, so adding a new value to the pool can't
     * break this test — only a refactor that decouples the two
     * substitute() calls would. */
    const out = generate(
      {
        kind: "template",
        vars: { name: ["count", "total", "score"], value: ["5", "42", "0"] },
        ts: "let ${name} = ${value};",
        canonical: "${name} := ${value}",
      },
      "fixture/template-no-distractors::0",
    );
    const m = out.ts.match(/^let (\w+) = (.+);$/);
    expect(m).not.toBeNull();
    const [, tsName, tsValue] = m!;
    expect(out.canonical).toBe(`${tsName} := ${tsValue}`);
    expect(out.options).toBeUndefined();
    expect(out.correctIndex).toBeUndefined();
  });

  it("produces the same output across two calls (determinism)", () => {
    const spec = {
      kind: "template" as const,
      vars: { x: ["a", "b", "c"] },
      ts: "${x}",
      canonical: "${x}",
      distractors: ["d", "e", "f"],
    };
    const a = generate(spec, "same-seed");
    const b = generate(spec, "same-seed");
    expect(a).toEqual(b);
  });

  it("emits options + correctIndex when distractors are present, with correctIndex pointing to the canonical", () => {
    const out = generate(
      {
        kind: "template",
        vars: { x: ["v"] },
        ts: "${x}",
        canonical: "${x}",
        distractors: ["d1", "d2", "d3"],
      },
      "any-seed",
    );
    expect(out.options).toBeDefined();
    expect(out.correctIndex).toBeDefined();
    expect(out.options![out.correctIndex!]).toBe(out.canonical);
  });

  it("drops a distractor that renders identical to the canonical", () => {
    const out = generate(
      {
        kind: "template",
        vars: { x: ["v"] },
        ts: "${x}",
        canonical: "${x}",
        distractors: ["v", "d2"],
      },
      "any-seed",
    );
    expect(out.options).toHaveLength(2);
    expect(out.options).toContain("v");
    expect(out.options).toContain("d2");
  });

  it("emits blankSegments when called with a non-empty blanks list", () => {
    const out = generate(
      {
        kind: "template",
        vars: { v: ["42"] },
        ts: "let x = ${v};",
        canonical: "x := ${v}",
      },
      "any-seed",
      { blanks: ["v"] },
    );
    expect(out.blankSegments).toEqual([
      { kind: "text", text: "x := " },
      { kind: "blank", varName: "v", expected: "42" },
    ]);
  });
});

describe("generate — variant path", () => {
  const variantSpec = {
    kind: "variant" as const,
    variants: [
      {
        id: "pi",
        ts: "const PI = 3.14;",
        canonical: "const PI = 3.14",
        distractors: ["PI := 3.14", "var PI = 3.14"],
      },
      {
        id: "e",
        ts: "const E = 2.72;",
        canonical: "const E = 2.72",
        distractors: ["E := 2.72", "var E = 2.72"],
      },
    ],
  };

  it("picks the same variant for the same seed across two calls", () => {
    const a = generate(variantSpec, "stable-seed");
    const b = generate(variantSpec, "stable-seed");
    expect(a).toEqual(b);
  });

  it("returns an option list including the canonical at correctIndex", () => {
    const out = generate(variantSpec, "stable-seed");
    expect(out.options).toBeDefined();
    expect(out.options![out.correctIndex!]).toBe(out.canonical);
  });

  it("throws when called with blanks (iter-5 safety guard)", () => {
    expect(() => generate(variantSpec, "any-seed", { blanks: ["x"] })).toThrow(/variant/);
  });

  it("does NOT throw with empty blanks (the `?? []` default path)", () => {
    expect(() => generate(variantSpec, "any-seed", { blanks: [] })).not.toThrow();
  });

  it("returns no options when the picked variant has no distractors", () => {
    const out = generate(
      {
        kind: "variant",
        variants: [{ id: "only", ts: "ts", canonical: "go" }],
      },
      "any-seed",
    );
    expect(out.options).toBeUndefined();
    expect(out.correctIndex).toBeUndefined();
  });
});

describe("generate — procedural path", () => {
  it("throws the not-implemented message", () => {
    expect(() => generate({ kind: "procedural", module: "any" }, "seed")).toThrow(
      /not implemented/i,
    );
  });
});
