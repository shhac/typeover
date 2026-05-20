import { createSignal } from "solid-js";
import { getRunner, terminateRunner } from "~/runtime";

/*
 * Headless lifecycle for any component that runs Go code via the
 * Yaegi worker — Freeform, FillBlankLineInput, the dev-only
 * YaegiSmoke probe. Owns:
 *
 *   - the running / runResult signals
 *   - the run() async function (timer + eval + error-coercion)
 *   - the reset() function (terminate worker + sentinel result)
 *
 * Consumers supply a `buildProgram` accessor — the function the hook
 * calls to assemble the program text on each Run. That's the one
 * thing the three call sites genuinely differed on; everything else
 * was identical try/catch/finally + signal plumbing.
 *
 * Why a hook rather than a context / singleton: each exercise wants
 * its own runResult lifecycle. The runner itself is the singleton
 * (in src/runtime/index.ts) — this hook only owns the per-component
 * state around it.
 *
 * Generation-tagged settlements (design-docs/19 F-2). Every run()
 * captures a generation counter that reset() / clear() bump. When
 * a stale eval finally resolves/rejects (the dead worker's pending
 * Comlink call), we compare its generation against the current one
 * and discard the settlement if it's stale. Without this, a Reset
 * during a runaway loop is racy: the killed worker's late rejection
 * overwrites the "Runtime was reset" sentinel; a re-Run after Reset
 * sees its own result silently clobbered by the older rejection.
 */

export interface RunResult {
  stdout: string;
  stderr: string;
  error: string;
  durationMs: number;
}

export interface YaegiRunHandle {
  /** Last completed run's outcome, or null pre-first-run / post-reset. */
  runResult: () => RunResult | null;
  /** True while an eval is in flight. Block double-Run, show spinner. */
  running: () => boolean;
  /** Assemble + send the program. Idempotent under racing clicks. */
  run: () => Promise<void>;
  /** Hard-reset the worker (for a runaway loop). Sets a sentinel
   *  runResult so the UI shows what happened. */
  reset: () => void;
  /** Clear runResult (e.g. for an exercise's onTryAgain / onAnother). */
  clear: () => void;
}

interface UseYaegiRunArgs {
  /** Called inside run() to produce the program text. Lets the hook
   *  stay agnostic to whether the program is the learner's raw input
   *  (Freeform), a substituted scaffold (FillBlankLineInput), or
   *  whatever else. */
  buildProgram: () => string;
}

export function useYaegiRun(args: UseYaegiRunArgs): YaegiRunHandle {
  const [runResult, setRunResult] = createSignal<RunResult | null>(null);
  const [running, setRunning] = createSignal(false);

  /* Monotonic counter — bumped on every reset() and clear(). run()
   * captures the value at start, then settlements compare against
   * the current value before writing to runResult. */
  let generation = 0;
  const currentGen = () => generation;
  const bumpGen = () => {
    generation += 1;
  };

  async function run(): Promise<void> {
    if (running()) return;
    const gen = currentGen();
    setRunning(true);
    const t0 = performance.now();
    try {
      const runner = getRunner();
      const r = await runner.eval(args.buildProgram());
      if (gen !== currentGen()) return; /* stale — reset/clear happened mid-flight */
      setRunResult({
        stdout: r.stdout,
        stderr: r.stderr,
        error: r.error,
        durationMs: performance.now() - t0,
      });
    } catch (e) {
      if (gen !== currentGen()) return; /* stale — see above */
      setRunResult({
        stdout: "",
        stderr: "",
        error: e instanceof Error ? e.message : String(e),
        durationMs: performance.now() - t0,
      });
    } finally {
      /* Only flip running back off when we're the latest generation.
       * If a reset happened, it already cleared running; flipping it
       * here would re-allow a Run before the worker is ready. */
      if (gen === currentGen()) setRunning(false);
    }
  }

  function reset(): void {
    /* Hard-reset the runtime when the learner's code looks stuck.
     * Yaegi runs single-threaded inside the worker, so an infinite
     * loop blocks subsequent calls until the worker is terminated.
     * Bumping the generation invalidates any in-flight eval; its
     * eventual rejection won't touch runResult. */
    bumpGen();
    terminateRunner();
    setRunning(false);
    setRunResult({
      stdout: "",
      stderr: "",
      error: "Runtime was reset. Click Run again to try.",
      durationMs: 0,
    });
  }

  function clear(): void {
    /* clear() also invalidates pending runs — a learner who edits
     * the input mid-flight expects that result to be discarded too,
     * not silently land in runResult after they've moved on. */
    bumpGen();
    setRunResult(null);
  }

  return { runResult, running, run, reset, clear };
}
