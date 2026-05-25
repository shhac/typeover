import { describe, expect, it } from "vitest";
import { shouldHandleCompileRequest, COMPILE_PREFIX } from "./should-handle";
import type { LanguageEntry } from "~/lib/compile-service/normalize";

/*
 * Pin the SW shell's fetch-event bouncer. The four gate conditions
 * (method, origin, prefix, registry membership) decide whether a
 * request reaches `handleCompileRequest` at all. The handler logic
 * itself is covered by sw-handler.test.ts; this is the layer above.
 *
 * Why this matters: a regression that broadens the gate (e.g. drops
 * the origin check) would silently make the SW intercept third-
 * party POSTs on the same path prefix. A regression that narrows
 * the gate (e.g. typo'd prefix) would silently skip the cache and
 * fall through to the L2 compile path — invisible until the bill
 * arrives.
 */

const SELF_ORIGIN = "https://typeover.dev";

/* Identity normalizer — the gate doesn't touch source, only
 * registry membership matters here. */
const rustEntry: LanguageEntry = { id: "rust", normalize: (s) => s };
const registry = { rust: rustEntry };

function postTo(path: string, origin = SELF_ORIGIN): Request {
  return new Request(`${origin}${path}`, { method: "POST", body: "fn main(){}" });
}

describe("shouldHandleCompileRequest — happy path", () => {
  it("returns the lang for a registered POST under the compile prefix", () => {
    const match = shouldHandleCompileRequest(postTo("/api/compile/rust"), SELF_ORIGIN, registry);
    expect(match).toEqual({ lang: "rust" });
  });

  it("ignores query strings — the path prefix and lang segment are what gate", () => {
    const match = shouldHandleCompileRequest(
      postTo("/api/compile/rust?ts=123"),
      SELF_ORIGIN,
      registry,
    );
    expect(match).toEqual({ lang: "rust" });
  });
});

describe("shouldHandleCompileRequest — method gate", () => {
  /* Only POST gets intercepted. GET /api/compile/rust isn't a
   * valid request shape on this API (the endpoint refuses non-
   * POST upstream); the SW just defers to the network so the
   * upstream's own gating produces the canonical error. */
  it.each(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"])("rejects %s", (method) => {
    const req = new Request(`${SELF_ORIGIN}/api/compile/rust`, { method });
    expect(shouldHandleCompileRequest(req, SELF_ORIGIN, registry)).toBeNull();
  });
});

describe("shouldHandleCompileRequest — origin gate", () => {
  /* Cross-origin requests can in principle reach a SW (extension
   * popups, third-party iframes that happen to hit our paths,
   * etc.). The cache only ever serves OUR compile bytes — never
   * intercept someone else's POST, even if the path matches. */
  it("rejects a POST whose URL origin doesn't match self.location.origin", () => {
    const req = new Request("https://typeover.test/api/compile/rust", {
      method: "POST",
      body: "fn main(){}",
    });
    expect(shouldHandleCompileRequest(req, SELF_ORIGIN, registry)).toBeNull();
  });

  it("accepts POSTs to a different self origin (e.g. preview deploys)", () => {
    /* The SW's origin is whatever it was registered under — on
     * preview deploys, that's `*.vercel.app`. The gate must use
     * `selfOrigin` as the source of truth, not a hard-coded
     * production domain. */
    const previewOrigin = "https://typeover-feature-xyz.vercel.app";
    const req = new Request(`${previewOrigin}/api/compile/rust`, {
      method: "POST",
      body: "fn main(){}",
    });
    expect(shouldHandleCompileRequest(req, previewOrigin, registry)).toEqual({ lang: "rust" });
  });
});

describe("shouldHandleCompileRequest — prefix gate", () => {
  /* Only paths under /api/compile/ are eligible. Anything else
   * — even POSTs on adjacent paths — passes through untouched. */
  it("rejects POSTs to paths outside the compile prefix", () => {
    expect(shouldHandleCompileRequest(postTo("/api/runtimes"), SELF_ORIGIN, registry)).toBeNull();
    expect(shouldHandleCompileRequest(postTo("/compile-cache/rust/abc.wasm"), SELF_ORIGIN, registry)).toBeNull();
    expect(shouldHandleCompileRequest(postTo("/"), SELF_ORIGIN, registry)).toBeNull();
  });

  it("requires a lang segment after the prefix — bare prefix returns null", () => {
    /* `/api/compile/` with no lang would slice to an empty string,
     * which isn't in the registry. Belt-and-braces: the registry
     * check below catches it, but a regression that special-cased
     * empty paths upstream would still find this here. */
    expect(shouldHandleCompileRequest(postTo("/api/compile/"), SELF_ORIGIN, registry)).toBeNull();
  });

  /* The exported constant is part of the contract — sw-handler
   * uses CACHE_PREFIX, and this module owns COMPILE_PREFIX. If
   * either drifts the cache lookup goes through but the L1 hit
   * never lands on disk. Pin the literal here so an accidental
   * rename surfaces in the test rather than at runtime. */
  it("exports the literal prefix that the SW shell uses", () => {
    expect(COMPILE_PREFIX).toBe("/api/compile/");
  });
});

describe("shouldHandleCompileRequest — registry gate", () => {
  /* The lang must exist in the registry. Unregistered langs fall
   * through to network — the upstream Function returns the
   * canonical 404, no half-handled response. */
  it("rejects POSTs for langs not in the registry", () => {
    expect(shouldHandleCompileRequest(postTo("/api/compile/zig"), SELF_ORIGIN, registry)).toBeNull();
    expect(shouldHandleCompileRequest(postTo("/api/compile/go"), SELF_ORIGIN, registry)).toBeNull();
    expect(
      shouldHandleCompileRequest(postTo("/api/compile/__proto__"), SELF_ORIGIN, registry),
    ).toBeNull();
  });

  it("accepts every lang in a multi-lang registry", () => {
    const multi = {
      rust: rustEntry,
      zig: { id: "zig", normalize: (s: string) => s },
    };
    expect(shouldHandleCompileRequest(postTo("/api/compile/rust"), SELF_ORIGIN, multi)).toEqual({
      lang: "rust",
    });
    expect(shouldHandleCompileRequest(postTo("/api/compile/zig"), SELF_ORIGIN, multi)).toEqual({
      lang: "zig",
    });
  });
});
