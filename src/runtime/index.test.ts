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

describe("getRustRunner / terminateRustRunner", () => {
  /* Mirrors the Yaegi/Zig suites. The Rust runner was added with
   * the server-compile path; its accessor lifecycle must match so
   * `useRuntimeRun` can drive it interchangeably. */
  it("constructs a worker on first call and caches the wrapped proxy", async () => {
    const mod = await import("./index");
    const a = mod.getRustRunner();
    const b = mod.getRustRunner();
    expect(workerCtor).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("terminate clears the singleton so the next call respawns the worker", async () => {
    const mod = await import("./index");
    const first = mod.getRustRunner();
    mod.terminateRustRunner();
    const second = mod.getRustRunner();
    expect(workerCtor).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
  });
});

describe("all three runtime singletons are isolated", () => {
  /* Catches a copy-paste regression where someone refactored the
   * accessors into a shared singleton, or swapped the worker URLs
   * between accessors. The browser would eventually show the
   * symptoms, but a unit test catches it before it ships. The
   * factory-based pattern in src/runtime/index.ts (one closure per
   * language) is specifically defended by this suite. */

  it("all three accessors return mutually distinct proxies", async () => {
    const mod = await import("./index");
    const yaegi = mod.getRunner();
    const zig = mod.getZigRunner();
    const rust = mod.getRustRunner();
    expect(yaegi).not.toBe(zig);
    expect(yaegi).not.toBe(rust);
    expect(zig).not.toBe(rust);
    expect(workerCtor).toHaveBeenCalledTimes(3);
  });

  it("each accessor constructs a worker from its own module URL", async () => {
    const mod = await import("./index");
    mod.getRunner();
    mod.getZigRunner();
    mod.getRustRunner();
    expect(workerCtor).toHaveBeenCalledTimes(3);
    const urls = workerCtor.mock.calls.map((c) => String(c[0]));
    /* All three URLs distinct. A regression that pointed two
     * accessors at the same file would fail this. */
    expect(new Set(urls).size).toBe(3);
    /* Spot-check the names match the expected worker files. */
    expect(urls.some((u) => u.includes("yaegi-worker"))).toBe(true);
    expect(urls.some((u) => u.includes("zig-worker"))).toBe(true);
    expect(urls.some((u) => u.includes("rust-worker"))).toBe(true);
  });

  it("terminating one runtime does not respawn the others", async () => {
    const mod = await import("./index");
    const yaegiBefore = mod.getRunner();
    const zigBefore = mod.getZigRunner();
    const rustBefore = mod.getRustRunner();
    expect(workerCtor).toHaveBeenCalledTimes(3);

    /* Terminate Yaegi → Zig + Rust singletons survive. */
    mod.terminateRunner();
    expect(mod.getZigRunner()).toBe(zigBefore);
    expect(mod.getRustRunner()).toBe(rustBefore);
    expect(workerCtor).toHaveBeenCalledTimes(3);

    /* Terminate Zig → Rust + (respawned) Yaegi survive each other. */
    mod.terminateZigRunner();
    const yaegiAgain = mod.getRunner();
    expect(yaegiAgain).not.toBe(yaegiBefore);
    expect(mod.getRustRunner()).toBe(rustBefore);
    expect(workerCtor).toHaveBeenCalledTimes(4);

    /* Terminate Rust → Yaegi + Zig survive Rust. */
    mod.terminateRustRunner();
    const yaegiStill = mod.getRunner();
    expect(yaegiStill).toBe(yaegiAgain);
    /* Zig was terminated above; calling getZigRunner here would
     * spawn a fresh worker. We only assert non-respawn of the
     * untouched runtimes, so don't re-fetch Zig. */
    expect(workerCtor).toHaveBeenCalledTimes(4);
  });
});
