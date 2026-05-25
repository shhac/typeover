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
import { fetchCompiledWasm } from "./compile-fetch";

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
    const compiled = await fetchCompiledWasm("rust", code);
    if (!compiled.ok) {
      return { stdout: "", stderr: "", error: compiled.error };
    }
    return runWasiBinary(compiled.bytes);
  },
};

expose(api);

export type RustWorkerAPI = typeof api;
