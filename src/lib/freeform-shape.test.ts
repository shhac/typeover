import { describe, expect, it } from "vitest";
import {
  LANGUAGE_FREEFORM_SCAFFOLD,
  LANGUAGE_SUBMISSION_SHAPE,
  resolveSubmissionShape,
  validateSubmissionShape,
} from "./freeform-shape";

describe("validateSubmissionShape", () => {
  it("passes when source matches both bookends after trim", () => {
    const result = validateSubmissionShape(
      `\n  fn main() { println!("hi"); }\n  `,
      { mustStartWith: "fn main", mustEndWith: "}" },
    );
    expect(result.ok).toBe(true);
    expect(result.message).toBe("");
  });

  it("fails when start bookend is missing", () => {
    const result = validateSubmissionShape(
      `println!("orphan");`,
      { mustStartWith: "fn main", mustEndWith: "}" },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("fn main");
  });

  it("fails when end bookend is missing", () => {
    const result = validateSubmissionShape(
      `fn main() { println!("oops");`,
      { mustStartWith: "fn main", mustEndWith: "}" },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("}");
  });

  it("rejects an empty submission with a dedicated message", () => {
    const result = validateSubmissionShape("   \n  ", {
      mustStartWith: "fn main",
      mustEndWith: "}",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/empty/i);
  });

  it("treats empty mustStartWith / mustEndWith as no-op", () => {
    expect(validateSubmissionShape("anything goes", {}).ok).toBe(true);
    expect(
      validateSubmissionShape("anything goes", { mustStartWith: "", mustEndWith: "" }).ok,
    ).toBe(true);
  });

  it("reports start failure before end failure when both miss", () => {
    const result = validateSubmissionShape("nope", {
      mustStartWith: "fn main",
      mustEndWith: "}",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("fn main");
    expect(result.message).not.toContain("}");
  });
});

describe("resolveSubmissionShape", () => {
  it("returns the language default when no override is given", () => {
    expect(resolveSubmissionShape("rust", undefined)).toEqual(
      LANGUAGE_SUBMISSION_SHAPE.rust,
    );
    expect(resolveSubmissionShape("go", undefined)).toEqual(
      LANGUAGE_SUBMISSION_SHAPE.go,
    );
    expect(resolveSubmissionShape("zig", undefined)).toEqual(
      LANGUAGE_SUBMISSION_SHAPE.zig,
    );
  });

  it("layers an override on top of the default — start only", () => {
    const resolved = resolveSubmissionShape("rust", { mustStartWith: "use std::" });
    expect(resolved.mustStartWith).toBe("use std::");
    expect(resolved.mustEndWith).toBe(LANGUAGE_SUBMISSION_SHAPE.rust.mustEndWith);
  });

  it("layers an override on top of the default — end only", () => {
    const resolved = resolveSubmissionShape("rust", { mustEndWith: "Ok(())\n}" });
    expect(resolved.mustStartWith).toBe(LANGUAGE_SUBMISSION_SHAPE.rust.mustStartWith);
    expect(resolved.mustEndWith).toBe("Ok(())\n}");
  });

  it("an explicit empty string disables that end of the check", () => {
    const resolved = resolveSubmissionShape("rust", { mustStartWith: "" });
    expect(resolved.mustStartWith).toBe("");
    expect(resolved.mustEndWith).toBe(LANGUAGE_SUBMISSION_SHAPE.rust.mustEndWith);
  });
});

describe("language defaults", () => {
  it("Rust default accepts the canonical hello-world", () => {
    const canonical = `fn main() {\n    println!("hello");\n}\n`;
    const result = validateSubmissionShape(canonical, LANGUAGE_SUBMISSION_SHAPE.rust);
    expect(result.ok).toBe(true);
  });

  it("Rust default rejects a body-only submission", () => {
    const result = validateSubmissionShape(
      `println!("hello");`,
      LANGUAGE_SUBMISSION_SHAPE.rust,
    );
    expect(result.ok).toBe(false);
  });

  it("Go default accepts a canonical package-main", () => {
    const canonical = `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}\n`;
    expect(validateSubmissionShape(canonical, LANGUAGE_SUBMISSION_SHAPE.go).ok).toBe(true);
  });

  it("scaffolds all pass their own language default", () => {
    for (const target of ["go", "zig", "rust"] as const) {
      const scaffold = LANGUAGE_FREEFORM_SCAFFOLD[target];
      const shape = LANGUAGE_SUBMISSION_SHAPE[target];
      expect(validateSubmissionShape(scaffold, shape).ok).toBe(true);
    }
  });
});
