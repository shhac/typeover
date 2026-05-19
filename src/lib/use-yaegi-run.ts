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

  async function run(): Promise<void> {
    if (running()) return;
    setRunning(true);
    const t0 = performance.now();
    try {
      const runner = getRunner();
      const r = await runner.eval(args.buildProgram());
      setRunResult({
        stdout: r.stdout,
        stderr: r.stderr,
        error: r.error,
        durationMs: performance.now() - t0,
      });
    } catch (e) {
      setRunResult({
        stdout: "",
        stderr: "",
        error: e instanceof Error ? e.message : String(e),
        durationMs: performance.now() - t0,
      });
    } finally {
      setRunning(false);
    }
  }

  function reset(): void {
    /* Hard-reset the runtime when the learner's code looks stuck.
     * Yaegi runs single-threaded inside the worker, so an infinite
     * loop blocks subsequent calls until the worker is terminated. */
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
    setRunResult(null);
  }

  return { runResult, running, run, reset, clear };
}
