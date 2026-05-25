import { describe, expect, it } from "vitest";
import { loadParser, highlightedTokens, type Lang } from "./CodeHighlight";

/*
 * Pin the parser load + tokenizer concatenation invariants.
 *
 * `loadParser` is async now (each grammar is dynamic-imported per
 * commit hash). The coverage matrix below makes a future addition
 * (e.g. Python) impossible to ship without its parser branch
 * landing here. The earlier static-import `if`-chain silently
 * returned null for unmatched langs — that footgun is what produced
 * the unhighlighted-Rust regression that prompted the Rust branch
 * to land.
 *
 * The tokenizer tests pin the concatenation invariant: every
 * highlighted span's text, joined in order, must equal the input.
 * A range-sort or overlap-skip regression that drops or duplicates
 * a character would otherwise silently render mangled code with
 * the right colors.
 */

describe("loadParser — language coverage", () => {
  it.each(["ts", "go", "zig", "rust"] as const)("resolves a non-null parser for %s", async (lang) => {
    const parser = await loadParser(lang);
    expect(parser).not.toBeNull();
    /* The parser surface we actually use is `.parse(string) → Tree`.
     * Verify the method exists rather than asserting a specific
     * Lezer internal shape. */
    expect(typeof parser?.parse).toBe("function");
  });

  it("resolves null for shell (no syntax highlight, no error)", async () => {
    expect(await loadParser("shell")).toBeNull();
  });

  it("resolves null for plain (no syntax highlight, no error)", async () => {
    expect(await loadParser("plain")).toBeNull();
  });

  it("caches resolved parsers — repeated calls return the same instance", async () => {
    /* The cache is what keeps the per-grammar chunk from being
     * fetched multiple times on a page that mounts multiple
     * <CodeHighlight lang="go"> panes. Identity equality is the
     * cheap proxy for "we didn't go through the import() round
     * trip again". */
    const a = await loadParser("go");
    const b = await loadParser("go");
    expect(a).toBe(b);
  });
});

describe("highlightedTokens — fallback paths", () => {
  it("returns a single plaintext token for an empty string", async () => {
    const parser = await loadParser("go");
    expect(highlightedTokens("", parser)).toEqual([{ text: "" }]);
  });

  it("returns a single plaintext token when parser is null", () => {
    /* The component renders this branch while a grammar chunk is
     * still loading — `parser()` is undefined and the fallback
     * <Show> renders the raw code. Pin that the same shape is
     * what `highlightedTokens(null, ...)` produces. */
    expect(highlightedTokens("echo hi", null)).toEqual([{ text: "echo hi" }]);
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
    it(`reconstructs the input verbatim for ${lang}`, async () => {
      const parser = await loadParser(lang);
      const tokens = highlightedTokens(code, parser);
      expect(tokens.map((t) => t.text).join("")).toBe(code);
    });

    it(`produces at least one classed token for ${lang}`, async () => {
      /* If highlighting silently broke (e.g. the highlighter
       * stopped emitting ranges), the only token would be the
       * unclassed fallback. Pin "we emit at least one classed
       * token" to catch that regression. */
      const parser = await loadParser(lang);
      const tokens = highlightedTokens(code, parser);
      const classed = tokens.filter((t) => t.className !== undefined);
      expect(classed.length).toBeGreaterThan(0);
    });
  }
});
