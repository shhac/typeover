import { wrap, type Remote } from "comlink";
import type { YaegiWorkerAPI } from "./yaegi-worker";

/*
 * Main-thread accessor for the Yaegi worker. One worker per page —
 * the worker is cheap to spawn but the WASM (~11 MB raw, ~1.9 MB
 * brotli) is best loaded once and reused across exercises.
 *
 * Consumers (freeform exercise components) call `getRunner()`,
 * `await runner.ready()`, then `runner.eval(code)`. The worker
 * boots lazily on the first getRunner() call so MCQ / fill-* pages
 * never download Yaegi.
 *
 * Terminate hook is provided for when we want to hard-reset the
 * worker between exercises (e.g. learner triggered an infinite loop
 * and we want to recover without a page reload). Step 3 wires this
 * to a "Stop" button alongside the freeform exercise component.
 */

export type YaegiRunner = Remote<YaegiWorkerAPI>;

let runner: YaegiRunner | null = null;
let worker: Worker | null = null;

export function getRunner(): YaegiRunner {
  if (runner) return runner;
  worker = new Worker(new URL("./yaegi-worker.ts", import.meta.url), {
    type: "module",
  });
  runner = wrap<YaegiWorkerAPI>(worker);
  /* Kick off the WASM load immediately. `ready()` is idempotent on
   * the worker side, so an exercise component awaiting it later
   * piggybacks on this in-flight init rather than starting a second. */
  void runner.ready();
  return runner;
}

/** Kill the worker. Next `getRunner()` will spawn a fresh one with a
 *  fresh WASM load. Use this after a runaway-loop watchdog or when
 *  the learner clicks "Stop" in the freeform component. */
export function terminateRunner(): void {
  worker?.terminate();
  worker = null;
  runner = null;
}
