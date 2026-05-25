/// <reference lib="WebWorker" />
/*
 * Rust runtime in a Web Worker.
 *
 * Mirrors src/runtime/yaegi-worker.ts and zig-worker.ts in API
 * shape: Comlink-exposed `ready()` + `eval(code)` returning
 * `{ stdout, stderr, error }`.
 *
 * Pipeline difference: Rust doesn't compile in the worker. The
 * worker POSTs the source to /api/compile/rust, gets back a
 * wasm32-wasip1 binary, and runs it via @bjorn3/browser_wasi_shim
 * (the shared runWasiBinary helper). The service worker
 * (public/sw-compile-cache.js) intercepts the POST, hashes the
 * normalized source, and short-circuits L1 cache hits to
 * /compile-cache/rust/<hash>.wasm — so the common case never
 * touches the Vercel Function.
 *
 * Per design-docs/32.
 */

import { expose } from "comlink";
import { runWasiBinary, type WasiRunResult } from "./wasi-run";

const api = {
  /** Idempotent. The Rust worker has no warm-up work — there's no
   *  bundled compiler wasm to fetch ahead of time. Kept for shape
   *  parity with the Yaegi/Zig runners so the consuming hook is
   *  identical across runtimes. */
  async ready(): Promise<void> {
    /* nothing to prefetch */
  },

  /** Send source to the compile-service, run the returned wasm,
   *  return captured stdout/stderr. The fetch is what the SW
   *  intercepts; cache hits never hit the network beyond the
   *  initial 200 from the CDN. */
  async eval(code: string): Promise<WasiRunResult> {
    const compiled = await fetchCompiledWasm(code);
    if (!compiled.ok) {
      return { stdout: "", stderr: "", error: compiled.error };
    }
    return runWasiBinary(compiled.bytes);
  },
};

expose(api);

export type RustWorkerAPI = typeof api;

type FetchResult =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; error: string };

/** POST learner source to the compile-service and unwrap the
 *  response into a binary-or-error result. The SW intercepts this
 *  fetch (when registered) and serves L1 cache hits directly from
 *  /compile-cache/rust/<hash>.wasm; the Function only fires for
 *  truly novel inputs. */
async function fetchCompiledWasm(code: string): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch("/api/compile/rust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: code }),
    });
  } catch (err) {
    return { ok: false, error: `[transport] ${(err as Error).message}` };
  }
  if (!res.ok) {
    /* The Function (and the SW fallthrough on L1 miss) returns 422
     * with a stderr-shaped body on compile failure, and 5xx for
     * transport-level problems. Surface either as `error` so the
     * freeform UI can show it. */
    let message = `compile request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* non-JSON body — fall back to the status-derived message. */
    }
    return { ok: false, error: message };
  }
  return { ok: true, bytes: await res.arrayBuffer() };
}
