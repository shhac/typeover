import { createRoot, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { useAutoSubmittingPhase } from "./use-auto-submitting-phase";
import type { ExercisePhaseHandle, Phase } from "./exercise-phase";
import type { RunResult } from "./use-runtime-run";

function makeFakePhase(overrides?: Partial<ExercisePhaseHandle>): ExercisePhaseHandle {
  return {
    submitted: () => false,
    revealed: () => false,
    current: () => "picking" as Phase,
    canSubmit: () => true,
    submit: vi.fn(),
    tryAgain: vi.fn(),
    nextInstance: vi.fn(),
    revealCorrect: vi.fn(),
    ...overrides,
  };
}

const flush = () => new Promise<void>((r) => queueMicrotask(r));

describe("useAutoSubmittingPhase — submit()", () => {
  it("calls startRun (not phase.submit) when runResult is null", () => {
    createRoot((dispose) => {
      const startRun = vi.fn();
      const phase = makeFakePhase();
      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => true,
        startRun,
        runResult: () => null,
        running: () => false,
        isCorrect: () => false,
        phase,
      });

      wrapped.submit();

      expect(startRun).toHaveBeenCalledTimes(1);
      expect(phase.submit).not.toHaveBeenCalled();
      dispose();
    });
  });

  it("delegates to inner phase.submit when runResult is non-null", () => {
    createRoot((dispose) => {
      const startRun = vi.fn();
      const phase = makeFakePhase();
      const result: RunResult = { stdout: "ok", stderr: "", error: "", durationMs: 10 };

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => true,
        startRun,
        runResult: () => result,
        running: () => false,
        isCorrect: () => true,
        phase,
      });

      wrapped.submit();

      expect(phase.submit).toHaveBeenCalledTimes(1);
      expect(startRun).not.toHaveBeenCalled();
      dispose();
    });
  });

  it("is a no-op while running() is true", () => {
    createRoot((dispose) => {
      const startRun = vi.fn();
      const phase = makeFakePhase();

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => true,
        startRun,
        runResult: () => null,
        running: () => true,
        isCorrect: () => false,
        phase,
      });

      wrapped.submit();

      expect(startRun).not.toHaveBeenCalled();
      expect(phase.submit).not.toHaveBeenCalled();
      dispose();
    });
  });

  it("is a no-op when hasInput() is false", () => {
    createRoot((dispose) => {
      const startRun = vi.fn();
      const phase = makeFakePhase();

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => false,
        startRun,
        runResult: () => null,
        running: () => false,
        isCorrect: () => false,
        phase,
      });

      wrapped.submit();

      expect(startRun).not.toHaveBeenCalled();
      expect(phase.submit).not.toHaveBeenCalled();
      dispose();
    });
  });
});

describe("useAutoSubmittingPhase — canSubmit()", () => {
  it("returns false when phase.current() !== 'picking' even when hasInput is true", () => {
    createRoot((dispose) => {
      const phase = makeFakePhase({ current: () => "wrong" as Phase });

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => true,
        startRun: vi.fn(),
        runResult: () => null,
        running: () => false,
        isCorrect: () => false,
        phase,
      });

      expect(wrapped.canSubmit()).toBe(false);
      dispose();
    });
  });

  it("returns false when running() is true", () => {
    createRoot((dispose) => {
      const phase = makeFakePhase();

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => true,
        startRun: vi.fn(),
        runResult: () => null,
        running: () => true,
        isCorrect: () => false,
        phase,
      });

      expect(wrapped.canSubmit()).toBe(false);
      dispose();
    });
  });

  it("returns false when hasInput() is false", () => {
    createRoot((dispose) => {
      const phase = makeFakePhase();

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => false,
        startRun: vi.fn(),
        runResult: () => null,
        running: () => false,
        isCorrect: () => false,
        phase,
      });

      expect(wrapped.canSubmit()).toBe(false);
      dispose();
    });
  });

  it("returns true when picking, hasInput, and not running", () => {
    createRoot((dispose) => {
      const phase = makeFakePhase({ current: () => "picking" as Phase });

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => true,
        startRun: vi.fn(),
        runResult: () => null,
        running: () => false,
        isCorrect: () => false,
        phase,
      });

      expect(wrapped.canSubmit()).toBe(true);
      dispose();
    });
  });
});

describe("useAutoSubmittingPhase — auto-submit on correct effect", () => {
  it("auto-submits when runResult transitions to a correct result", async () => {
    await createRoot(async (dispose) => {
      const [runResult, setRunResult] = createSignal<RunResult | null>(null);
      const [running, setRunning] = createSignal(false);
      const phase = makeFakePhase();

      useAutoSubmittingPhase({
        hasInput: () => true,
        startRun: vi.fn(),
        runResult,
        running,
        isCorrect: () => true,
        phase,
      });

      await flush();
      expect(phase.submit).not.toHaveBeenCalled();

      setRunResult({ stdout: "ok", stderr: "", error: "", durationMs: 5 });
      await flush();

      expect(phase.submit).toHaveBeenCalledTimes(1);
      dispose();
    });
  });
});

describe("useAutoSubmittingPhase — pass-through methods", () => {
  it("forwards tryAgain and nextInstance to the inner phase", () => {
    createRoot((dispose) => {
      const phase = makeFakePhase();

      const { phase: wrapped } = useAutoSubmittingPhase({
        hasInput: () => true,
        startRun: vi.fn(),
        runResult: () => null,
        running: () => false,
        isCorrect: () => false,
        phase,
      });

      wrapped.tryAgain();
      wrapped.nextInstance();
      wrapped.revealCorrect();

      expect(phase.tryAgain).toHaveBeenCalledTimes(1);
      expect(phase.nextInstance).toHaveBeenCalledTimes(1);
      expect(phase.revealCorrect).toHaveBeenCalledTimes(1);
      dispose();
    });
  });
});
