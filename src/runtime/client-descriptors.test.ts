import { describe, expect, it, vi } from "vitest";

/*
 * `runtimeToTarget` is the page-boundary helper that maps from the
 * schema's runtime vocabulary (which includes the `"server"`
 * placeholder for compile-routes without a client-side worker) into
 * the curriculum target (used for scaffolds, CodeMirror grammar
 * selection, ARIA labels, etc.).
 *
 * The three client-runtime branches come from the
 * CLIENT_RUNTIME_DESCRIPTORS table; the `"server"` branch is a
 * hard-coded "fall back to Go" — load-bearing as documented in the
 * comment block on the function. None of these is directly tested
 * today; the indirect coverage through use-runtime-run.test.ts only
 * exercises the three client branches. The Rust track's page-
 * boundary reshape relies on the `"server" → "go"` placeholder
 * staying put.
 *
 * Mock the sibling `./index` module so the lazy-singleton accessors
 * don't crash importing into a non-Worker context; this test is
 * only about the mapping function, not the workers it references.
 */

vi.mock("./index", () => ({
  getRunner: vi.fn(),
  getRustRunner: vi.fn(),
  getZigRunner: vi.fn(),
  terminateRunner: vi.fn(),
  terminateRustRunner: vi.fn(),
  terminateZigRunner: vi.fn(),
}));

import { runtimeToTarget, CLIENT_RUNTIME_DESCRIPTORS } from "./client-descriptors";

describe("runtimeToTarget", () => {
  it("maps yaegi → go", () => {
    expect(runtimeToTarget("yaegi")).toBe("go");
  });

  it("maps zig → zig", () => {
    expect(runtimeToTarget("zig")).toBe("zig");
  });

  it("maps rust → rust", () => {
    expect(runtimeToTarget("rust")).toBe("rust");
  });

  it("maps the server placeholder → go", () => {
    /* `"server"` is the schema-level placeholder for compile-routes
     * without a client-side worker. The hook returns canRun=false
     * for it, so the target value is effectively unused at runtime
     * — but a page that derives the scaffold from this still gets
     * SOMETHING reasonable. Pin the contract so a refactor doesn't
     * silently change the placeholder. */
    expect(runtimeToTarget("server")).toBe("go");
  });
});

describe("CLIENT_RUNTIME_DESCRIPTORS", () => {
  /* The descriptor table is the per-language wiring point. The
   * test suite at runtime/index.test.ts already pins the worker
   * accessor identity / isolation; this exercises the row shape
   * so a regression in `target` or `label` surfaces immediately. */
  it("declares one descriptor per client runtime with matching target", () => {
    expect(CLIENT_RUNTIME_DESCRIPTORS.yaegi.target).toBe("go");
    expect(CLIENT_RUNTIME_DESCRIPTORS.zig.target).toBe("zig");
    expect(CLIENT_RUNTIME_DESCRIPTORS.rust.target).toBe("rust");
  });

  it("exposes a label, get(), and terminate() per descriptor", () => {
    for (const key of ["yaegi", "zig", "rust"] as const) {
      const d = CLIENT_RUNTIME_DESCRIPTORS[key];
      expect(typeof d.label).toBe("string");
      expect(d.label.length).toBeGreaterThan(0);
      expect(typeof d.get).toBe("function");
      expect(typeof d.terminate).toBe("function");
    }
  });
});
