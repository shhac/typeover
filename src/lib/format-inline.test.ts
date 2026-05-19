import { describe, expect, it } from "vitest";
import { formatInline } from "./format-inline";

describe("formatInline", () => {
  it("renders a plain string unchanged", () => {
    expect(formatInline("hello world")).toBe("hello world");
  });

  it("wraps a single backtick span in <code>", () => {
    expect(formatInline("Use `let` here")).toBe("Use <code>let</code> here");
  });

  it("handles multiple spans on one line", () => {
    expect(formatInline("`let` vs `const`")).toBe("<code>let</code> vs <code>const</code>");
  });

  it("non-greedy: adjacent spans don't merge", () => {
    /* Without `+?` the regex would gobble across both pairs and produce
     * one `<code>a` `b</code>` span. */
    expect(formatInline("`a` `b`")).toBe("<code>a</code> <code>b</code>");
  });

  it("HTML-escapes outside spans", () => {
    expect(formatInline("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });

  it("HTML-escapes inside spans", () => {
    expect(formatInline("`<script>`")).toBe("<code>&lt;script&gt;</code>");
  });

  it("HTML-escapes quotes and apostrophes (XSS surface in attribute contexts)", () => {
    expect(formatInline(`he said "hi" — it's fine`)).toBe("he said &quot;hi&quot; — it&#39;s fine");
  });

  it("leaves a lone backtick alone (no pair to wrap)", () => {
    expect(formatInline("trailing `")).toBe("trailing `");
  });

  it("preserves newlines inside the source string", () => {
    expect(formatInline("line 1\nline 2 with `code`")).toBe(
      "line 1\nline 2 with <code>code</code>",
    );
  });

  it("handles a hint with multiple code spans and an em-dash", () => {
    /* Real shape — foundations/variables/01.yaml hint 1. */
    const input =
      "TS `let` introduces a new variable. Go has a short form for the same job — and inside a function, it's the one you reach for.";
    expect(formatInline(input)).toContain("TS <code>let</code> introduces");
    expect(formatInline(input)).toContain("it&#39;s the one");
  });

  it("wraps the entire string when the whole hint is a code span", () => {
    /* foundations/variables/01.yaml hint 3 is `${name} := ${value}` —
     * the visible text after rendering should be just the inner code,
     * not the surrounding backticks. */
    expect(formatInline("`${name} := ${value}`")).toBe("<code>${name} := ${value}</code>");
  });

  it("wraps **bold** in <strong>", () => {
    expect(formatInline("the **short declaration**")).toBe(
      "the <strong>short declaration</strong>",
    );
  });

  it("mixes bold and code in one string", () => {
    /* themes/foundations/variables.yaml uses this exact pattern. */
    expect(formatInline("`name := value` — the **short declaration**")).toBe(
      "<code>name := value</code> — the <strong>short declaration</strong>",
    );
  });

  it("bold pass does not touch * inside a code span (escape-then-replace order)", () => {
    /* If a code span contains an asterisk, e.g. `uint*`, the bold
     * pass must not see it as a bold marker. Code is replaced first. */
    expect(formatInline("`uint*` etc")).toBe("<code>uint*</code> etc");
  });

  it("leaves a single asterisk alone (italic intentionally not supported)", () => {
    expect(formatInline("see *also* this")).toBe("see *also* this");
  });
});
