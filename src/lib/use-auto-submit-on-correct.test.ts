import { createRoot, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { useAutoSubmitOnCorrect } from "./use-auto-submit-on-correct";
import type { RunResult } from "./use-yaegi-run";
import type { ExercisePhaseHandle } from "./exercise-phase";

/*
 * Direct unit tests for the extracted auto-Submit-on-correct hook.
 * Integration coverage already exists via FillBlankLineInput's
 * test suite, but those tests don't exercise the re-fire guard,
 * the reset() lifecycle, or the running/picking gate in
 * isolation — a regression in any of them would silently
 * weaken the "smart submit" contract.
 *
 * Each test stands up the hook under a `createRoot` so its
 * signals are reactive outside a real component tree, then drives
 * the inputs imperatively to observe `phase.submit` call counts.
 * Solid schedules createEffect into a microtask; the `flush()`
 * helper yields to let the scheduler run before assertions.
 */

const flush = () => new Promise<void>((r) => queueMicrotask(r));

const result = (stdout = "ok"): RunResult => ({
  stdout,
  stderr: "",
  error: "",
  durationMs: 1,
});

function makePhase(initial: ExercisePhaseHandle["current"] = () => "picking") {
  const submit = vi.fn();
  return {
    submit,
    handle: {
      submitted: () => false,
      revealed: () => false,
      current: initial,
      canSubmit: () => true,
      submit,
      tryAgain: vi.fn(),
      nextInstance: vi.fn(),
      revealCorrect: vi.fn(),
    } satisfies ExercisePhaseHandle,
  };
}

describe("useAutoSubmitOnCorrect — happy path", () => {
  it("fires phase.submit() when a fresh result arrives, isCorrect, not running, picking", async () => {
    await createRoot(async (dispose) => {
      const [r, setR] = createSignal<RunResult | null>(null);
      const phase = makePhase();
      useAutoSubmitOnCorrect({
        runResult: r,
        running: () => false,
        isCorrect: () => true,
        phase: phase.handle,
      });
      await flush();
      expect(phase.submit).not.toHaveBeenCalled();
      setR(result());
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(1);
      dispose();
    });
  });
});

describe("useAutoSubmitOnCorrect — gates", () => {
  it("does not fire while `running()` is true (effect re-tracks running and waits)", async () => {
    await createRoot(async (dispose) => {
      const [r, setR] = createSignal<RunResult | null>(null);
      const [running, setRunning] = createSignal(true);
      const phase = makePhase();
      useAutoSubmitOnCorrect({
        runResult: r,
        running,
        isCorrect: () => true,
        phase: phase.handle,
      });
      await flush();
      /* runResult lands while still running → no submit yet. */
      setR(result());
      await flush();
      expect(phase.submit).not.toHaveBeenCalled();
      /* Once running flips false, the effect re-fires + commits. */
      setRunning(false);
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(1);
      dispose();
    });
  });

  it("does not fire when isCorrect() returns false", async () => {
    await createRoot(async (dispose) => {
      const [r, setR] = createSignal<RunResult | null>(null);
      const phase = makePhase();
      useAutoSubmitOnCorrect({
        runResult: r,
        running: () => false,
        isCorrect: () => false,
        phase: phase.handle,
      });
      await flush();
      setR(result());
      await flush();
      expect(phase.submit).not.toHaveBeenCalled();
      dispose();
    });
  });

  it("does not fire when phase is not in picking (wrong / right)", async () => {
    for (const stage of ["wrong", "right"] as const) {
      await createRoot(async (dispose) => {
        const [r, setR] = createSignal<RunResult | null>(null);
        const phase = makePhase(() => stage);
        useAutoSubmitOnCorrect({
          runResult: r,
          running: () => false,
          isCorrect: () => true,
          phase: phase.handle,
        });
        await flush();
        setR(result());
        await flush();
        expect(phase.submit).not.toHaveBeenCalled();
        dispose();
      });
    }
  });
});

describe("useAutoSubmitOnCorrect — re-fire guard", () => {
  it("fires AT MOST ONCE for the same RunResult identity", async () => {
    await createRoot(async (dispose) => {
      const [r, setR] = createSignal<RunResult | null>(null);
      /* Toggle a sibling signal that the hook also tracks, to force
       * the effect to re-run while RunResult stays referentially
       * identical. */
      const [running, setRunning] = createSignal(false);
      const phase = makePhase();
      useAutoSubmitOnCorrect({
        runResult: r,
        running,
        isCorrect: () => true,
        phase: phase.handle,
      });
      await flush();
      const same = result();
      setR(same);
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(1);
      /* Re-fire the effect by toggling running. submit must NOT
       * fire again because `autoSubmittedFor` matches `r()`. */
      setRunning(true);
      await flush();
      setRunning(false);
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(1);
      dispose();
    });
  });

  it("reset() drops the guard so a future identical-by-reference result re-fires", async () => {
    await createRoot(async (dispose) => {
      const [r, setR] = createSignal<RunResult | null>(null);
      const phase = makePhase();
      const { reset } = useAutoSubmitOnCorrect({
        runResult: r,
        running: () => false,
        isCorrect: () => true,
        phase: phase.handle,
      });
      await flush();
      const same = result();
      setR(same);
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(1);
      /* Without reset, re-emitting `same` would no-op. */
      reset();
      setR(null);
      await flush();
      setR(same);
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(2);
      dispose();
    });
  });

  it("a DIFFERENT RunResult identity fires again even without reset()", async () => {
    await createRoot(async (dispose) => {
      const [r, setR] = createSignal<RunResult | null>(null);
      const phase = makePhase();
      useAutoSubmitOnCorrect({
        runResult: r,
        running: () => false,
        isCorrect: () => true,
        phase: phase.handle,
      });
      await flush();
      setR(result("first"));
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(1);
      setR(result("second"));
      await flush();
      expect(phase.submit).toHaveBeenCalledTimes(2);
      dispose();
    });
  });
});
