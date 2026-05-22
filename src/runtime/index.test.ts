import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Lazy-singleton contracts for `getRunner` / `terminateRunner` and
 * `getZigRunner` / `terminateZigRunner`.
 *
 * These accessors are the only way exercise components reach the
 * Web Workers, so the identity guarantees (same reference returned
 * across calls; terminate clears so the next call respawns) are
 * load-bearing for the runtime hook's lifecycle:
 *
 *   - If `getXRunner()` returned a fresh worker per call, every
 *     `useRuntimeRun` consumer on the page would download the WASM
 *     redundantly.
 *   - If `terminateXRunner` didn't clear the cached singleton, a
 *     learner who hit "Stop" mid-runaway-loop would get the dead
 *     worker handed back on the next Run.
 *   - If yaegi and zig accessors silently shared the same cached
 *     worker (e.g. via a copy-paste regression in this module), a
 *     learner on a Zig exercise would receive a Yaegi worker and
 *     vice versa — the symptoms would only show up at runtime,
 *     not at typecheck.
 *
 * jsdom doesn't ship the `Worker` constructor; the tests stub
 * `globalThis.Worker` and Comlink's `wrap` so the module's internals
 * are observable without spinning up real WASM.
 */

/* Per-test counters so we can assert "exactly one Worker was
 * constructed" (vs the lookalike "the wrap call fired N times"). */
const { workerCtor, wrapMock } = vi.hoisted(() => ({
  workerCtor: vi.fn(),
  wrapMock: vi.fn(),
}));

vi.mock("comlink", () => ({
  wrap: wrapMock,
}));

class FakeWorker {
  terminated = false;
  constructor(url: URL | string) {
    workerCtor(url);
  }
  terminate() {
    this.terminated = true;
  }
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

beforeEach(() => {
  workerCtor.mockReset();
  wrapMock.mockReset();
  /* Each call to wrap returns a distinct sentinel so identity
   * assertions catch a regression that returned a fresh proxy on
   * every getRunner call instead of caching one. */
  let n = 0;
  wrapMock.mockImplementation(() => ({
    __wrapped: n++,
    ready: vi.fn().mockResolvedValue(undefined),
  }));
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (globalThis as any).Worker = FakeWorker;
  /* The module caches singletons at module scope; reset between
   * tests by re-importing under a fresh module registry. Vitest's
   * `vi.resetModules` does exactly this. */
  vi.resetModules();
});

afterEach(() => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  delete (globalThis as any).Worker;
});

describe("getRunner / terminateRunner", () => {
  it("constructs a worker on first call and caches the wrapped proxy", async () => {
    const mod = await import("./index");
    const a = mod.getRunner();
    const b = mod.getRunner();
    expect(workerCtor).toHaveBeenCalledTimes(1);
    /* Identity check: same reference returned across calls — proves
     * the `if (yaegiRunner) return yaegiRunner` early-return works. */
    expect(a).toBe(b);
  });

  it("terminate clears the singleton so the next call respawns the worker", async () => {
    const mod = await import("./index");
    const first = mod.getRunner();
    mod.terminateRunner();
    const second = mod.getRunner();
    expect(workerCtor).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
  });
});

describe("getZigRunner / terminateZigRunner", () => {
  it("constructs a worker on first call and caches the wrapped proxy", async () => {
    const mod = await import("./index");
    const a = mod.getZigRunner();
    const b = mod.getZigRunner();
    expect(workerCtor).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("terminate clears the singleton so the next call respawns the worker", async () => {
    const mod = await import("./index");
    const first = mod.getZigRunner();
    mod.terminateZigRunner();
    const second = mod.getZigRunner();
    expect(workerCtor).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
  });
});

describe("yaegi and zig singletons are isolated", () => {
  /* Catches a copy-paste regression where someone refactored the
   * two accessors into a shared singleton, or swapped the worker
   * URLs between getRunner and getZigRunner. The browser would
   * eventually show the symptoms, but a unit test catches it
   * before it ships. */

  it("getRunner and getZigRunner return distinct proxies", async () => {
    const mod = await import("./index");
    const yaegi = mod.getRunner();
    const zig = mod.getZigRunner();
    expect(yaegi).not.toBe(zig);
    expect(workerCtor).toHaveBeenCalledTimes(2);
  });

  it("each accessor constructs a worker from its own module URL", async () => {
    const mod = await import("./index");
    mod.getRunner();
    mod.getZigRunner();
    expect(workerCtor).toHaveBeenCalledTimes(2);
    const urls = workerCtor.mock.calls.map((c) => String(c[0]));
    /* Each call passes a different module URL (the worker file
     * literal). A regression that pointed both at the same file
     * would fail this. */
    expect(urls[0]).not.toBe(urls[1]);
    /* And spot-check the names match the expected worker files. */
    expect(urls.some((u) => u.includes("yaegi-worker"))).toBe(true);
    expect(urls.some((u) => u.includes("zig-worker"))).toBe(true);
  });

  it("terminating Yaegi does not respawn the Zig worker (and vice versa)", async () => {
    const mod = await import("./index");
    const zigBefore = mod.getZigRunner();
    mod.getRunner();
    expect(workerCtor).toHaveBeenCalledTimes(2);
    mod.terminateRunner();
    const zigAfter = mod.getZigRunner();
    /* The Zig singleton survives the Yaegi terminate. */
    expect(zigAfter).toBe(zigBefore);
    expect(workerCtor).toHaveBeenCalledTimes(2);
  });
});
