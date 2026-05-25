import { describe, expect, it, vi } from "vitest";
import { runRustc, type SandboxLike } from "./sandbox";

/* `runRustc` is the result-decoder slice of SandboxTransport.compile —
 * pure with respect to a `SandboxLike` mock. The full transport
 * also handles round-robin shard selection + the SDK dynamic
 * import; both are integration-tested only via deploy. The
 * decoder is where silent bugs would land (e.g. stderr-trimming
 * regressions or "exit 0 but missing wasm" branch flips). */

function fakeSandbox(opts: {
  exitCode?: number;
  stderr?: string;
  wasm?: Buffer | null;
}): SandboxLike {
  return {
    writeFiles: vi.fn().mockResolvedValue(undefined),
    runCommand: vi.fn().mockResolvedValue({
      exitCode: opts.exitCode ?? 0,
      stderr: async () => opts.stderr ?? "",
    }),
    readFileToBuffer: vi
      .fn()
      .mockResolvedValue(opts.wasm === undefined ? Buffer.from([0]) : opts.wasm),
  } as unknown as SandboxLike;
}

describe("runRustc", () => {
  it("writes /tmp/main.rs with the source verbatim", async () => {
    const sandbox = fakeSandbox({});
    await runRustc(sandbox, 'fn main() {}', Date.now());
    expect(sandbox.writeFiles).toHaveBeenCalledWith([
      { path: "/tmp/main.rs", content: "fn main() {}" },
    ]);
  });

  it("returns wasm bytes on a clean exit", async () => {
    const sandbox = fakeSandbox({ wasm: Buffer.from([1, 2, 3, 4]) });
    const result = await runRustc(sandbox, 'fn main() {}', Date.now());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.wasm)).toEqual([1, 2, 3, 4]);
    }
  });

  it("returns the trimmed stderr on a non-zero exit", async () => {
    const sandbox = fakeSandbox({
      exitCode: 1,
      stderr: "  error: expected `;`, found `}`\n  ",
    });
    const result = await runRustc(sandbox, "fn main() {", Date.now());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("error: expected `;`, found `}`");
    }
  });

  it("falls back to a code-N message when stderr is empty on non-zero exit", async () => {
    const sandbox = fakeSandbox({ exitCode: 42, stderr: "" });
    const result = await runRustc(sandbox, "fn main() {}", Date.now());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("rustc exited 42");
  });

  it("treats a missing /tmp/out.wasm as failure (distinct message)", async () => {
    const sandbox = fakeSandbox({ exitCode: 0, wasm: null });
    const result = await runRustc(sandbox, "fn main() {}", Date.now());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/missing/);
    }
  });

  it("records elapsedSeconds derived from startedAt", async () => {
    const sandbox = fakeSandbox({});
    /* startedAt 100ms in the past — elapsed should be ≥ 0.05s. */
    const result = await runRustc(sandbox, 'fn main() {}', Date.now() - 100);
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(0.05);
  });
});
