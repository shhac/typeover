import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Tests for the useYaegiRun hook. Mocks `~/runtime` so we exercise
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
 * inside the same hoisted phase. */
const { evalMock, readyMock, terminateMock } = vi.hoisted(() => ({
  evalMock: vi.fn(),
  readyMock: vi.fn(),
  terminateMock: vi.fn(),
}));

vi.mock("~/runtime", () => ({
  getRunner: () => ({ eval: evalMock, ready: readyMock }),
  terminateRunner: terminateMock,
}));

import { useYaegiRun } from "./use-yaegi-run";

beforeEach(() => {
  evalMock.mockReset();
  /* Default ready() to a resolved promise — most lifecycle tests
   * don't care about the boot phase, they just need preflight() to
   * not throw. Boot-specific tests override per-test. */
  readyMock.mockReset();
  readyMock.mockResolvedValue(undefined);
  terminateMock.mockReset();
});

let disposers: Array<() => void> = [];
afterEach(() => {
  disposers.forEach((d) => d());
  disposers = [];
});

function setup(buildProgram: () => string = () => "package main\nfunc main(){}") {
  let handle!: ReturnType<typeof useYaegiRun>;
  createRoot((dispose) => {
    handle = useYaegiRun({ buildProgram });
    disposers.push(dispose);
  });
  return handle;
}

describe("useYaegiRun", () => {
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

describe("useYaegiRun — generation-tagged settlements", () => {
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
