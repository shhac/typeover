/// <reference lib="WebWorker" />
/*
 * Zig runtime in a Web Worker.
 *
 * Mirrors src/runtime/yaegi-worker.ts and rust-worker.ts in shape:
 * Comlink-exposed `ready()` + `eval(code)` returning
 * `{ stdout, stderr, error }`. The compile + asset-loading pipeline
 * lives in `./zig-compile.ts`; this file is the thin Comlink-expose
 * entry that drives it.
 *
 * Why no separate "runner" worker (like zigtools/playground uses):
 * the typing-exercise host (main thread) already owns the
 * terminate-and-respawn lifecycle via terminateRunner() in
 * src/runtime/index.ts. If learner code hangs, the whole worker dies
 * and a fresh one boots — simpler than a two-worker dance for our
 * single-shot, run-on-submit use case.
 */

import { expose } from "comlink";
import { runWasiBinary } from "./wasi-run";
import { loadCompilerModule, loadHeavyAssets, tryCompile } from "./zig-compile";

interface ZigResult {
  stdout: string;
  stderr: string;
  /* Empty on a clean compile + run. Compile errors land here verbatim
   * from the Zig compiler's stderr; runtime traps (panic, unreachable)
   * land here too. */
  error: string;
}

const api = {
  /** Idempotent — first call kicks off the compiler wasm fetch. The
   *  heavier stdlib + compiler-rt fetches are deferred to the first
   *  eval() call. */
  async ready(): Promise<void> {
    await loadCompilerModule();
  },

  /** Compile + run user Zig source. Resolves to { stdout, stderr,
   *  error }. `error` is empty on a clean compile + clean exit;
   *  compile errors and runtime traps both surface there. */
  async eval(code: string): Promise<ZigResult> {
    const assets = await loadHeavyAssets();
    const compiled = await tryCompile(code, assets);
    if (!compiled.ok) {
      return { stdout: "", stderr: "", error: compiled.error };
    }
    /* Stage 2: run the compiled program. Separate WASI context,
     * separate memory — the compiler's address space is irrelevant.
     * Identical pattern to the Rust worker's post-compile run;
     * shared via `runWasiBinary` in wasi-run.ts. */
    return runWasiBinary(compiled.bytes);
  },
};

expose(api);

export type ZigWorkerAPI = typeof api;
