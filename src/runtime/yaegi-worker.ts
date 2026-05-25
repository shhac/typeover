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

import type { WorkerEvalResult as YaegiResult } from "./types";
import { fetchAssetOrThrow } from "./fetch-asset";

let initPromise: Promise<void> | null = null;

/** Step 1: fetch + eval wasm_exec.js, which registers `Go` on the
 *  worker's globalThis. No-op if Go is already registered. */
async function loadGoBootstrap(): Promise<void> {
  if (typeof self.Go !== "undefined") return;
  const res = await fetchAssetOrThrow("/yaegi/wasm_exec.js");
  const execSrc = await res.text();
  /* The script writes to `globalThis.Go` via the `self`/`window`
   * branch inside it. Function-constructor execution gives the
   * script global scope without the CSP cost of inline <script>. */
  new Function(execSrc)();
  if (typeof self.Go === "undefined") {
    throw new Error("wasm_exec.js loaded but did not register globalThis.Go");
  }
}

/** Step 2+3: instantiate yaegi.wasm against go.importObject and start
 *  the Go runtime. The returned promise from `go.run` resolves only
 *  when the runtime exits, which it won't by design — we fire it and
 *  yield a microtask so the yaegiEval registration completes before
 *  the first eval call. */
async function instantiateYaegi(go: GoRuntime): Promise<void> {
  const wasmRes = await WebAssembly.instantiateStreaming(
    fetch("/yaegi/yaegi.wasm"),
    go.importObject,
  );
  void go.run(wasmRes.instance);
  await Promise.resolve();
  if (typeof self.yaegiEval !== "function") {
    throw new Error("WASM ran but did not register yaegiEval");
  }
}

async function init(): Promise<void> {
  await loadGoBootstrap();
  await instantiateYaegi(new self.Go!());
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
