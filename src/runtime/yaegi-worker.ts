/// <reference lib="WebWorker" />
/*
 * Yaegi runtime in a Web Worker.
 *
 * Why a worker: a learner's `for {}` loop must not freeze the tab.
 * The worker is isolatable, killable, and can be hard-reset between
 * exercises (we'll add a terminate-and-respawn mechanism alongside
 * Step 3's snippet matrix).
 *
 * Loading shape:
 *   1. Fetch /yaegi/wasm_exec.js (Go's bootstrap shim) and evaluate it
 *      via `new Function`. We don't use `importScripts` because Vite
 *      ships this file as a module worker (importScripts is classic-
 *      worker-only), and Go's wasm_exec.js is a plain non-module
 *      script that needs to register `Go` on globalThis to be useful.
 *   2. Fetch /yaegi/yaegi.wasm and instantiate against go.importObject.
 *   3. `go.run(instance)` starts the Go runtime, which calls
 *      js.Global().Set("yaegiEval", …) before parking on a channel.
 *      That registration is synchronous — by the time go.run returns
 *      from its first event-loop tick, yaegiEval is callable.
 *
 * Comlink exposes `ready()` (idempotent, awaited by callers before
 * first eval) and `eval(code)`.
 */

import { expose } from "comlink";

/* The runtime adds these to globalThis after wasm_exec.js runs and
 * the WASM has started. Typed minimally — we don't model Go's whole
 * surface here. */
declare const self: WorkerGlobalScope &
  typeof globalThis & {
    Go?: new () => GoRuntime;
    yaegiEval?: (code: string) => YaegiResult;
  };

interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

interface YaegiResult {
  stdout: string;
  stderr: string;
  error: string;
}

let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  /* 1. Load wasm_exec.js. */
  if (typeof self.Go === "undefined") {
    const execSrc = await fetch("/yaegi/wasm_exec.js").then((r) => {
      if (!r.ok) throw new Error(`wasm_exec.js fetch failed (${r.status})`);
      return r.text();
    });
    /* The script writes to `globalThis.Go` via the `self`/`window`
     * branch inside it. Function-constructor execution gives the
     * script global scope without the CSP cost of inline <script>. */
    new Function(execSrc)();
  }
  if (typeof self.Go === "undefined") {
    throw new Error("wasm_exec.js loaded but did not register globalThis.Go");
  }

  /* 2. Instantiate the WASM. */
  const go = new self.Go();
  const wasmRes = await WebAssembly.instantiateStreaming(
    fetch("/yaegi/yaegi.wasm"),
    go.importObject,
  );

  /* 3. Run — fire and forget. The Go runtime parks on a channel
   * after registering yaegiEval; the returned promise resolves
   * when the runtime exits (which it won't, by design). We don't
   * await it. */
  void go.run(wasmRes.instance);

  /* Yield one microtask so yaegiEval registration completes. */
  await Promise.resolve();
  if (typeof self.yaegiEval !== "function") {
    throw new Error("WASM ran but did not register yaegiEval");
  }
}

const api = {
  /** Idempotent — every call returns the same in-flight or settled
   *  init promise. First call kicks off the WASM load; subsequent
   *  calls await the same result. */
  async ready(): Promise<void> {
    if (!initPromise) initPromise = init();
    return initPromise;
  },

  /** Run the user's Go code. Resolves to { stdout, stderr, error }.
   *  `error` is the empty string on a clean run; compile / runtime
   *  errors land there. */
  async eval(code: string): Promise<YaegiResult> {
    await this.ready();
    /* yaegiEval is synchronous on the worker thread — it blocks the
     * worker's event loop for the duration of the interpretation.
     * That's why this is in a worker: an infinite loop in the learner's
     * code freezes this worker, not the main page. */
    return self.yaegiEval!(code);
  },
};

expose(api);

export type YaegiWorkerAPI = typeof api;
