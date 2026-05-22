import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { ZIG_MEMBERS, extractIdentifiers, makeZigCompletionSource } from "./zig-completions";

/*
 * Pin the two completion mechanics independently:
 *
 *   - Member-prefix discovery: `std.<cursor>` returns the members
 *     of `std`; partial-typed `std.I` filters to ones starting
 *     with `I`; unknown dotted root returns null.
 *   - In-scope token completion: identifiers from scaffold +
 *     canonical + live buffer are merged, deduped, sorted, and
 *     keyword-filtered before being offered.
 *
 * `CompletionContext` needs an `EditorState` to read; we build one
 * with the doc set to the simulated buffer and the cursor at the
 * end of the doc unless the test sets a position explicitly.
 */

function ctxFor(doc: string, cursorPos?: number, explicit = false): CompletionContext {
  const state = EditorState.create({ doc });
  const pos = cursorPos ?? doc.length;
  return new CompletionContext(state, pos, explicit);
}

/* Our source is synchronous; CodeMirror's CompletionSource return
 * type widens to `CompletionResult | null | Promise<…>`. Narrow
 * to the sync case once instead of casting on every assertion. */
type Src = ReturnType<typeof makeZigCompletionSource>;
function call(src: Src, ctx: CompletionContext): CompletionResult | null {
  const r = src(ctx);
  if (r instanceof Promise) throw new Error("zig source returned a Promise; expected sync");
  return r;
}

function labelsOf(result: CompletionResult | null): readonly string[] {
  if (!result) return [];
  return (result.options as readonly { label: string }[]).map((o) => o.label);
}

describe("ZIG_MEMBERS", () => {
  it("covers the dotted paths the curriculum uses today", () => {
    expect(ZIG_MEMBERS["std"]).toContain("Io");
    expect(ZIG_MEMBERS["std.Io"]).toContain("File");
    expect(ZIG_MEMBERS["std.Io.File"]).toContain("stdout");
    expect(ZIG_MEMBERS["std.fmt"]).toContain("bufPrint");
    expect(ZIG_MEMBERS["std.heap"]).toContain("page_allocator");
    expect(ZIG_MEMBERS["std.heap"]).toContain("ArenaAllocator");
    expect(ZIG_MEMBERS["std.process"]).toContain("Init");
    expect(ZIG_MEMBERS["init"]).toContain("io");
  });
});

describe("extractIdentifiers", () => {
  it("returns every [A-Za-z_]\\w* token in source order", () => {
    expect(extractIdentifiers('const std = @import("std");')).toEqual([
      "const",
      "std",
      "import",
      "std",
    ]);
  });

  it("treats dots as token boundaries — std.Io.File becomes three", () => {
    expect(extractIdentifiers("std.Io.File.stdout()")).toEqual(["std", "Io", "File", "stdout"]);
  });

  it("returns empty array for null/undefined/empty", () => {
    expect(extractIdentifiers(null)).toEqual([]);
    expect(extractIdentifiers(undefined)).toEqual([]);
    expect(extractIdentifiers("")).toEqual([]);
  });

  it("skips digit-prefixed tokens — '0xff' has no identifier", () => {
    /* Identifier regex anchors at `\b[A-Za-z_]`. In `0xff`, position
     * 1 (between `0` and `x`) is NOT a word boundary because both
     * surrounding chars are word chars; the engine rejects starting
     * the match there. */
    expect(extractIdentifiers("0xff")).toEqual([]);
  });
});

describe("makeZigCompletionSource — member branch", () => {
  it("returns std's members when cursor is right after `std.`", () => {
    const src = makeZigCompletionSource();
    const ls = labelsOf(call(src, ctxFor("std.")));
    expect(ls).toContain("Io");
    expect(ls).toContain("fmt");
    expect(ls).toContain("heap");
  });

  it("filters by the partial member name learner has typed", () => {
    const src = makeZigCompletionSource();
    /* The source's `from` is positioned right after the dot so
     * CodeMirror can apply its own prefix filter for `std.I`. */
    const result = call(src, ctxFor("std.I"));
    expect(result).not.toBeNull();
    expect(result!.from).toBe(4); /* "std." is 4 chars */
  });

  it("walks deeper paths: std.Io.File. → stdout/stderr/stdin", () => {
    const src = makeZigCompletionSource();
    expect(labelsOf(call(src, ctxFor("std.Io.File.")))).toEqual(["stdout", "stderr", "stdin"]);
  });

  it("returns null for an unknown dotted root (e.g. learner's local var)", () => {
    const src = makeZigCompletionSource();
    /* `nums.` is a plausible learner-local; we don't have member
     * info for it, so we suppress rather than spilling scope tokens
     * after a dot (which would be misleading). */
    expect(call(src, ctxFor("nums."))).toBeNull();
  });

  it("matches the `init.io` parameter convention", () => {
    const src = makeZigCompletionSource();
    expect(labelsOf(call(src, ctxFor("init.")))).toEqual(["io"]);
  });
});

describe("makeZigCompletionSource — scope branch", () => {
  it("returns identifiers from the scaffold seed when typing a plain prefix", () => {
    const src = makeZigCompletionSource({
      scaffold: 'const std = @import("std"); fn process(n: i32) i32 { return n; }',
    });
    /* Type `s` then trigger — should see `std`, `process`, but
     * not the typed `s` itself and not keywords like `const`/`fn`. */
    const ls = labelsOf(call(src, ctxFor("s")));
    expect(ls).toContain("std");
    expect(ls).toContain("process");
    expect(ls).not.toContain("const"); /* keyword filtered */
    expect(ls).not.toContain("fn"); /* keyword filtered */
    expect(ls).not.toContain("s"); /* exact match filtered */
  });

  it("merges canonical identifiers with scaffold ones, deduped + sorted", () => {
    const src = makeZigCompletionSource({
      scaffold: "alpha bravo",
      canonical: "bravo charlie",
    });
    expect(labelsOf(call(src, ctxFor("x")))).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("picks up identifiers from the live editor buffer", () => {
    const src = makeZigCompletionSource(); /* no seed */
    const buffer = "const customName: i32 = 5;\nc";
    const ls = labelsOf(call(src, ctxFor(buffer)));
    expect(ls).toContain("customName");
    /* `c` is the typed prefix; gets filtered out as the exact match. */
    expect(ls).not.toContain("c");
  });

  it("returns null when there's nothing to suggest", () => {
    /* Empty buffer, no seed, typed `x` — there's no `x*` in scope. */
    const src = makeZigCompletionSource();
    expect(call(src, ctxFor("x"))).toBeNull();
  });
});

describe("makeZigCompletionSource — branch dispatch", () => {
  it("known member root wins over scope (no scope-leak after dot)", () => {
    const src = makeZigCompletionSource({ canonical: "std stripe slate" });
    /* Typing `std.s` — should hit the member branch with `std`'s
     * members (Io / fmt / heap / process / mem / ArrayList / debug
     * / testing), NOT the scope branch with `stripe`/`slate`. */
    const ls = labelsOf(call(src, ctxFor("std.s")));
    expect(ls).toContain("Io");
    expect(ls).toContain("fmt");
    expect(ls).not.toContain("stripe");
    expect(ls).not.toContain("slate");
  });

  it("explicit trigger after unknown dotted root falls through to scope", () => {
    const src = makeZigCompletionSource({ canonical: "items append" });
    /* `nums.it` with explicit trigger — we don't know `nums`, but
     * the learner typed `it` and Ctrl+Space'd. Fall through to
     * scope so they get `items` from the canonical seed. */
    const ls = labelsOf(call(src, ctxFor("nums.it", undefined, true)));
    expect(ls).toContain("items");
  });
});
