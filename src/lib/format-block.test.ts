import { describe, expect, it } from "vitest";
import { formatBlock } from "./format-block";

describe("formatBlock", () => {
  it("wraps a single paragraph in <p>", () => {
    expect(formatBlock("Hello world.")).toBe("<p>Hello world.</p>");
  });

  it("splits on a blank line into two paragraphs", () => {
    expect(formatBlock("First.\n\nSecond.")).toBe("<p>First.</p><p>Second.</p>");
  });

  it("joins multi-line paragraphs with a single space", () => {
    expect(formatBlock("line one\nline two\nline three")).toBe(
      "<p>line one line two line three</p>",
    );
  });

  it("recognises a list block where every line starts with `- `", () => {
    expect(formatBlock("- alpha\n- beta\n- gamma")).toBe(
      "<ul><li>alpha</li><li>beta</li><li>gamma</li></ul>",
    );
  });

  it("supports `* ` as a list marker too (markdown variant)", () => {
    expect(formatBlock("* a\n* b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("applies inline grammar (code, bold) inside list items", () => {
    expect(formatBlock("- `name := value` is the **short** form")).toBe(
      "<ul><li><code>name := value</code> is the <strong>short</strong> form</li></ul>",
    );
  });

  it("applies inline grammar inside paragraphs", () => {
    expect(formatBlock("Use `let` here.")).toBe("<p>Use <code>let</code> here.</p>");
  });

  it("HTML-escapes raw input via formatInline", () => {
    expect(formatBlock("a < b & c")).toBe("<p>a &lt; b &amp; c</p>");
  });

  it("a paragraph followed by a list followed by a paragraph", () => {
    const input = "Intro line.\n\n- one\n- two\n\nOutro line.";
    expect(formatBlock(input)).toBe(
      "<p>Intro line.</p><ul><li>one</li><li>two</li></ul><p>Outro line.</p>",
    );
  });

  it("strips a single trailing newline (YAML's `intro: |` adds one)", () => {
    expect(formatBlock("Hello.\n")).toBe("<p>Hello.</p>");
  });

  it("collapses multiple blank lines into one block boundary", () => {
    expect(formatBlock("First.\n\n\n\nSecond.")).toBe("<p>First.</p><p>Second.</p>");
  });

  it("ignores empty input", () => {
    expect(formatBlock("")).toBe("");
    expect(formatBlock("\n\n\n")).toBe("");
  });

  it("renders the real foundations/variables intro shape", () => {
    /* Lifted from the actual theme YAML. Verifies the list under
     * "Go has two short forms for the same job:" renders as a
     * proper <ul> instead of the literal hyphens we shipped before. */
    const input =
      "TypeScript uses `let` and `const` to introduce variables. Go has two short forms for the same job:\n\n" +
      "- `name := value` — the **short declaration**.\n" +
      "- `var name type = value` — the full form.";
    const out = formatBlock(input);
    expect(out).toContain("<p>TypeScript uses <code>let</code>");
    expect(out).toContain("<ul><li><code>name := value</code>");
    expect(out).toContain("<strong>short declaration</strong>");
    expect(out).toContain("<li><code>var name type = value</code>");
  });

  it("a list interrupts a paragraph without a leading blank line (CommonMark)", () => {
    /* The shipped theme intros (e.g. foundations/variables) put the
     * list immediately after the paragraph with no blank line. Before
     * this change the whole thing rendered as one <p> with literal
     * hyphens. */
    const input = "Intro line.\n- one\n- two";
    expect(formatBlock(input)).toBe("<p>Intro line.</p><ul><li>one</li><li>two</li></ul>");
  });

  it("a list followed by a paragraph without a blank line in between", () => {
    const input = "- one\n- two\nOutro.";
    expect(formatBlock(input)).toBe("<ul><li>one</li><li>two</li></ul><p>Outro.</p>");
  });

  it("alternating list-paragraph-list", () => {
    const input = "- a\nmiddle paragraph\n- b";
    expect(formatBlock(input)).toBe(
      "<ul><li>a</li></ul><p>middle paragraph</p><ul><li>b</li></ul>",
    );
  });

  it("indented continuation lines join the previous list item (CommonMark)", () => {
    /* The shipped variables.yaml intro continues each list item on
     * the next indented line; that's the standard CommonMark
     * multi-line list-item shape. */
    const input = "- first item\n  continued here\n- second item\n  also continued";
    expect(formatBlock(input)).toBe(
      "<ul><li>first item continued here</li><li>second item also continued</li></ul>",
    );
  });

  it("a list followed by a blank line followed by a paragraph", () => {
    /* This is the post-list-blank-line case in the variables.yaml
     * intro: list, blank, then a final paragraph about const. */
    const input = "- one\n- two\n\nFinal paragraph.";
    expect(formatBlock(input)).toBe("<ul><li>one</li><li>two</li></ul><p>Final paragraph.</p>");
  });
});
