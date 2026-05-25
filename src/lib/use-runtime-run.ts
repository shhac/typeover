import { createSignal } from "solid-js";
import type { Target } from "./content-schema";
import {
  CLIENT_RUNTIME_DESCRIPTORS,
  type AcceptedRuntime,
  type ClientRuntime,
} from "~/runtime/client-descriptors";
import { errorMessage } from "~/runtime/error-message";

export {
  runtimeToTarget,
  type AcceptedRuntime,
  type ClientRuntime,
} from "~/runtime/client-descriptors";

/*
 * Headless lifecycle for any component that runs learner code via a
 * client-side WASM runtime. Today: Freeform + FillBlankLineInput
 * (both languages) + the dev-only SmokeProbe. Owns:
 *
 *   - the running / runResult signals
 *   - the run() async function (timer + eval + error-coercion)
 *   - the reset() function (terminate worker + sentinel result)
 *
 * Consumers supply a `runtime` selector (`"yaegi"` for Go, `"zig"`
 * for Zig) plus a `buildProgram` accessor — the function the hook
 * calls to assemble the program text on each Run. Those are the
 * only two things the call sites genuinely differ on; everything
 * else is identical try/catch/finally + signal plumbing.
 *
 * Why a hook rather than a context / singleton: each exercise wants
 * its own runResult lifecycle. The runners themselves are
 * singletons (in src/runtime/index.ts) — this hook only owns the
 * per-component state around them.
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
 *  means subsequent eval() calls don't pay the cold-start cost.
 *  `error` surfaces a boot failure to the UI. */
export type RuntimeStatus = "uninit" | "booting" | "ready" | "error";

export interface RuntimeRunHandle {
  /** Last completed run's outcome, or null pre-first-run / post-reset. */
  runResult: () => RunResult | null;
  /** True while an eval is in flight. Block double-Run, show spinner. */
  running: () => boolean;
  /** Runtime boot status. Lets the UI show a "Booting <lang> runtime…"
   *  indicator and gate Run until ready. design-docs/16 F-4. */
  runtimeStatus: () => RuntimeStatus;
  /** Message when runtimeStatus === "error"; null otherwise. */
  bootError: () => string | null;
  /** True when `runtimeStatus === "booting"` has persisted past
   *  `BOOT_STALL_MS` (5s default) — surfaces a "Retry runtime"
   *  affordance for learners on flaky networks. design-docs/26 P12.
   *  Resets to false on any transition out of "booting". */
  bootStalled: () => boolean;
  /** Display name of the runtime, for the boot badge ("Go" / "Zig"). */
  runtimeLabel: string;
  /** The curriculum-target language this runtime grades (`"go"` for
   *  Yaegi, `"zig"` for Zig). Lets consumers thread the right
   *  language slug to per-language UI (CodeMirror grammar, aria
   *  labels) without re-deriving the mapping. */
  runtimeTarget: Target;
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
   *  (subsequent calls during boot are no-ops). When `canRun` is
   *  false (server runtime), this is a no-op. */
  preflight: () => void;
  /** Whether the hook can actually execute `run()` against this
   *  runtime. False when `args.runtime === "server"` — the SSR-
   *  fallback isn't wired today, and the consumer Run button should
   *  disable itself off this flag rather than re-deriving the rule. */
  canRun: boolean;
}

interface UseRuntimeRunArgs {
  /** Which runtime to grade against. `"yaegi"` and `"zig"` map to
   *  in-browser Web Workers; `"server"` is accepted but not yet
   *  driven (the hook's `canRun` is false and all the side-effect
   *  methods are no-ops for that branch). */
  runtime: AcceptedRuntime;
  /** Called inside run() to produce the program text. Lets the hook
   *  stay agnostic to whether the program is the learner's raw input
   *  (Freeform), a substituted scaffold (FillBlankLineInput), or
   *  whatever else. */
  buildProgram: () => string;
  /** Optional consumer-supplied pre-check, run before each eval.
   *  Lets a consumer reject obviously-invalid input synchronously
   *  with a friendly message (Freeform uses this to enforce
   *  submission-shape bookends, saving a Sandbox round-trip on
   *  "you deleted main"). On `{ ok: false }` the hook short-
   *  circuits — sets runResult.error to the message and skips the
   *  worker call. */
  precheck?: () => { ok: boolean; message: string };
  /** Optional consumer-supplied synthetic result. Used for authored
   *  known attempts where compiling would only reproduce a predictable
   *  wrong result. Returning a RunResult preserves the Run panel UX
   *  while skipping the runtime call. */
  syntheticRun?: () => RunResult | null;
}

/** How long the runtime can sit in "booting" before we surface a
 *  stall indicator. Calibrated against the brotli'd WASM download —
 *  a healthy 3G connection lands well under 5s; past that the user
 *  is on a flaky network / captive portal / hung CDN, and the in-
 *  exercise "↳ Booting…" badge with no escape hatch is wrong UX. */
const BOOT_STALL_MS = 5000;

export function useRuntimeRun(args: UseRuntimeRunArgs): RuntimeRunHandle {
  /* `"server"` is accepted but unsupported: the hook returns a
   * degenerate handle (canRun: false, side-effect methods are
   * no-ops). Falls back to the Go display + target so a freeform
   * page that renders against a server-runtime exercise still has
   * sensible chrome — the Run button will be disabled via
   * `runner.canRun`, so the labels never matter to the learner. */
  const canRun = args.runtime !== "server";
  /* TS doesn't narrow `args.runtime` through the const above; use a
   * type guard so the descriptor lookup stays safe. */
  const clientRuntime: ClientRuntime = args.runtime === "server" ? "yaegi" : args.runtime;
  const descriptor = CLIENT_RUNTIME_DESCRIPTORS[clientRuntime];
  const runtimeLabel = descriptor.label;
  const runtimeTarget = descriptor.target;

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

  /* Arm the stall timer for a given boot generation. If we're STILL
   * booting at BOOT_STALL_MS, the `bootStalled` signal flips on so
   * the UI can surface a "Retry runtime" affordance. The generation
   * guard mirrors the one on the ready() callbacks: a reset() mid-
   * boot bumps the generation, the timer's callback no-ops
   * harmlessly. Re-entrant — clears any prior timer first via the
   * shared helper. */
  function armStallTimer(bootGen: number): void {
    clearStallTimer();
    stallTimer = setTimeout(() => {
      if (bootGen !== currentGen()) return;
      if (runtimeStatus() !== "booting") return;
      setBootStalled(true);
    }, BOOT_STALL_MS);
  }

  /* Wire the runner's `ready()` promise to the status signals.
   * Generation-guarded — a reset() mid-boot drops the late
   * resolution on the floor. */
  function attachBootHandlers(bootGen: number, ready: Promise<void>): void {
    ready.then(
      () => {
        if (bootGen !== currentGen()) return;
        setStatus("ready");
      },
      (e: unknown) => {
        if (bootGen !== currentGen()) return;
        setStatus("error");
        setBootError(errorMessage(e));
      },
    );
  }

  function preflight(): void {
    /* Server runtime is accepted but undriven — no worker to warm,
     * no status to advance. Caller's UI gates Run on `canRun`. */
    if (!canRun) return;
    /* Idempotent — every state except "uninit" already represents an
     * in-flight or settled boot, so a re-call is a no-op. After
     * reset() flips status back to "uninit", a subsequent preflight()
     * starts a fresh boot against the respawned worker. */
    if (runtimeStatus() !== "uninit") return;
    const bootGen = currentGen();
    setStatus("booting");
    setBootError(null);
    armStallTimer(bootGen);
    attachBootHandlers(bootGen, descriptor.get().ready());
  }

  async function run(): Promise<void> {
    /* Server runtime → no-op. Consumers gate the Run button on
     * `canRun`, but the hook also guards here so a stray
     * `void runner.run()` from elsewhere (mobile key bar, Cmd-Enter)
     * doesn't try to dereference undefined accessors. */
    if (!canRun) return;
    if (running()) return;
    const synthetic = args.syntheticRun?.() ?? null;
    if (synthetic !== null) {
      setRunResult(synthetic);
      return;
    }
    /* Consumer-supplied pre-check — synchronous, runs before any
     * worker invocation. Catches obviously-bad input without
     * burning a compile round-trip. */
    if (args.precheck) {
      const verdict = args.precheck();
      if (!verdict.ok) {
        setRunResult({
          stdout: "",
          stderr: "",
          error: verdict.message,
          durationMs: 0,
        });
        return;
      }
    }
    /* If the consumer never called preflight(), boot lazily — Run is
     * still the canonical trigger for the first WASM load. */
    preflight();
    const gen = currentGen();
    setRunning(true);
    const t0 = performance.now();
    try {
      const runner = descriptor.get();
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
        error: errorMessage(e),
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
    /* Server runtime → no worker to terminate; reset is a no-op. */
    if (!canRun) return;
    /* Hard-reset the runtime when the learner's code looks stuck.
     * Each runtime is single-threaded inside its worker, so an
     * infinite loop blocks subsequent calls until the worker is
     * terminated. Bumping the generation invalidates any in-flight
     * eval; its eventual rejection won't touch runResult. */
    bumpGen();
    descriptor.terminate();
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
    runtimeLabel,
    runtimeTarget,
    run,
    reset,
    clear,
    preflight,
    canRun,
  };
}
