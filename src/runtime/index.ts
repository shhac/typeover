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
 *
 * Each language registers via `makeRunnerAccessor` — a closure-based
 * factory that owns the singleton + worker pair. Eliminates the
 * copy-paste-with-renames pattern that would otherwise repeat once
 * per language, and prevents the per-language drift mode the
 * `index.test.ts` "singletons are isolated" suite was created to
 * catch.
 */

export type YaegiRunner = Remote<YaegiWorkerAPI>;
export type ZigRunner = Remote<ZigWorkerAPI>;
export type RustRunner = Remote<RustWorkerAPI>;

/* Every worker API exposes a `ready()` for the lazy WASM-load
 * piggyback below — constrain the factory's API generic to that
 * shape so `runner.ready()` typechecks without a cast. */
interface RunnerLike {
  ready(): Promise<void>;
}

interface RunnerAccessor<API extends RunnerLike> {
  get(): Remote<API>;
  terminate(): void;
}

/** Build a lazy-singleton accessor pair for a worker module. The
 *  worker URL is captured at registration time; the singleton +
 *  underlying `Worker` instance live in the returned closure so
 *  each language has its own isolated state — no module-level
 *  `let runner; let worker;` proliferation. */
function makeRunnerAccessor<API extends RunnerLike>(workerUrl: URL): RunnerAccessor<API> {
  let runner: Remote<API> | null = null;
  let worker: Worker | null = null;
  return {
    get(): Remote<API> {
      if (runner) return runner;
      worker = new Worker(workerUrl, { type: "module" });
      runner = wrap<API>(worker);
      /* Kick off the WASM (or compile-service) load immediately.
       * `ready()` is idempotent on the worker side, so an exercise
       * component awaiting it later piggybacks on this in-flight
       * init rather than starting a second. */
      void runner.ready();
      return runner;
    },
    terminate(): void {
      worker?.terminate();
      worker = null;
      runner = null;
    },
  };
}

const yaegiAccessor = makeRunnerAccessor<YaegiWorkerAPI>(
  new URL("./yaegi-worker.ts", import.meta.url),
);
const zigAccessor = makeRunnerAccessor<ZigWorkerAPI>(
  new URL("./zig-worker.ts", import.meta.url),
);
const rustAccessor = makeRunnerAccessor<RustWorkerAPI>(
  new URL("./rust-worker.ts", import.meta.url),
);

/** Lazy accessor for the Yaegi runner. */
export const getRunner = (): YaegiRunner => yaegiAccessor.get();
/** Kill the Yaegi worker. Next `getRunner()` spawns a fresh one
 *  with a fresh WASM load. Use after a runaway-loop watchdog or
 *  when the learner clicks "Stop" in the freeform component. */
export const terminateRunner = (): void => yaegiAccessor.terminate();

/** Lazy accessor for the Zig runner. Boots the compiler wasm on
 *  first call; the heavier stdlib bundle is deferred to the first
 *  eval() (see comment in zig-worker.ts on the split-loading model). */
export const getZigRunner = (): ZigRunner => zigAccessor.get();
export const terminateZigRunner = (): void => zigAccessor.terminate();

/** Lazy accessor for the Rust runner. Boots a worker that proxies
 *  compile requests to /api/compile/rust (intercepted by the SW
 *  for L1 cache hits) and runs returned wasm via
 *  @bjorn3/browser_wasi_shim. No compiler payload to fetch
 *  ahead-of-time — `ready()` is a no-op. */
export const getRustRunner = (): RustRunner => rustAccessor.get();
export const terminateRustRunner = (): void => rustAccessor.terminate();
