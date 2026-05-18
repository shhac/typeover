import { createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExerciseInstance } from "./exercise-instance";
import type { GeneratorSpec } from "./generator";

/*
 * Tests for the per-exercise instance lifecycle hook.
 *
 * Most-critical contract: the `createEffect`-not-`createMemo` choice
 * for `recordInstanceSeen`. A natural-looking refactor (inlining the
 * recorder into the memo, or using a createMemo with side-effects)
 * would double-fire on subscription, silently inflating every
 * learner's `instancesSeen` counter by 2x on each hydration / HMR.
 * This file is what catches that.
 */

vi.mock("./progress", () => ({
  recordInstanceSeen: vi.fn(),
}));

const progress = await import("./progress");

const TEMPLATE_SPEC: GeneratorSpec = {
  kind: "template",
  vars: { x: ["a", "b", "c"] },
  ts: "${x}",
  canonical: "${x}",
};

beforeEach(() => {
  vi.mocked(progress.recordInstanceSeen).mockClear();
});

/** Solid schedules createEffect into a microtask; tests that assert
 *  on effect side effects must yield to let the scheduler run. */
const flush = () => new Promise<void>((r) => queueMicrotask(r));

describe("useExerciseInstance — seen counter semantics", () => {
  it("records seen exactly once on initial subscription, not on every memo read", async () => {
    /* Pinned per design-docs/12 P1. If a future refactor inlines
     * recordInstanceSeen into the memo, reading `instance()`
     * multiple times would re-fire the recorder. */
    await createRoot(async (dispose) => {
      const { instance } = useExerciseInstance("ex-1", TEMPLATE_SPEC);
      await flush();
      instance();
      instance();
      instance();
      expect(progress.recordInstanceSeen).toHaveBeenCalledTimes(1);
      expect(progress.recordInstanceSeen).toHaveBeenCalledWith("ex-1");
      dispose();
    });
  });

  it("records seen once per `another()` advance — n advances → n+1 calls", async () => {
    await createRoot(async (dispose) => {
      const { another } = useExerciseInstance("ex-1", TEMPLATE_SPEC);
      await flush();
      another();
      await flush();
      another();
      await flush();
      another();
      await flush();
      expect(progress.recordInstanceSeen).toHaveBeenCalledTimes(4);
      dispose();
    });
  });
});

describe("useExerciseInstance — determinism", () => {
  it("returns the same instance for the same (exerciseId, attempt)", () => {
    let firstTs: string | undefined;
    createRoot((dispose) => {
      const { instance } = useExerciseInstance("ex-stable", TEMPLATE_SPEC);
      firstTs = instance().ts;
      dispose();
    });
    let secondTs: string | undefined;
    createRoot((dispose) => {
      const { instance } = useExerciseInstance("ex-stable", TEMPLATE_SPEC);
      secondTs = instance().ts;
      dispose();
    });
    expect(firstTs).toBe(secondTs);
  });

  it("produces n+1 distinct seeds after n `another()` calls", () => {
    createRoot((dispose) => {
      const { seed, another } = useExerciseInstance("ex-1", TEMPLATE_SPEC);
      const seeds = new Set<string>();
      seeds.add(seed());
      another();
      seeds.add(seed());
      another();
      seeds.add(seed());
      expect(seeds.size).toBe(3);
      dispose();
    });
  });

  it("seed format is `${exerciseId}::${attempt}`", () => {
    createRoot((dispose) => {
      const { seed, another } = useExerciseInstance("foo/bar/01", TEMPLATE_SPEC);
      expect(seed()).toBe("foo/bar/01::0");
      another();
      expect(seed()).toBe("foo/bar/01::1");
      dispose();
    });
  });
});

describe("useExerciseInstance — opts pass-through", () => {
  it("forwards blanks option to generate (fill-blank-word path)", () => {
    createRoot((dispose) => {
      const { instance } = useExerciseInstance(
        "ex-blanks",
        {
          kind: "template",
          vars: { v: ["42"] },
          ts: "let x = ${v};",
          canonical: "x := ${v}",
        },
        { blanks: ["v"] },
      );
      const out = instance();
      expect(out.blankSegments).toEqual([
        { kind: "text", text: "x := " },
        { kind: "blank", varName: "v", expected: "42" },
      ]);
      dispose();
    });
  });

  it("does not re-fire the memo when `opts` reference changes (opts is treated as stable)", () => {
    /* The current contract: opts is a plain non-reactive parameter
     * captured once. A future "track opts" refactor would re-fire
     * the memo on every render (since callers pass an inline
     * object literal), creating a new instance + record-seen
     * per render and double-counting every learner's instancesSeen.
     * Pin the stability by reading instance() twice and asserting
     * the result is reference-equal. */
    createRoot((dispose) => {
      const { instance } = useExerciseInstance(
        "ex-stable-opts",
        {
          kind: "template",
          vars: { v: ["42"] },
          ts: "${v}",
          canonical: "${v}",
        },
        { blanks: [] },
      );
      const first = instance();
      const second = instance();
      expect(first).toBe(second);
      dispose();
    });
  });
});
