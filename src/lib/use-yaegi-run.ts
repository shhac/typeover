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

/** Runtime boot lifecycle. `uninit` is the pre-mount default and the
 *  state reset() returns to. `booting` is in-flight WASM load. `ready`
 *  means subsequent eval() calls don't pay the ~1.9 MB cold-start
 *  cost. `error` surfaces a boot failure to the UI. */
export type RuntimeStatus = "uninit" | "booting" | "ready" | "error";

export interface YaegiRunHandle {
  /** Last completed run's outcome, or null pre-first-run / post-reset. */
  runResult: () => RunResult | null;
  /** True while an eval is in flight. Block double-Run, show spinner. */
  running: () => boolean;
  /** Runtime boot status. Lets the UI show a "Booting Go runtime…"
   *  indicator and gate Run until ready. design-docs/16 F-4. */
  runtimeStatus: () => RuntimeStatus;
  /** Message when runtimeStatus === "error"; null otherwise. */
  bootError: () => string | null;
  /** True when `runtimeStatus === "booting"` has persisted past
   *  `BOOT_STALL_MS` (5s default) — surfaces a "Retry runtime"
   *  affordance for learners on flaky networks. design-docs/26 P12.
   *  Resets to false on any transition out of "booting". */
  bootStalled: () => boolean;
  /** Assemble + send the program. Idempotent under racing clicks.
   *  Kicks off preflight if the runtime hasn't been booted yet. */
  run: () => Promise<void>;
  /** Hard-reset the worker (for a runaway loop). Sets a sentinel
   *  runResult so the UI shows what happened. */
  reset: () => void;
  /** Clear runResult (e.g. for an exercise's onTryAgain / onAnother). */
  clear: () => void;
  /** Proactively trigger the WASM load so the first Run doesn't pay
   *  the cold-start latency. Safe to call from onMount; idempotent
   *  (subsequent calls during boot are no-ops). */
  preflight: () => void;
}

interface UseYaegiRunArgs {
  /** Called inside run() to produce the program text. Lets the hook
   *  stay agnostic to whether the program is the learner's raw input
   *  (Freeform), a substituted scaffold (FillBlankLineInput), or
   *  whatever else. */
  buildProgram: () => string;
}

/** How long the runtime can sit in "booting" before we surface a
 *  stall indicator. Calibrated against the ~1.9 MB brotli'd WASM
 *  download — a healthy 3G connection lands well under 5s; past
 *  that the user is on a flaky network / captive portal / hung
 *  CDN, and the in-exercise badge "↳ Booting Go runtime…" with no
 *  escape hatch is the wrong UX. */
const BOOT_STALL_MS = 5000;

export function useYaegiRun(args: UseYaegiRunArgs): YaegiRunHandle {
  const [runResult, setRunResult] = createSignal<RunResult | null>(null);
  const [running, setRunning] = createSignal(false);
  const [runtimeStatus, setRuntimeStatusRaw] = createSignal<RuntimeStatus>("uninit");
  const [bootError, setBootError] = createSignal<string | null>(null);
  const [bootStalled, setBootStalled] = createSignal(false);
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  function clearStallTimer(): void {
    if (stallTimer !== null) {
      clearTimeout(stallTimer);
      stallTimer = null;
    }
    setBootStalled(false);
  }

  /** Central status setter. Owns the "any transition out of
   *  `booting` clears the stall timer" invariant so a future
   *  RuntimeStatus addition (e.g. a cancel state) can't forget
   *  to call clearStallTimer(). Arming the timer when entering
   *  `booting` is the caller's job — preflight pairs the
   *  generation closure with the timer. */
  function setStatus(next: RuntimeStatus): void {
    const prev = runtimeStatus();
    if (prev === "booting" && next !== "booting") clearStallTimer();
    setRuntimeStatusRaw(next);
  }

  /* Monotonic counter — bumped on every reset() and clear(). run()
   * captures the value at start, then settlements compare against
   * the current value before writing to runResult. */
  let generation = 0;
  const currentGen = () => generation;
  const bumpGen = () => {
    generation += 1;
  };

  function preflight(): void {
    /* Idempotent — every state except "uninit" already represents an
     * in-flight or settled boot, so a re-call is a no-op. After
     * reset() flips status back to "uninit", a subsequent preflight()
     * starts a fresh boot against the respawned worker. */
    if (runtimeStatus() !== "uninit") return;
    const bootGen = currentGen();
    setStatus("booting");
    setBootError(null);
    /* Arm the stall timer — if we're STILL booting at BOOT_STALL_MS,
     * the bootStalled signal flips on so the UI can surface a
     * "Retry runtime" affordance. The generation guard mirrors the
     * one on the ready() callbacks: a reset() mid-boot bumps the
     * generation, the timer's callback no-ops harmlessly. The
     * setStatus() wrapper handles clearing on the way OUT; arming
     * here is preflight's job. */
    setBootStalled(false);
    if (stallTimer !== null) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      if (bootGen !== currentGen()) return;
      if (runtimeStatus() !== "booting") return;
      setBootStalled(true);
    }, BOOT_STALL_MS);
    getRunner()
      .ready()
      .then(
        () => {
          if (bootGen !== currentGen()) return; /* reset happened mid-boot */
          setStatus("ready");
        },
        (e: unknown) => {
          if (bootGen !== currentGen()) return;
          setStatus("error");
          setBootError(e instanceof Error ? e.message : String(e));
        },
      );
  }

  async function run(): Promise<void> {
    if (running()) return;
    /* If the consumer never called preflight(), boot lazily — Run is
     * still the canonical trigger for the first WASM load. */
    preflight();
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
    /* Runtime is gone — flip back to "uninit" so a subsequent
     * preflight() / run() triggers a fresh boot. Without this the
     * status would lie that the runtime is "ready" while the worker
     * has been terminated. The setStatus() wrapper handles the
     * stall-timer cleanup when transitioning out of "booting". */
    setStatus("uninit");
    setBootError(null);
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

  return {
    runResult,
    running,
    runtimeStatus,
    bootError,
    bootStalled,
    run,
    reset,
    clear,
    preflight,
  };
}
