import { describe, expect, it, vi } from "vitest";
import { extractSource, handleCompileRequest, CACHE_PREFIX } from "./sw-handler";
import { sha256Hex } from "./hash";
import type { LanguageEntry } from "./normalize";

describe("extractSource", () => {
  it("unwraps the JSON `source` field", () => {
    expect(extractSource(`{"source":"hello"}`)).toBe("hello");
  });

  it("falls back to the legacy `edit` field", () => {
    expect(extractSource(`{"edit":"legacy"}`)).toBe("legacy");
  });

  it("returns undefined when JSON has neither field as a string", () => {
    expect(extractSource(`{"source":42}`)).toBeUndefined();
    expect(extractSource(`{"unrelated":"value"}`)).toBeUndefined();
  });

  it("treats non-JSON-shaped input as raw source", () => {
    expect(extractSource(`fn main() {}`)).toBe(`fn main() {}`);
  });

  it("falls back to raw text when JSON-shaped body is malformed", () => {
    /* Starts with `{` but doesn't parse — treat as raw source so
     * the SW degrades gracefully instead of bailing the request. */
    expect(extractSource(`{not really json`)).toBe(`{not really json`);
  });
});

describe("handleCompileRequest", () => {
  /* Fake LANGUAGE_REGISTRY entry — identity normalize so the
   * source passes through verbatim and the resulting hash is
   * predictable in the test. */
  const rustEntry: LanguageEntry = {
    id: "rust",
    normalize: (s) => s,
  };
  const registry = { rust: rustEntry };

  function makePostRequest(body: string): Request {
    return new Request("https://typeover.test/api/compile/rust", {
      method: "POST",
      body,
    });
  }

  it("L1 hit: returns cached wasm with sw-l1 header", async () => {
    const wasm = new Uint8Array([0, 1, 2, 3, 0x61, 0x73, 0x6d]);
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) => {
        if (typeof url === "string" && url.startsWith(CACHE_PREFIX)) {
          return Promise.resolve(new Response(wasm.slice().buffer, { status: 200 }));
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

    const res = await handleCompileRequest(
      makePostRequest(JSON.stringify({ source: "fn main() {}" })),
      "rust",
      { fetch: fetchMock as unknown as typeof globalThis.fetch, registry },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/wasm");
    expect(res.headers.get("X-Typeover-Cache")).toBe("sw-l1");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual(Array.from(wasm));
  });

  it("hashes the normalized source for the cache URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" }));
    const source = "fn main() {}";
    const expectedHash = await sha256Hex(source);

    await handleCompileRequest(
      makePostRequest(JSON.stringify({ source })),
      "rust",
      { fetch: fetchMock as unknown as typeof globalThis.fetch, registry },
    );

    /* First fetch is the cache lookup; URL must include the
     * expected hex digest so a SW-vs-prebake hash drift is
     * caught here. */
    const cacheCall = fetchMock.mock.calls.find((c) =>
      typeof c[0] === "string" && c[0].startsWith(CACHE_PREFIX),
    );
    expect(cacheCall).toBeDefined();
    expect(cacheCall?.[0]).toBe(`${CACHE_PREFIX}rust/${expectedHash}.wasm`);
  });

  it("L1 miss: falls through to fetch(request)", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url) => {
        if (typeof url === "string" && url.startsWith(CACHE_PREFIX)) {
          return Promise.resolve(new Response(null, { status: 404 }));
        }
        /* The fallthrough fetches the original Request, not a URL string. */
        return Promise.resolve(new Response("compiled-on-server", { status: 200 }));
      });

    const req = makePostRequest(JSON.stringify({ source: "fn main() {}" }));
    const res = await handleCompileRequest(req, "rust", {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      registry,
    });

    expect(await res.text()).toBe("compiled-on-server");
    /* Two fetches: the cache lookup + the fallthrough. */
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("unknown language: passes through to fetch(request) without hashing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    const req = makePostRequest("anything");
    await handleCompileRequest(req, "python", {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      registry,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(req);
  });

  it("plain-text body (no JSON wrapping): uses raw source", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    const raw = "fn main() {}";
    const expectedHash = await sha256Hex(raw);
    await handleCompileRequest(makePostRequest(raw), "rust", {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      registry,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${CACHE_PREFIX}rust/${expectedHash}.wasm`,
    );
  });

  it("JSON with non-string source: falls through without hashing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("server"));
    const req = makePostRequest(JSON.stringify({ source: 42 }));
    await handleCompileRequest(req, "rust", {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      registry,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    /* Single call = the fallthrough; no cache lookup happened. */
    expect(fetchMock.mock.calls[0][0]).toBe(req);
  });
});
