import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExercisePhase } from "./exercise-phase";

/*
 * Tests for the lifecycle hook every exercise type shares.
 *
 * Most-critical contract: the pass/fail asymmetry. `submit` records a
 * pass on correct; `revealCorrect` is the ONLY path that records a
 * fail. Moving recordInstanceFailed into submit() would silently
 * double-count failures (or invert the counter); this test file is
 * what catches that.
 */

vi.mock("./progress", () => ({
  recordInstancePassed: vi.fn(),
  recordInstanceFailed: vi.fn(),
}));

const progress = await import("./progress");

/** Build a useExercisePhase under a createRoot so its signals work
 *  outside a component tree. Returns the handle plus a dispose
 *  function the test owns. */
function makeHandle(opts: {
  exerciseId?: string;
  isCorrect?: () => boolean;
  canSubmit?: () => boolean;
  onAnother?: () => void;
  onTryAgain?: () => void;
}) {
  let dispose = () => {};
  let handle!: ReturnType<typeof useExercisePhase>;
  createRoot((d) => {
    dispose = d;
    handle = useExercisePhase({
      exerciseId: opts.exerciseId ?? "ex-1",
      isCorrect: opts.isCorrect ?? (() => true),
      canSubmit: opts.canSubmit ?? (() => true),
      onAnother: opts.onAnother ?? (() => {}),
      onTryAgain: opts.onTryAgain,
    });
  });
  return { handle, dispose };
}

beforeEach(() => {
  vi.mocked(progress.recordInstancePassed).mockClear();
  vi.mocked(progress.recordInstanceFailed).mockClear();
});

describe("useExercisePhase — handle surface", () => {
  it("exposes exactly the documented fields", () => {
    const { handle, dispose } = makeHandle({});
    expect(Object.keys(handle).sort()).toEqual(
      [
        "canSubmit",
        "current",
        "nextInstance",
        "revealCorrect",
        "submit",
        "submitted",
        "tryAgain",
        "revealed",
      ].sort(),
    );
    dispose();
  });

  it("initial state: submitted/revealed false, current === 'picking'", () => {
    const { handle, dispose } = makeHandle({});
    expect(handle.submitted()).toBe(false);
    expect(handle.revealed()).toBe(false);
    expect(handle.current()).toBe("picking");
    dispose();
  });

  it("canSubmit on the handle is the same accessor passed in", () => {
    const canSubmit = vi.fn(() => false);
    const { handle, dispose } = makeHandle({ canSubmit });
    handle.canSubmit();
    expect(canSubmit).toHaveBeenCalled();
    dispose();
  });
});

describe("useExercisePhase — submit()", () => {
  it("is a no-op when canSubmit returns false", () => {
    const { handle, dispose } = makeHandle({ canSubmit: () => false });
    handle.submit();
    expect(handle.submitted()).toBe(false);
    expect(handle.current()).toBe("picking");
    expect(progress.recordInstancePassed).not.toHaveBeenCalled();
    dispose();
  });

  it("on correct answer: submitted=true, current='right', records pass exactly once", () => {
    const { handle, dispose } = makeHandle({ isCorrect: () => true });
    handle.submit();
    expect(handle.submitted()).toBe(true);
    expect(handle.current()).toBe("right");
    expect(progress.recordInstancePassed).toHaveBeenCalledTimes(1);
    expect(progress.recordInstancePassed).toHaveBeenCalledWith("ex-1");
    expect(progress.recordInstanceFailed).not.toHaveBeenCalled();
    dispose();
  });

  it("on wrong answer: submitted=true, current='wrong', does NOT record fail", () => {
    /* Pinned per design-docs/12 P1 — the asymmetry. A wrong submit
     * the learner then corrects is recorded as a pass; only an
     * explicit reveal records a fail. */
    const { handle, dispose } = makeHandle({ isCorrect: () => false });
    handle.submit();
    expect(handle.submitted()).toBe(true);
    expect(handle.current()).toBe("wrong");
    expect(progress.recordInstancePassed).not.toHaveBeenCalled();
    expect(progress.recordInstanceFailed).not.toHaveBeenCalled();
    dispose();
  });

  it("double-submit is a no-op (no second progress call)", () => {
    const { handle, dispose } = makeHandle({ isCorrect: () => true });
    handle.submit();
    handle.submit();
    expect(progress.recordInstancePassed).toHaveBeenCalledTimes(1);
    dispose();
  });
});

describe("useExercisePhase — revealCorrect()", () => {
  it("sets revealed=true and records fail exactly once", () => {
    const { handle, dispose } = makeHandle({ isCorrect: () => false });
    handle.submit();
    handle.revealCorrect();
    expect(handle.revealed()).toBe(true);
    expect(progress.recordInstanceFailed).toHaveBeenCalledTimes(1);
    expect(progress.recordInstanceFailed).toHaveBeenCalledWith("ex-1");
    dispose();
  });
});

describe("useExercisePhase — tryAgain() / nextInstance()", () => {
  it("tryAgain resets submitted/revealed, calls onTryAgain, records nothing", () => {
    const onTryAgain = vi.fn();
    const { handle, dispose } = makeHandle({
      isCorrect: () => false,
      onTryAgain,
    });
    handle.submit();
    handle.revealCorrect();
    vi.mocked(progress.recordInstancePassed).mockClear();
    vi.mocked(progress.recordInstanceFailed).mockClear();
    handle.tryAgain();
    expect(handle.submitted()).toBe(false);
    expect(handle.revealed()).toBe(false);
    expect(handle.current()).toBe("picking");
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(progress.recordInstancePassed).not.toHaveBeenCalled();
    expect(progress.recordInstanceFailed).not.toHaveBeenCalled();
    dispose();
  });

  it("nextInstance resets submitted/revealed, calls onAnother, records nothing", () => {
    const onAnother = vi.fn();
    const { handle, dispose } = makeHandle({
      isCorrect: () => true,
      onAnother,
    });
    handle.submit();
    vi.mocked(progress.recordInstancePassed).mockClear();
    handle.nextInstance();
    expect(handle.submitted()).toBe(false);
    expect(handle.revealed()).toBe(false);
    expect(onAnother).toHaveBeenCalledTimes(1);
    expect(progress.recordInstancePassed).not.toHaveBeenCalled();
    dispose();
  });
});

describe("useExercisePhase — asymmetry pin", () => {
  it("submit-wrong → tryAgain → submit-correct counts as 1 pass / 0 fail", () => {
    /* This is the pedagogically-intended counting model. A learner
     * who tries, fails, retries, and succeeds gets credit for the
     * exercise — the wrong attempt isn't held against them. */
    let correct = false;
    const { handle, dispose } = makeHandle({ isCorrect: () => correct });
    handle.submit();
    expect(handle.current()).toBe("wrong");
    handle.tryAgain();
    correct = true;
    handle.submit();
    expect(handle.current()).toBe("right");
    expect(progress.recordInstancePassed).toHaveBeenCalledTimes(1);
    expect(progress.recordInstanceFailed).toHaveBeenCalledTimes(0);
    dispose();
  });
});

afterEach(() => {
  /* Restoration of mocks happens via vi.mocked(...).mockClear() in
   * each test; nothing else to clean up here. */
});
