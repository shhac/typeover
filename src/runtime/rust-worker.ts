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
 * wasm32-wasip1 binary, and runs it via @bjorn3/browser_wasi_shim.
 * The service worker (public/sw-compile-cache.js) intercepts the
 * POST, hashes the normalized source, and short-circuits L1 cache
 * hits to /compile-cache/rust/<hash>.wasm — so the common case
 * never touches the Vercel Function.
 *
 * Per design-docs/32.
 */

import { expose } from "comlink";
import {
  ConsoleStdout,
  File,
  OpenFile,
  PreopenDirectory,
  WASI,
  type Fd,
  type Inode,
} from "@bjorn3/browser_wasi_shim";

interface RustResult {
  stdout: string;
  stderr: string;
  /** Empty on clean compile + clean exit. Compile errors from the
   *  server arrive here; runtime traps (panic, unreachable) too. */
  error: string;
}

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
  async eval(code: string): Promise<RustResult> {
    let wasmBytes: ArrayBuffer;
    try {
      const res = await fetch("/api/compile/rust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: code }),
      });
      if (!res.ok) {
        /* The Function (and the SW fallthrough on L1 miss) returns
         * 422 with a stderr-shaped body on compile failure, and 5xx
         * for transport-level problems. Surface either as `error`
         * so the freeform UI can show it. */
        let message = `compile request failed (${res.status})`;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {
          /* non-JSON body */
        }
        return { stdout: "", stderr: "", error: message };
      }
      wasmBytes = await res.arrayBuffer();
    } catch (err) {
      return {
        stdout: "",
        stderr: "",
        error: `[transport] ${(err as Error).message}`,
      };
    }
    return run(wasmBytes);
  },
};

expose(api);

export type RustWorkerAPI = typeof api;

/* Run a wasm32-wasip1 binary with a captured stdio set. Mirrors
 * the run() in zig-worker.ts; only the argv label differs. */
async function run(wasmBytes: ArrayBuffer): Promise<RustResult> {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };
  const stdoutFd = ConsoleStdout.lineBuffered((line) => {
    stdoutBuf.text += line + "\n";
  });
  const stderrFd = ConsoleStdout.lineBuffered((line) => {
    stderrBuf.text += line + "\n";
  });

  const fds: Fd[] = [
    new OpenFile(new File([])),
    stdoutFd,
    stderrFd,
    new PreopenDirectory(".", new Map<string, Inode>()),
  ];
  const wasi = new WASI(["main.wasm"], [], fds, { debug: false });

  let error = "";
  try {
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    /* wasi.start expects a specific export shape; our binary has
     * `_start` from rustc's wasm32-wasip1 lowering. */
    wasi.start(instance as unknown as Parameters<typeof wasi.start>[0]);
  } catch (err) {
    /* WASI exits propagate as a thrown WASIExit; treat exitCode === 0
     * as success (no error), anything else as a runtime trap. */
    const e = err as { exitCode?: number; message?: string };
    if (typeof e.exitCode === "number") {
      if (e.exitCode !== 0) {
        error =
          stderrBuf.text.trim() ||
          `program exited with code ${e.exitCode}`;
      }
    } else {
      error = e.message || String(err);
    }
  }

  return { stdout: stdoutBuf.text, stderr: stderrBuf.text, error };
}
