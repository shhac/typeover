import { describe, expect, it } from "vitest";
import { parserFor, highlightedTokens, type Lang } from "./CodeHighlight";

/*
 * Pin the parserFor coverage matrix and the tokenizer's token-
 * concatenation invariant.
 *
 * The earlier `if`-chain version of parserFor silently returned
 * null for "rust" because the branch was never added — Rust code
 * blocks shipped as unstyled plaintext while the type union
 * advertised Rust as a supported lang. The switch+assertUnreachable
 * form now makes that class of regression a typecheck failure,
 * and these tests pin the per-lang coverage so a future addition
 * (e.g. Python) can't ship before its parser branch lands.
 *
 * The tokenizer tests pin the concatenation invariant: every
 * highlighted span's text, joined in order, must equal the input.
 * A range-sort or overlap-skip regression that drops or duplicates
 * a character would otherwise silently render mangled code with
 * the right colors.
 */

describe("parserFor — language coverage", () => {
  it.each(["ts", "go", "zig", "rust"] as const)("returns a non-null parser for %s", (lang) => {
    const parser = parserFor(lang);
    expect(parser).not.toBeNull();
    /* The parser surface we actually use is `.parse(string) → Tree`.
     * Verify the method exists rather than asserting a specific
     * Lezer internal shape. */
    expect(typeof parser?.parse).toBe("function");
  });

  it("returns null for shell (no syntax highlight, no error)", () => {
    expect(parserFor("shell")).toBeNull();
  });

  it("returns null for plain (no syntax highlight, no error)", () => {
    expect(parserFor("plain")).toBeNull();
  });
});

describe("highlightedTokens — fallback paths", () => {
  it("returns a single plaintext token for an empty string", () => {
    expect(highlightedTokens("", "go")).toEqual([{ text: "" }]);
  });

  it("returns a single plaintext token for unsupported lang", () => {
    /* shell + plain have no parser; the source should still render
     * verbatim, just without per-token classes. */
    expect(highlightedTokens("echo hi", "shell")).toEqual([{ text: "echo hi" }]);
    expect(highlightedTokens("anything", "plain")).toEqual([{ text: "anything" }]);
  });
});

describe("highlightedTokens — concatenation invariant", () => {
  /* Per-language fixtures small enough to type but big enough to
   * exercise multiple token classes (keywords + identifiers +
   * strings + comments + punctuation). The invariant we pin is
   * NOT the specific class names (that's the tagHighlighter's
   * business and stable) — it's that the input string is
   * reproduced verbatim when token texts are concatenated. A
   * regression in the overlap-skip / sort / slice math would
   * either drop characters or duplicate them; this catches both. */
  const fixtures: ReadonlyArray<{ lang: Lang; code: string }> = [
    { lang: "ts", code: 'const x: number = 1;\n// comment\nconsole.log(x);' },
    { lang: "go", code: 'package main\nimport "fmt"\nfunc main() { fmt.Println("hi") }' },
    { lang: "zig", code: 'const std = @import("std");\npub fn main() void {}' },
    { lang: "rust", code: 'fn main() {\n    let x: i32 = 1;\n    println!("{x}");\n}' },
  ];

  for (const { lang, code } of fixtures) {
    it(`reconstructs the input verbatim for ${lang}`, () => {
      const tokens = highlightedTokens(code, lang);
      expect(tokens.map((t) => t.text).join("")).toBe(code);
    });

    it(`produces at least one classed token for ${lang}`, () => {
      /* If highlighting silently broke (e.g. the highlighter
       * stopped emitting ranges), the only token would be the
       * unclassed fallback. Pin "we emit at least one classed
       * token" to catch that regression. */
      const tokens = highlightedTokens(code, lang);
      const classed = tokens.filter((t) => t.className !== undefined);
      expect(classed.length).toBeGreaterThan(0);
    });
  }
});
