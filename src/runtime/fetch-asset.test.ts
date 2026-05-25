import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAssetOrThrow } from "./fetch-asset";

/*
 * Tiny helper, four callers (zig-compile×3 + yaegi-worker), each
 * relying on the throw to short-circuit the asset-loading pipeline.
 * If the throw fires when the asset is OK, the worker boot looks
 * broken; if it DOESN'T fire on a non-OK response, the next pipeline
 * stage (WebAssembly.compileStreaming, decompressIfGzipped, etc.)
 * fails with a much less helpful error.
 */

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
});

function stubFetch(impl: typeof fetch): void {
  globalThis.fetch = impl;
}

describe("fetchAssetOrThrow — happy path", () => {
  it("returns the Response when status is 200", async () => {
    const expected = new Response("ok-body", { status: 200 });
    stubFetch(vi.fn().mockResolvedValue(expected));
    const res = await fetchAssetOrThrow("/zig/zig.wasm", "zig.wasm");
    expect(res).toBe(expected);
  });

  it("passes the URL through to fetch verbatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    stubFetch(fetchMock);
    await fetchAssetOrThrow("/yaegi/wasm_exec.js", "wasm_exec.js");
    expect(fetchMock).toHaveBeenCalledWith("/yaegi/wasm_exec.js");
  });
});

describe("fetchAssetOrThrow — error throw", () => {
  it("throws with the label + status when the response is 404", async () => {
    stubFetch(vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    await expect(fetchAssetOrThrow("/zig/zig.wasm", "zig.wasm")).rejects.toThrow(
      "zig.wasm fetch failed (404)",
    );
  });

  it("throws with the label + status when the response is 5xx", async () => {
    stubFetch(vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchAssetOrThrow("/zig/zig-stdlib.tar.gz", "zig-stdlib.tar.gz")).rejects.toThrow(
      "zig-stdlib.tar.gz fetch failed (503)",
    );
  });

  it("derives the label from the URL's last segment when omitted", async () => {
    /* Defensive default — callers SHOULD pass an explicit label so
     * the error message is stable across path changes, but the
     * derivation lets `fetchAssetOrThrow(url)` work without a
     * second arg for one-off use. */
    stubFetch(vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    await expect(fetchAssetOrThrow("/zig/libcompiler_rt.a")).rejects.toThrow(
      "libcompiler_rt.a fetch failed (404)",
    );
  });

  it("propagates network errors (fetch itself rejecting) unchanged", async () => {
    /* The helper does NOT wrap network errors with a `[transport]`
     * prefix — those throws should hit the worker's outer error
     * coercion (errorMessage), same as any other unexpected throw.
     * fetchAssetOrThrow is only responsible for the !res.ok case. */
    stubFetch(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchAssetOrThrow("/zig/zig.wasm", "zig.wasm")).rejects.toThrow(
      "Failed to fetch",
    );
  });
});
