import { wrap, type Remote } from "comlink";
import type { YaegiWorkerAPI } from "./yaegi-worker";
import type { ZigWorkerAPI } from "./zig-worker";
import type { RustWorkerAPI } from "./rust-worker";

/*
 * Main-thread accessors for the language-specific WASM runtimes. One
 * worker per language per page — workers are cheap to spawn but the
 * WASM payloads are best loaded once and reused across exercises in
 * the same track.
 *
 * Consumers (freeform exercise components) call the right getter for
 * their track, await `ready()`, then call `eval(code)`. Workers boot
 * lazily on the first getter call, so an MCQ-only page never
 * downloads any language runtime.
 *
 * Terminate hooks are provided for when we want to hard-reset a
 * worker between exercises (e.g. learner triggered an infinite loop
 * and we want to recover without a page reload).
 */

export type YaegiRunner = Remote<YaegiWorkerAPI>;
export type ZigRunner = Remote<ZigWorkerAPI>;
export type RustRunner = Remote<RustWorkerAPI>;

let yaegiRunner: YaegiRunner | null = null;
let yaegiWorker: Worker | null = null;

export function getRunner(): YaegiRunner {
  if (yaegiRunner) return yaegiRunner;
  yaegiWorker = new Worker(new URL("./yaegi-worker.ts", import.meta.url), {
    type: "module",
  });
  yaegiRunner = wrap<YaegiWorkerAPI>(yaegiWorker);
  /* Kick off the WASM load immediately. `ready()` is idempotent on
   * the worker side, so an exercise component awaiting it later
   * piggybacks on this in-flight init rather than starting a second. */
  void yaegiRunner.ready();
  return yaegiRunner;
}

/** Kill the Yaegi worker. Next `getRunner()` will spawn a fresh one
 *  with a fresh WASM load. Use this after a runaway-loop watchdog or
 *  when the learner clicks "Stop" in the freeform component. */
export function terminateRunner(): void {
  yaegiWorker?.terminate();
  yaegiWorker = null;
  yaegiRunner = null;
}

let zigRunner: ZigRunner | null = null;
let zigWorker: Worker | null = null;

/** Lazy accessor for the Zig runner. Boots the compiler wasm on first
 *  call; the heavier stdlib bundle is deferred to the first eval()
 *  (see comment in zig-worker.ts on the split-loading model). */
export function getZigRunner(): ZigRunner {
  if (zigRunner) return zigRunner;
  zigWorker = new Worker(new URL("./zig-worker.ts", import.meta.url), {
    type: "module",
  });
  zigRunner = wrap<ZigWorkerAPI>(zigWorker);
  void zigRunner.ready();
  return zigRunner;
}

export function terminateZigRunner(): void {
  zigWorker?.terminate();
  zigWorker = null;
  zigRunner = null;
}

let rustRunner: RustRunner | null = null;
let rustWorker: Worker | null = null;

/** Lazy accessor for the Rust runner. Boots a worker that proxies
 *  compile requests to /api/compile/rust (intercepted by the SW
 *  for L1 cache hits) and runs returned wasm via
 *  @bjorn3/browser_wasi_shim. No compiler payload to fetch
 *  ahead-of-time — `ready()` is a no-op. */
export function getRustRunner(): RustRunner {
  if (rustRunner) return rustRunner;
  rustWorker = new Worker(new URL("./rust-worker.ts", import.meta.url), {
    type: "module",
  });
  rustRunner = wrap<RustWorkerAPI>(rustWorker);
  void rustRunner.ready();
  return rustRunner;
}

export function terminateRustRunner(): void {
  rustWorker?.terminate();
  rustWorker = null;
  rustRunner = null;
}
