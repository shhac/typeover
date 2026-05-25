import { describe, expect, it } from "vitest";

import type { CompileTransport } from "../../lib/compile-service/transports/types";
import { createRustCompilePostHandler, GET } from "./rust";

function request(body: BodyInit): Request {
  return new Request("https://typeover.dev/api/compile/rust", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeTransport(compile: CompileTransport["compile"]): CompileTransport {
  return { name: "fake", compile };
}

async function responseJson(response: Response): Promise<{ error?: string }> {
  return (await response.json()) as { error?: string };
}

describe("/api/compile/rust", () => {
  it("rejects invalid JSON before calling the transport", async () => {
    let calls = 0;
    const post = createRustCompilePostHandler(
      fakeTransport(async () => {
        calls++;
        return { ok: false, message: "should not compile", elapsedSeconds: 0 };
      }),
    );

    const response = await post(request("{"));
    expect(response.status).toBe(400);
    expect(await responseJson(response)).toEqual({ error: "Body must be JSON." });
    expect(calls).toBe(0);
  });

  it("maps validation failures to their status", async () => {
    const post = createRustCompilePostHandler(
      fakeTransport(async () => ({ ok: false, message: "should not compile", elapsedSeconds: 0 })),
    );

    const response = await post(request(JSON.stringify({ source: "" })));
    expect(response.status).toBe(400);
    expect((await responseJson(response)).error).toMatch(/empty/);
  });

  it("returns compiler failures as 422 JSON", async () => {
    const post = createRustCompilePostHandler(
      fakeTransport(async () => ({ ok: false, message: "rustc says no", elapsedSeconds: 1.2 })),
    );

    const response = await post(request(JSON.stringify({ source: "fn main() {}" })));
    expect(response.status).toBe(422);
    expect(await responseJson(response)).toEqual({ error: "rustc says no" });
  });

  it("returns thrown transport errors as 422 JSON", async () => {
    const post = createRustCompilePostHandler(
      fakeTransport(async () => {
        throw new Error("sandbox unavailable");
      }),
    );

    const response = await post(request(JSON.stringify({ source: "fn main() {}" })));
    expect(response.status).toBe(422);
    expect(await responseJson(response)).toEqual({ error: "sandbox unavailable" });
  });

  it("streams wasm bytes with compile metadata on success", async () => {
    const wasm = new Uint8Array([0, 97, 115, 109]);
    let receivedSource = "";
    const post = createRustCompilePostHandler(
      fakeTransport(async (req) => {
        receivedSource = req.source;
        return { ok: true, wasm, elapsedSeconds: 1.234 };
      }),
    );

    const response = await post(request(JSON.stringify({ source: "fn main() {}" })));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/wasm");
    expect(response.headers.get("X-Typeover-Compile-Seconds")).toBe("1.23");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([...wasm]);
    expect(receivedSource).toBe("fn main() {}");
  });

  it("gates non-POST callers", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(await responseJson(response)).toEqual({ error: "POST only." });
  });
});
