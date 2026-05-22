import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import {
  ZIG_MEMBERS,
  GO_MEMBERS,
  extractIdentifiers,
  makeCompletionSource,
} from "./code-completions";

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
 * Covered for both Zig and Go via the same dispatcher.
 */

function ctxFor(doc: string, cursorPos?: number, explicit = false): CompletionContext {
  const state = EditorState.create({ doc });
  const pos = cursorPos ?? doc.length;
  return new CompletionContext(state, pos, explicit);
}

type Src = ReturnType<typeof makeCompletionSource>;
function call(src: Src, ctx: CompletionContext): CompletionResult | null {
  const r = src(ctx);
  if (r instanceof Promise) throw new Error("source returned a Promise; expected sync");
  return r;
}

function labelsOf(result: CompletionResult | null): readonly string[] {
  if (!result) return [];
  return (result.options as readonly { label: string }[]).map((o) => o.label);
}

describe("ZIG_MEMBERS", () => {
  it("covers the dotted paths the Zig curriculum uses today", () => {
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

describe("GO_MEMBERS", () => {
  it("covers fmt, strings, strconv, slices, errors, time, sort, sync", () => {
    expect(GO_MEMBERS["fmt"]).toContain("Println");
    expect(GO_MEMBERS["fmt"]).toContain("Errorf");
    expect(GO_MEMBERS["strings"]).toContain("Contains");
    expect(GO_MEMBERS["strings"]).toContain("Builder");
    expect(GO_MEMBERS["strconv"]).toContain("Atoi");
    expect(GO_MEMBERS["slices"]).toContain("Sort");
    expect(GO_MEMBERS["maps"]).toContain("Keys");
    expect(GO_MEMBERS["errors"]).toContain("New");
    expect(GO_MEMBERS["time"]).toContain("Now");
    expect(GO_MEMBERS["sort"]).toContain("Slice");
    expect(GO_MEMBERS["sync"]).toContain("Mutex");
  });

  it("exposes builder method names for strings.Builder + bytes.Buffer", () => {
    expect(GO_MEMBERS["strings.Builder"]).toContain("WriteString");
    expect(GO_MEMBERS["bytes.Buffer"]).toContain("WriteString");
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
    expect(extractIdentifiers("0xff")).toEqual([]);
  });
});

describe("makeCompletionSource — zig member branch", () => {
  const src = makeCompletionSource({ language: "zig" });

  it("returns std's members when cursor is right after `std.`", () => {
    const ls = labelsOf(call(src, ctxFor("std.")));
    expect(ls).toContain("Io");
    expect(ls).toContain("fmt");
    expect(ls).toContain("heap");
    expect(ls).toContain("math");
  });

  it("filters by the partial member name learner has typed", () => {
    const result = call(src, ctxFor("std.I"));
    expect(result).not.toBeNull();
    expect(result!.from).toBe(4);
  });

  it("walks deeper paths: std.Io.File. → stdout/stderr/stdin", () => {
    expect(labelsOf(call(src, ctxFor("std.Io.File.")))).toEqual(["stdout", "stderr", "stdin"]);
  });

  it("returns null for an unknown dotted root", () => {
    expect(call(src, ctxFor("nums."))).toBeNull();
  });

  it("matches the `init.io` parameter convention", () => {
    expect(labelsOf(call(src, ctxFor("init.")))).toEqual(["io"]);
  });
});

describe("makeCompletionSource — go member branch", () => {
  const src = makeCompletionSource({ language: "go" });

  it("returns fmt's members after `fmt.`", () => {
    const ls = labelsOf(call(src, ctxFor("fmt.")));
    expect(ls).toContain("Println");
    expect(ls).toContain("Printf");
    expect(ls).toContain("Errorf");
    expect(ls).toContain("Sprintf");
  });

  it("returns strings' members after `strings.`", () => {
    const ls = labelsOf(call(src, ctxFor("strings.")));
    expect(ls).toContain("Contains");
    expect(ls).toContain("Split");
    expect(ls).toContain("Builder");
  });

  it("returns time package members after `time.`", () => {
    const ls = labelsOf(call(src, ctxFor("time.")));
    expect(ls).toContain("Now");
    expect(ls).toContain("Duration");
    expect(ls).toContain("Second");
  });

  it("returns null for an unknown root in Go", () => {
    expect(call(src, ctxFor("greeting."))).toBeNull();
  });
});

describe("makeCompletionSource — scope branch", () => {
  it("zig: filters out Zig keywords from scaffold seed", () => {
    const src = makeCompletionSource({
      language: "zig",
      scaffold: 'const std = @import("std"); fn process(n: i32) i32 { return n; }',
    });
    const ls = labelsOf(call(src, ctxFor("s")));
    expect(ls).toContain("std");
    expect(ls).toContain("process");
    expect(ls).not.toContain("const");
    expect(ls).not.toContain("fn");
    expect(ls).not.toContain("s");
  });

  it("go: filters out Go keywords from scaffold seed", () => {
    const src = makeCompletionSource({
      language: "go",
      scaffold: 'package main\nimport "fmt"\nfunc greet(name string) { return }',
    });
    const ls = labelsOf(call(src, ctxFor("g")));
    expect(ls).toContain("greet");
    expect(ls).not.toContain("func"); /* Go keyword */
    expect(ls).not.toContain("package");
    expect(ls).not.toContain("import");
    expect(ls).not.toContain("return");
  });

  it("merges canonical identifiers with scaffold ones, deduped + sorted", () => {
    const src = makeCompletionSource({
      language: "zig",
      scaffold: "alpha bravo",
      canonical: "bravo charlie",
    });
    expect(labelsOf(call(src, ctxFor("x")))).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("picks up identifiers from the live editor buffer", () => {
    const src = makeCompletionSource({ language: "zig" });
    const ls = labelsOf(call(src, ctxFor("const customName: i32 = 5;\nc")));
    expect(ls).toContain("customName");
    expect(ls).not.toContain("c");
  });

  it("returns null when there's nothing to suggest", () => {
    const src = makeCompletionSource({ language: "zig" });
    expect(call(src, ctxFor("x"))).toBeNull();
  });
});

describe("makeCompletionSource — branch dispatch", () => {
  it("zig: known member root wins over scope", () => {
    const src = makeCompletionSource({
      language: "zig",
      canonical: "std stripe slate",
    });
    const ls = labelsOf(call(src, ctxFor("std.s")));
    expect(ls).toContain("Io");
    expect(ls).toContain("fmt");
    expect(ls).not.toContain("stripe");
    expect(ls).not.toContain("slate");
  });

  it("zig: explicit trigger after unknown dotted root falls through to scope", () => {
    const src = makeCompletionSource({
      language: "zig",
      canonical: "items append",
    });
    const ls = labelsOf(call(src, ctxFor("nums.it", undefined, true)));
    expect(ls).toContain("items");
  });
});
