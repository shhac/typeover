import { describe, expect, it } from "vitest";
import { buildBlankSegments, substitute } from "./generator";

describe("buildBlankSegments", () => {
  it("emits text + blank for a basic 'name = ${value}' template", () => {
    expect(
      buildBlankSegments("name = ${value}", { value: "42" }, ["value"]),
    ).toEqual([
      { kind: "text", text: "name = " },
      { kind: "blank", varName: "value", expected: "42" },
    ]);
  });

  it("substitutes vars not in `blanks` as text", () => {
    expect(
      buildBlankSegments("${a} = ${b}", { a: "x", b: "1" }, ["b"]),
    ).toEqual([
      { kind: "text", text: "x" },
      { kind: "text", text: " = " },
      { kind: "blank", varName: "b", expected: "1" },
    ]);
  });

  it("produces two independent blank segments when the same var appears twice", () => {
    /* FillBlankWord's per-occurrence input slots depend on this. */
    expect(
      buildBlankSegments("${x} + ${x}", { x: "v" }, ["x"]),
    ).toEqual([
      { kind: "blank", varName: "x", expected: "v" },
      { kind: "text", text: " + " },
      { kind: "blank", varName: "x", expected: "v" },
    ]);
  });

  it("does not emit zero-length text segments between adjacent placeholders", () => {
    expect(
      buildBlankSegments("${a}${b}", { a: "x", b: "y" }, ["a", "b"]),
    ).toEqual([
      { kind: "blank", varName: "a", expected: "x" },
      { kind: "blank", varName: "b", expected: "y" },
    ]);
  });

  it("emits no leading zero-length text for a template that starts with a placeholder", () => {
    expect(buildBlankSegments("${a}", { a: "1" }, ["a"])).toEqual([
      { kind: "blank", varName: "a", expected: "1" },
    ]);
  });

  it("emits trailing text after the last placeholder", () => {
    expect(buildBlankSegments("${a}y", { a: "x" }, ["a"])).toEqual([
      { kind: "blank", varName: "a", expected: "x" },
      { kind: "text", text: "y" },
    ]);
  });

  it("throws on an unknown var, naming the var in the message", () => {
    expect(() => buildBlankSegments("${gone}", {}, [])).toThrow(/gone/);
  });

  it("returns no blank segments when `blanks` is empty (the `substitute` path)", () => {
    const out = buildBlankSegments("${a} = ${b}", { a: "x", b: "1" }, []);
    expect(out.every((s) => s.kind === "text")).toBe(true);
  });

  it("returns [] for an empty canonical", () => {
    expect(buildBlankSegments("", { a: "x" }, ["a"])).toEqual([]);
  });
});

describe("substitute", () => {
  it("replaces a ${name} placeholder with the value", () => {
    expect(substitute("hi ${name}", { name: "go" })).toBe("hi go");
  });

  it("leaves bare `$name` alone (only ${name} is substituted)", () => {
    expect(substitute("$name", { name: "go" })).toBe("$name");
  });

  it("throws on unknown var, naming the var in the message", () => {
    expect(() => substitute("${x}", {})).toThrow(/x/);
  });

  it("substitutes multiple occurrences of the same var", () => {
    expect(substitute("${x} ${x}", { x: "v" })).toBe("v v");
  });

  it("renders regex-special chars literally", () => {
    /* If a future refactor switched to string-replace, `$&` would
     * be interpreted as the whole match (silent corruption). The
     * segment-based implementation makes this safe today. */
    expect(substitute("${x}", { x: "$&" })).toBe("$&");
  });

  it("returns the input unchanged when there are no placeholders", () => {
    expect(substitute("plain text", {})).toBe("plain text");
  });
});
