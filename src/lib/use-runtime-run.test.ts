import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Tests for the useRuntimeRun hook. Mocks `~/runtime` so we exercise
 * the hook's lifecycle (signals, timing, error coercion, reset
 * sentinel) without touching the real WASM worker. This is the
 * test surface that lets us pin run-lifecycle semantics independent
 * of Freeform / FillBlankLineInput component rendering.
 *
 * Pinned contracts:
 *   - run() flips running → true while in flight → false on settle
 *   - successful eval → runResult { stdout, stderr, error, durationMs }
 *   - thrown error → runResult.error carries the message; stdout/stderr ""
 *   - double Run while running → no-op (single eval call)
 *   - reset → terminateRunner called, running cleared, sentinel result
 *   - clear → runResult back to null
 */

/* vi.mock is hoisted to the top of the file, so the mock factory
 * can't close over locals. Use vi.hoisted() to create the spy refs
 * inside the same hoisted phase.
 *
 * Distinct spies per runtime — the lifecycle tests use the Yaegi
 * pair (`evalMock` / `readyMock` / `terminateMock`) by default
 * because the historic suite was written against `runtime: "yaegi"`;
 * the runtime-selection block below uses both pairs to verify the
 * hook dispatches to the right worker. */
const {
  evalMock,
  readyMock,
  terminateMock,
  zigEvalMock,
  zigReadyMock,
  zigTerminateMock,
  rustEvalMock,
  rustReadyMock,
  rustTerminateMock,
} = vi.hoisted(() => ({
    evalMock: vi.fn(),
    readyMock: vi.fn(),
    terminateMock: vi.fn(),
    zigEvalMock: vi.fn(),
    zigReadyMock: vi.fn(),
    zigTerminateMock: vi.fn(),
    rustEvalMock: vi.fn(),
    rustReadyMock: vi.fn(),
    rustTerminateMock: vi.fn(),
  }));

vi.mock("~/runtime", () => ({
  getRunner: () => ({ eval: evalMock, ready: readyMock }),
  terminateRunner: terminateMock,
  getZigRunner: () => ({ eval: zigEvalMock, ready: zigReadyMock }),
  terminateZigRunner: zigTerminateMock,
  getRustRunner: () => ({ eval: rustEvalMock, ready: rustReadyMock }),
  terminateRustRunner: rustTerminateMock,
}));

import { useRuntimeRun } from "./use-runtime-run";

beforeEach(() => {
  evalMock.mockReset();
  /* Default ready() to a resolved promise — most lifecycle tests
   * don't care about the boot phase, they just need preflight() to
   * not throw. Boot-specific tests override per-test. */
  readyMock.mockReset();
  readyMock.mockResolvedValue(undefined);
  terminateMock.mockReset();
  zigEvalMock.mockReset();
  zigReadyMock.mockReset();
  zigReadyMock.mockResolvedValue(undefined);
  zigTerminateMock.mockReset();
});

let disposers: Array<() => void> = [];
afterEach(() => {
  disposers.forEach((d) => d());
  disposers = [];
});

function setup(buildProgram: () => string = () => "package main\nfunc main(){}") {
  let handle!: ReturnType<typeof useRuntimeRun>;
  createRoot((dispose) => {
    handle = useRuntimeRun({ runtime: "yaegi", buildProgram });
    disposers.push(dispose);
  });
  return handle;
}

describe("useRuntimeRun", () => {
  it("starts with runResult null and running false", () => {
    const h = setup();
    expect(h.runResult()).toBeNull();
    expect(h.running()).toBe(false);
  });

  it("run() sets running=true while in flight, false on settle", async () => {
    let resolveEval!: (value: { stdout: string; stderr: string; error: string }) => void;
    evalMock.mockReturnValueOnce(
      new Promise((res) => {
        resolveEval = res;
      }),
    );
    const h = setup();
    const inFlight = h.run();
    expect(h.running()).toBe(true);
    resolveEval({ stdout: "hi\n", stderr: "", error: "" });
    await inFlight;
    expect(h.running()).toBe(false);
  });

  it("successful eval stores stdout/stderr/error/durationMs on runResult", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "ok\n", stderr: "warn", error: "" });
    const h = setup();
    await h.run();
    const r = h.runResult();
    expect(r).not.toBeNull();
    expect(r?.stdout).toBe("ok\n");
    expect(r?.stderr).toBe("warn");
    expect(r?.error).toBe("");
    expect(typeof r?.durationMs).toBe("number");
    expect(r!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("thrown Error → runResult.error carries .message; stdout/stderr empty", async () => {
    evalMock.mockRejectedValueOnce(new Error("worker dead"));
    const h = setup();
    await h.run();
    const r = h.runResult();
    expect(r?.error).toBe("worker dead");
    expect(r?.stdout).toBe("");
    expect(r?.stderr).toBe("");
  });

  it("thrown non-Error → runResult.error coerces via String()", async () => {
    evalMock.mockRejectedValueOnce("just a string");
    const h = setup();
    await h.run();
    expect(h.runResult()?.error).toBe("just a string");
  });

  it("double run() while running is a no-op (single eval call)", async () => {
    let resolveEval!: (value: { stdout: string; stderr: string; error: string }) => void;
    evalMock.mockReturnValueOnce(
      new Promise((res) => {
        resolveEval = res;
      }),
    );
    const h = setup();
    const first = h.run();
    /* While first is in flight, fire a second — it should drop. */
    const second = h.run();
    expect(evalMock).toHaveBeenCalledTimes(1);
    resolveEval({ stdout: "", stderr: "", error: "" });
    await Promise.all([first, second]);
    expect(evalMock).toHaveBeenCalledTimes(1);
  });

  it("reset() calls terminateRunner, clears running, sets sentinel result", () => {
    const h = setup();
    h.reset();
    expect(terminateMock).toHaveBeenCalledTimes(1);
    expect(h.running()).toBe(false);
    expect(h.runResult()?.error).toMatch(/Runtime was reset/);
    expect(h.runResult()?.durationMs).toBe(0);
  });

  it("clear() returns runResult to null", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "x", stderr: "", error: "" });
    const h = setup();
    await h.run();
    expect(h.runResult()).not.toBeNull();
    h.clear();
    expect(h.runResult()).toBeNull();
  });

  it("preflight() flips runtimeStatus uninit→booting→ready", async () => {
    /* design-docs/16 F-4. Without an explicit boot lifecycle the UI
     * had no way to surface the ~1.9 MB WASM cold-start. */
    let resolveReady!: () => void;
    readyMock.mockReset();
    readyMock.mockReturnValueOnce(
      new Promise<void>((res) => {
        resolveReady = res;
      }),
    );
    const h = setup();
    expect(h.runtimeStatus()).toBe("uninit");
    h.preflight();
    expect(h.runtimeStatus()).toBe("booting");
    resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("ready");
    expect(h.bootError()).toBeNull();
  });

  it("preflight() is idempotent — re-calls during boot don't restart", () => {
    readyMock.mockReset();
    readyMock.mockReturnValue(new Promise<void>(() => {}));
    const h = setup();
    h.preflight();
    h.preflight();
    h.preflight();
    expect(readyMock).toHaveBeenCalledTimes(1);
  });

  it("preflight() failure → runtimeStatus 'error', bootError carries message", async () => {
    readyMock.mockReset();
    readyMock.mockRejectedValueOnce(new Error("wasm fetch failed"));
    const h = setup();
    h.preflight();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("error");
    expect(h.bootError()).toBe("wasm fetch failed");
  });

  it("preflight() after a boot error is a no-op until reset() flips status back to uninit", async () => {
    /* Pin the recovery contract: a boot error is sticky. Callers
     * must `reset()` to re-arm; otherwise repeated `preflight()` is
     * a silent no-op and the UI shows the stale error. If a future
     * refactor adds auto-retry-on-error, this test fails first and
     * the change is deliberate. design-docs/20 lens-5 finding. */
    readyMock.mockReset();
    readyMock.mockRejectedValueOnce(new Error("first boot failed"));
    readyMock.mockResolvedValueOnce(undefined);
    const h = setup();
    h.preflight();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("error");
    expect(readyMock).toHaveBeenCalledTimes(1);
    /* Repeated preflight calls don't retry. */
    h.preflight();
    h.preflight();
    expect(readyMock).toHaveBeenCalledTimes(1);
    /* reset() flips back to uninit and the next preflight DOES boot. */
    h.reset();
    expect(h.runtimeStatus()).toBe("uninit");
    h.preflight();
    expect(readyMock).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("ready");
  });

  it("reset() flips runtimeStatus back to 'uninit' so the next preflight re-boots", async () => {
    /* Without this, the status would lie that the runtime is "ready"
     * after a terminated worker; the next Run would await ready() on
     * a respawned worker but the UI would already say it was up. */
    const h = setup();
    h.preflight();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("ready");
    h.reset();
    expect(h.runtimeStatus()).toBe("uninit");
    expect(h.bootError()).toBeNull();
  });

  it("run() triggers preflight when runtimeStatus is 'uninit'", async () => {
    /* Lazy-boot path — consumers that don't call preflight() in
     * onMount still pay the cold-start on first Run, but it surfaces
     * as a runtimeStatus transition the UI can render. */
    evalMock.mockResolvedValueOnce({ stdout: "", stderr: "", error: "" });
    const h = setup();
    expect(h.runtimeStatus()).toBe("uninit");
    await h.run();
    expect(readyMock).toHaveBeenCalled();
  });

  it("buildProgram is called per-run, not at hook setup", async () => {
    const programs: string[] = [];
    let current = "a";
    const h = setup(() => {
      programs.push(current);
      return current;
    });
    evalMock.mockResolvedValue({ stdout: "", stderr: "", error: "" });
    await h.run();
    current = "b";
    await h.run();
    expect(programs).toEqual(["a", "b"]);
    expect(evalMock).toHaveBeenNthCalledWith(1, "a");
    expect(evalMock).toHaveBeenNthCalledWith(2, "b");
  });
});

describe("useRuntimeRun — generation-tagged settlements", () => {
  it("ignores a previous run's late resolution after reset()", async () => {
    /* design-docs/19 F-2 — reset-while-running race. The killed
     * worker's pending Comlink call eventually settles; without
     * generation tags it overwrites the "Runtime was reset"
     * sentinel. */
    let resolveEval!: (value: { stdout: string; stderr: string; error: string }) => void;
    evalMock.mockReturnValueOnce(
      new Promise((res) => {
        resolveEval = res;
      }),
    );
    const h = setup();
    const inFlight = h.run();
    h.reset();
    expect(h.runResult()?.error).toMatch(/Runtime was reset/);
    /* Simulate the dead worker's late resolution. */
    resolveEval({ stdout: "stale", stderr: "", error: "" });
    await inFlight;
    /* Result must still be the reset sentinel, NOT "stale". */
    expect(h.runResult()?.error).toMatch(/Runtime was reset/);
    expect(h.runResult()?.stdout).toBe("");
  });

  it("ignores a previous run's late rejection after reset()", async () => {
    let rejectEval!: (reason: unknown) => void;
    evalMock.mockReturnValueOnce(
      new Promise((_, rej) => {
        rejectEval = rej;
      }),
    );
    const h = setup();
    const inFlight = h.run();
    h.reset();
    rejectEval(new Error("worker terminated"));
    await inFlight;
    expect(h.runResult()?.error).toMatch(/Runtime was reset/);
  });

  it("ignores a stale boot resolution after reset() during preflight", async () => {
    /* Boot started, learner clicks Reset before WASM finished. The
     * late ready() resolution must NOT flip runtimeStatus back to
     * "ready" — the worker we'd be referring to has been terminated.
     * Mirrors the eval-side race in F-2. */
    let resolveReady!: () => void;
    readyMock.mockReset();
    readyMock.mockReturnValueOnce(
      new Promise<void>((res) => {
        resolveReady = res;
      }),
    );
    const h = setup();
    h.preflight();
    expect(h.runtimeStatus()).toBe("booting");
    h.reset();
    expect(h.runtimeStatus()).toBe("uninit");
    resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("uninit");
  });

  it("bootStalled flips true after 5s when ready() never resolves; flips back on reset", async () => {
    /* design-docs/26 P12 — when the WASM cold-start hangs, the
     * "↳ Booting Go runtime…" badge must escalate to a "Retry
     * runtime" affordance. Pin the timer-driven signal here at
     * the hook layer so the toolbar's render-time gate is the
     * only thing left to verify visually. */
    vi.useFakeTimers();
    let resolveReady!: () => void;
    readyMock.mockReturnValueOnce(
      new Promise<void>((res) => {
        resolveReady = res;
      }),
    );
    const h = setup();
    h.preflight();
    expect(h.runtimeStatus()).toBe("booting");
    expect(h.bootStalled()).toBe(false);
    /* Just shy of the threshold — still no escalation. */
    vi.advanceTimersByTime(4999);
    expect(h.bootStalled()).toBe(false);
    /* Cross the threshold. */
    vi.advanceTimersByTime(2);
    expect(h.bootStalled()).toBe(true);
    /* reset() must clear the stall flag AND the timer (so a fresh
     * preflight starts cleanly). */
    h.reset();
    expect(h.bootStalled()).toBe(false);
    expect(h.runtimeStatus()).toBe("uninit");
    /* Resolve the stranded original ready() — the generation guard
     * inside preflight's .then must drop the result; runtimeStatus
     * must stay "uninit", not flip back to "ready". */
    resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("uninit");
    vi.useRealTimers();
  });

  it("bootStalled stays false when ready() resolves before the threshold", async () => {
    vi.useFakeTimers();
    /* ready() resolves immediately on the first microtask. */
    readyMock.mockResolvedValueOnce(undefined);
    const h = setup();
    h.preflight();
    /* Let the .then callback run. */
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runtimeStatus()).toBe("ready");
    /* Advance past the threshold; bootStalled stays false because
     * the status transition cleared the timer. */
    vi.advanceTimersByTime(6000);
    expect(h.bootStalled()).toBe(false);
    vi.useRealTimers();
  });

  it("ignores a previous run's settlement after clear()", async () => {
    /* clear() also invalidates pending runs — same race shape as
     * reset() but a learner triggers it by editing the input
     * mid-flight (FillBlankLineInput / Freeform onInput). */
    let resolveEval!: (value: { stdout: string; stderr: string; error: string }) => void;
    evalMock.mockReturnValueOnce(
      new Promise((res) => {
        resolveEval = res;
      }),
    );
    const h = setup();
    const inFlight = h.run();
    h.clear();
    expect(h.runResult()).toBeNull();
    resolveEval({ stdout: "stale", stderr: "", error: "" });
    await inFlight;
    /* runResult stays cleared — the stale settlement was discarded. */
    expect(h.runResult()).toBeNull();
  });
});

describe("useRuntimeRun — runtime selection", () => {
  /* The hook chooses its `{get, terminate}` pair from CLIENT_RUNTIMES
   * by indexing on `args.runtime`. Distinct spies per runtime catch
   * a regression that hard-codes `CLIENT_RUNTIMES.yaegi` or
   * accidentally maps both branches to the same descriptor — neither
   * would fail any test in the lifecycle block above because the
   * historical mock shared one set of spies. */

  function setupZig(buildProgram: () => string = () => 'const std = @import("std");') {
    let handle!: ReturnType<typeof useRuntimeRun>;
    createRoot((dispose) => {
      handle = useRuntimeRun({ runtime: "zig", buildProgram });
      disposers.push(dispose);
    });
    return handle;
  }

  it("dispatches eval() to getZigRunner when runtime is zig", async () => {
    zigEvalMock.mockResolvedValueOnce({ stdout: "z", stderr: "", error: "" });
    const h = setupZig();
    await h.run();
    expect(zigEvalMock).toHaveBeenCalledTimes(1);
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("dispatches eval() to getRunner when runtime is yaegi", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "g", stderr: "", error: "" });
    const h = setup();
    await h.run();
    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(zigEvalMock).not.toHaveBeenCalled();
  });

  it("reset() dispatches terminate to the matching runtime", () => {
    const h = setupZig();
    h.reset();
    expect(zigTerminateMock).toHaveBeenCalledTimes(1);
    expect(terminateMock).not.toHaveBeenCalled();
  });

  it("runtimeLabel and runtimeTarget reflect the selected runtime", () => {
    const yaegi = setup();
    expect(yaegi.runtimeLabel).toBe("Go");
    expect(yaegi.runtimeTarget).toBe("go");

    const zig = setupZig();
    expect(zig.runtimeLabel).toBe("Zig");
    expect(zig.runtimeTarget).toBe("zig");
  });
});

describe("useRuntimeRun — precheck hook", () => {
  function setupWithPrecheck(
    precheck: () => { ok: boolean; message: string },
  ): ReturnType<typeof useRuntimeRun> {
    let handle!: ReturnType<typeof useRuntimeRun>;
    createRoot((dispose) => {
      handle = useRuntimeRun({
        runtime: "yaegi",
        buildProgram: () => "irrelevant",
        precheck,
      });
      disposers.push(dispose);
    });
    return handle;
  }

  it("short-circuits run() with the precheck message when it fails", async () => {
    const h = setupWithPrecheck(() => ({
      ok: false,
      message: "Your program should start with `package main`.",
    }));
    await h.run();
    const r = h.runResult();
    expect(r?.error).toBe("Your program should start with `package main`.");
    expect(r?.stdout).toBe("");
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("passes through to eval() when precheck succeeds", async () => {
    evalMock.mockResolvedValue({ stdout: "ok", stderr: "", error: "" });
    const h = setupWithPrecheck(() => ({ ok: true, message: "" }));
    await h.run();
    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(h.runResult()?.stdout).toBe("ok");
  });
});
