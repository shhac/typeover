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
const { evalMock, terminateMock } = vi.hoisted(() => ({
  evalMock: vi.fn(),
  terminateMock: vi.fn(),
}));

vi.mock("~/runtime", () => ({
  getRunner: () => ({ eval: evalMock, ready: vi.fn() }),
  terminateRunner: terminateMock,
}));

import { useYaegiRun } from "./use-yaegi-run";

beforeEach(() => {
  evalMock.mockReset();
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
