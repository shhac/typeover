import { describe, expect, it, vi } from "vitest";
import { fetchCompiledWasm } from "./compile-fetch";

/*
 * Cover every branch of the response unwrap. The helper is the
 * single network seam the Rust worker (and any future server-compile
 * language) drives through; a regression here would either drop
 * compile diagnostics from the freeform UI or surface raw HTTP
 * status codes instead of the rustc stderr.
 *
 * The fetch is injected via the `deps.fetch` override so each test
 * can simulate the four documented response shapes without touching
 * the global. The production worker calls `fetchCompiledWasm("rust",
 * code)` with no deps, so the default-arg path is also exercised
 * implicitly through type-check time.
 */

function makeOkResponse(bytes: Uint8Array): Response {
  /* Slice() returns a Uint8Array<ArrayBuffer> (a backed-by-non-shared
   * buffer subtype) that satisfies BodyInit, whereas a bare
   * Uint8Array<ArrayBufferLike> from the literal does not. */
  return new Response(bytes.slice(), {
    status: 200,
    headers: { "Content-Type": "application/wasm" },
  });
}

function makeJsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchCompiledWasm — happy path", () => {
  it("returns the wasm bytes on a 200 OK response", async () => {
    const wasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse(wasm));
    const result = await fetchCompiledWasm("rust", "fn main() {}", { fetch: fetchMock });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(new Uint8Array(result.bytes)).toEqual(wasm);
    }
  });

  it("POSTs to /api/compile/<language> with JSON body containing the source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse(new Uint8Array([0])));
    await fetchCompiledWasm("rust", 'fn main() { println!("hi"); }', { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/compile/rust");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    /* The body is the literal source under the `source` key — the
     * SW reads this same field to extract the bytes to hash. A
     * regression that wrapped this differently would silently
     * disable the L1 cache (SW would extract the wrong string). */
    expect(JSON.parse(init.body)).toEqual({
      source: 'fn main() { println!("hi"); }',
    });
  });
});

describe("fetchCompiledWasm — compile failure (4xx with JSON error)", () => {
  /* The Function (and the SW fallthrough on L1 miss) returns 422
   * with `{ error: <rustc stderr> }` on compile failure. The
   * helper surfaces that message verbatim. */
  it("returns the JSON error body verbatim on 422", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        makeJsonError(422, "error[E0425]: cannot find value `foo` in this scope"),
      );
    const result = await fetchCompiledWasm("rust", "fn main(){ foo(); }", { fetch: fetchMock });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("error[E0425]: cannot find value `foo` in this scope");
    }
  });

  it("returns the JSON error body on a 4xx status that isn't 422", async () => {
    /* validateRustSource returns 400 on body-shape errors and 413
     * on size-limit violations. The helper doesn't care about the
     * specific status — it propagates the error string. */
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeJsonError(413, "Source exceeds 16 KB cap."));
    const result = await fetchCompiledWasm("rust", "x".repeat(20000), { fetch: fetchMock });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Source exceeds 16 KB cap.");
  });
});

describe("fetchCompiledWasm — non-JSON error body", () => {
  /* If a 5xx response is returned without a parseable JSON body
   * (e.g. an edge/load-balancer-level error before the Function
   * ran), fall back to a status-derived message so the UI still
   * shows something meaningful. */
  it("falls back to status-derived message when body isn't JSON", async () => {
    const res = new Response("<html>502 bad gateway</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });
    const fetchMock = vi.fn().mockResolvedValue(res);
    const result = await fetchCompiledWasm("rust", "fn main(){}", { fetch: fetchMock });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("compile request failed (502)");
  });

  it("falls back to status-derived message when JSON body lacks an `error` string", async () => {
    /* Defensive: a hypothetical malformed response with JSON that
     * doesn't include `error: string`. The current Function
     * always returns the right shape; this pin protects against
     * a refactor that changes the field name. */
    const res = new Response(JSON.stringify({ details: "something else" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    const fetchMock = vi.fn().mockResolvedValue(res);
    const result = await fetchCompiledWasm("rust", "fn main(){}", { fetch: fetchMock });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("compile request failed (500)");
  });
});

describe("fetchCompiledWasm — network throw", () => {
  /* fetch() throws on DNS failure, offline, CORS preflight reject,
   * etc. Surface the message with a `[transport]` prefix so the
   * UI can distinguish network problems from compile diagnostics. */
  it("wraps a thrown error with a [transport] prefix", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await fetchCompiledWasm("rust", "fn main(){}", { fetch: fetchMock });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("[transport] Failed to fetch");
  });

  it("handles a non-Error throw via String(err)", async () => {
    /* eslint-disable-next-line @typescript-eslint/only-throw-error */
    const fetchMock = vi.fn().mockRejectedValue("offline");
    const result = await fetchCompiledWasm("rust", "fn main(){}", { fetch: fetchMock });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("[transport] offline");
  });
});
