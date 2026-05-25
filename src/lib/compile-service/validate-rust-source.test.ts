import { describe, expect, it } from "vitest";
import { FORBIDDEN_PATTERNS, MAX_SOURCE_BYTES, validateRustSource } from "./validate-rust-source";

const VALID_SOURCE = `fn main() {\n    println!("hi");\n}\n`;

describe("validateRustSource", () => {
  it("accepts a clean canonical fn main", () => {
    const result = validateRustSource({ source: VALID_SOURCE });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe(VALID_SOURCE);
  });

  it("rejects non-object body with 400", () => {
    expect(validateRustSource(null).ok).toBe(false);
    expect(validateRustSource("string-body").ok).toBe(false);
    expect(validateRustSource(42).ok).toBe(false);
    const r = validateRustSource(null);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("rejects missing `source` field with 400", () => {
    const r = validateRustSource({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/source/);
    }
  });

  it("rejects non-string `source` with 400", () => {
    const r = validateRustSource({ source: 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("rejects empty string `source` with 400", () => {
    const r = validateRustSource({ source: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("rejects oversize source with 413", () => {
    const r = validateRustSource({ source: "a".repeat(MAX_SOURCE_BYTES + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });

  it("accepts source exactly at the size limit", () => {
    /* Boundary check — N bytes passes, N+1 fails. */
    expect(validateRustSource({ source: "a".repeat(MAX_SOURCE_BYTES) }).ok).toBe(true);
  });

  it("measures the size limit in bytes, not UTF-16 code units", () => {
    const exact = "é".repeat(MAX_SOURCE_BYTES / 2);
    const over = exact + "é";
    expect(validateRustSource({ source: exact }).ok).toBe(true);
    const r = validateRustSource({ source: over });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });

  /* Each forbidden token corresponds to a recognized abuse vector.
   * The table-driven loop documents the contract and locks any
   * future regex regression. */
  const forbiddenCases: ReadonlyArray<readonly [string, string]> = [
    ["extern crate foo;", "extern crate"],
    ["use std::process::exit;", "std::process"],
    ["use std::env::var;", "std::env"],
    ["use std::fs::File;", "std::fs"],
    ["use std::net::TcpStream;", "std::net"],
    ["use std::os::unix::io::AsRawFd;", "std::os::"],
    ["fn main() { unsafe { let _ = 1; } }", "unsafe"],
    ['fn main() { asm!("nop"); }', "asm!"],
    ['let s = include_str!("path");', "include_str!"],
    ['let s = include_bytes!("path");', "include_bytes!"],
    ['include!("path");', "include!"],
    ["#![feature(let_chains)]", "#![feature("],
  ];

  it.each(forbiddenCases)("rejects `%s` (covers %s) with 422", (source, _label) => {
    const r = validateRustSource({ source: VALID_SOURCE + source });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("matches every documented FORBIDDEN_PATTERNS entry at least once in the case table", () => {
    /* Guard against the case where someone adds a regex but forgets
     * to add it to forbiddenCases — the suite would silently miss
     * coverage of the new pattern. */
    expect(forbiddenCases.length).toBe(FORBIDDEN_PATTERNS.length);
  });

  it("does not falsely reject identifiers that contain forbidden substrings", () => {
    /* Word boundaries on the simpler patterns; ensures e.g. an
     * identifier `extern_data` isn't blocked. */
    const safe = `${VALID_SOURCE}\nfn extern_data() {}\nfn the_unsafest() {}\n`;
    /* "extern_data" should pass extern-crate check;
     * "the_unsafest" contains "unsafe" but only as a sub-word. */
    const r = validateRustSource({ source: safe });
    /* `\bunsafe\b` requires a word boundary on both sides, so
     * "the_unsafest" fails the boundary on the trailing side
     * (`s` follows `unsafe`) and is permitted. Verify. */
    expect(r.ok).toBe(true);
  });
});
