import { describe, expect, it } from "vitest";
import { normalizeRust } from "./rust";

describe("normalizeRust", () => {
  it("strips line comments and preserves token boundaries", () => {
    expect(normalizeRust("let x = 1; // hello\nlet y = 2;")).toBe(
      normalizeRust("let x=1;let y=2;"),
    );
  });

  it("strips block comments without merging identifiers", () => {
    expect(normalizeRust("let/* mid */x = 1;")).toBe(
      normalizeRust("let x = 1;"),
    );
  });

  it("handles nested block comments", () => {
    expect(normalizeRust("/* a /* nested */ still */let x=1;")).toBe(
      normalizeRust("let x = 1;"),
    );
  });

  it("collapses arbitrary whitespace variations", () => {
    const a = `fn main() { println!("hi"); }`;
    const b = `fn  main  (  )\n{\n\tprintln!("hi")  ;\n}`;
    expect(normalizeRust(a)).toBe(normalizeRust(b));
  });

  it("preserves string literal contents byte-for-byte", () => {
    const a = `let s = "  spaces  ";`;
    const b = `let   s   =   "  spaces  "  ;`;
    expect(normalizeRust(a)).toBe(normalizeRust(b));
    expect(normalizeRust(a)).toContain(`"  spaces  "`);
  });

  it("preserves raw strings with varying hash counts", () => {
    const a = `let s = r#"hi "world""#;`;
    const b = `let  s = r#"hi "world""#;`;
    expect(normalizeRust(a)).toBe(normalizeRust(b));
    expect(normalizeRust(a)).toContain(`r#"hi "world""#`);
  });

  it("preserves raw strings with multiple hash levels", () => {
    const src = `let s = r###"contains "##" inside"###;`;
    expect(normalizeRust(src)).toContain(`r###"contains "##" inside"###`);
  });

  it("distinguishes char literals from lifetimes", () => {
    const charLit = normalizeRust("let c = 'a';");
    const lifetime = normalizeRust("fn f<'a>(x: &'a str) {}");
    expect(charLit).toContain("'a'");
    expect(lifetime).toContain("'a");
    /* The lifetime case must not look like a closed char literal. */
    expect(lifetime).not.toContain("'a'");
  });

  it("handles byte and c-string prefixes", () => {
    expect(normalizeRust(`let b = b"hi";`)).toContain(`b"hi"`);
    expect(normalizeRust(`let b = b'a';`)).toContain(`b'a'`);
    expect(normalizeRust(`let c = c"hi";`)).toContain(`c"hi"`);
    expect(normalizeRust(`let br = br#"hi"#;`)).toContain(`br#"hi"#`);
  });

  it("preserves multi-char operators verbatim", () => {
    expect(normalizeRust("a -> b => c .. d ..= e :: f")).toBe(
      "a->b=>c..d..=e::f",
    );
  });

  it("treats '_ as a lifetime", () => {
    expect(normalizeRust("fn f(x: &'_ str) {}")).toContain("'_");
  });

  it("treats 'static as a lifetime", () => {
    const out = normalizeRust("fn f(x: &'static str) {}");
    expect(out).toContain("'static");
    expect(out).not.toContain("'static'");
  });

  it("preserves escaped quote inside string literal", () => {
    expect(normalizeRust(`let s = "a\\"b";`)).toContain(`"a\\"b"`);
  });

  it("preserves escaped backslash inside char literal", () => {
    expect(normalizeRust(`let c = '\\\\';`)).toContain(`'\\\\'`);
  });

  it("preserves unicode escape in char literal", () => {
    expect(normalizeRust(`let c = '\\u{1F600}';`)).toContain(`'\\u{1F600}'`);
  });

  it("is idempotent: N(N(x)) === N(x)", () => {
    const src = `fn main() {\n  let x = 1 + /*c*/ 2;\n  println!("{x}");\n}`;
    const once = normalizeRust(src);
    expect(normalizeRust(once)).toBe(once);
  });

  it("collapses comment-vs-whitespace variants identically", () => {
    const withComment = `let x = 1; /* note */ let y = 2;`;
    const withWhitespace = `let x = 1;             let y = 2;`;
    expect(normalizeRust(withComment)).toBe(normalizeRust(withWhitespace));
  });

  it("does not strip whitespace inside string literals", () => {
    const out = normalizeRust(`let s = "a   b";`);
    expect(out).toContain(`"a   b"`);
  });

  it("does not treat // inside string literals as a comment", () => {
    const out = normalizeRust(`let url = "https://example.com";`);
    expect(out).toContain(`"https://example.com"`);
  });

  it("does not treat /* inside string literals as a comment", () => {
    const out = normalizeRust(`let s = "/* not a comment */";`);
    expect(out).toContain(`"/* not a comment */"`);
  });

  it("handles end-of-input mid-comment gracefully", () => {
    /* Malformed input — should not throw, just normalize what it
     * can. The Function will reject this at rustc anyway. */
    expect(() => normalizeRust("let x = 1; /* unterminated")).not.toThrow();
  });

  it("matches output across cosmetic refactors of the same solution", () => {
    const styleA = `fn main() {
    let x: i32 = 1;
    let y: i32 = 2;
    println!("{}", x + y);
}`;
    const styleB = `fn main(){let x:i32=1;let y:i32=2;println!("{}",x+y);}`;
    const styleC = `// solution
fn main () {
  let  x: i32 = 1 ;
  let  y: i32 = 2 ;
  println! ( "{}",  x + y ) ;
}`;
    expect(normalizeRust(styleA)).toBe(normalizeRust(styleB));
    expect(normalizeRust(styleA)).toBe(normalizeRust(styleC));
  });
});
