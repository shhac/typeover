import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWasiBinary } from "./wasi-run";

/*
 * Direct tests for runWasiBinary.
 *
 * Real wasm fixtures would be heavyweight here — what we want to
 * pin is the orchestration around the shim: captureFd's no-newline
 * tail handling, exit-code triage, trap surfacing, and the invalid-
 * wasm path. So we stub WebAssembly.compile/instantiate and hand
 * the shim a synthetic instance whose `_start` directly calls the
 * wasi imports it was given. That exercises the real shim plumbing
 * (Ciovec parsing, ConsoleStdout dispatch, WASIProcExit handling)
 * without needing an engine.
 *
 * The rust/zig workers cover the "real compiled wasm runs end-to-
 * end" path; this file covers the surrounding logic.
 */

type Imports = {
  wasi_snapshot_preview1: {
    fd_write: (fd: number, iovs: number, iovs_len: number, nwritten: number) => number;
    proc_exit: (code: number) => never;
  };
};

interface SyntheticContext {
  memory: WebAssembly.Memory;
  view: DataView;
  bytes: Uint8Array;
  /** Call wasi.fd_write to push `text` to fd 1 (stdout) or 2 (stderr). */
  write: (fd: 1 | 2, text: string) => void;
  /** Throw WASIProcExit through the shim. */
  exit: (code: number) => never;
}

/** Replaces WebAssembly.compile/instantiate so the shim runs the
 *  supplied `_start` body. The body receives a context object with
 *  helpers that wrap the iovec dance for fd_write. Returns a cleanup
 *  function that restores the originals. */
function withSyntheticWasm(
  start: (ctx: SyntheticContext) => void,
  opts: { compileFails?: Error } = {},
): () => void {
  const memory = new WebAssembly.Memory({ initial: 1 });

  const compileSpy = vi.spyOn(WebAssembly, "compile").mockImplementation(async () => {
    if (opts.compileFails) throw opts.compileFails;
    return {} as WebAssembly.Module;
  });

  const instantiateSpy = vi
    .spyOn(WebAssembly, "instantiate")
    /* The Module-overload of instantiate returns Instance. The
     * Bytes-overload returns { module, instance } — but runWasiBinary
     * calls the Module form, so this stub only handles that. */
    .mockImplementation(
      async (_module: WebAssembly.Module, imports?: WebAssembly.Imports) => {
        const wasi = (imports as unknown as Imports).wasi_snapshot_preview1;
        const ctx: SyntheticContext = {
          memory,
          view: new DataView(memory.buffer),
          bytes: new Uint8Array(memory.buffer),
          write: (fd, text) => {
            /* Build one iovec at offset 0 pointing at data at offset
             * 64; nwritten is written back at offset 32. Offsets are
             * arbitrary but must not collide. */
            const data = new TextEncoder().encode(text);
            const iovsPtr = 0;
            const dataPtr = 64;
            const nwrittenPtr = 32;
            ctx.bytes.set(data, dataPtr);
            ctx.view.setUint32(iovsPtr, dataPtr, true);
            ctx.view.setUint32(iovsPtr + 4, data.length, true);
            wasi.fd_write(fd, iovsPtr, 1, nwrittenPtr);
          },
          exit: (code) => wasi.proc_exit(code),
        };
        return {
          exports: { memory, _start: () => start(ctx) },
        } as unknown as WebAssembly.Instance;
      },
    );

  return () => {
    compileSpy.mockRestore();
    instantiateSpy.mockRestore();
  };
}

const DUMMY_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]).buffer;

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("runWasiBinary — stdout capture", () => {
  it("collects bytes written to fd 1 into result.stdout", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(1, "hello, world\n");
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.stdout).toBe("hello, world\n");
    expect(result.stderr).toBe("");
    expect(result.error).toBe("");
  });

  it("concatenates multiple fd_write calls in order", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(1, "first ");
      ctx.write(1, "second ");
      ctx.write(1, "third\n");
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.stdout).toBe("first second third\n");
  });
});

describe("runWasiBinary — stderr capture", () => {
  it("collects bytes written to fd 2 into result.stderr", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(2, "error: bad input\n");
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.stderr).toBe("error: bad input\n");
    expect(result.stdout).toBe("");
    expect(result.error).toBe("");
  });

  it("keeps stdout and stderr in their own buffers", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(1, "out-1\n");
      ctx.write(2, "err-1\n");
      ctx.write(1, "out-2\n");
      ctx.write(2, "err-2\n");
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.stdout).toBe("out-1\nout-2\n");
    expect(result.stderr).toBe("err-1\nerr-2\n");
  });
});

describe("runWasiBinary — partial / trailing-newline-free output", () => {
  /* Defends the captureFd helper's reason-for-being: the shim's
   * `ConsoleStdout.lineBuffered` factory drops partial trailing
   * lines that don't end in `\n`. Rust `print!(...)` (no newline)
   * and Zig compile errors both write such lines. Regressing
   * captureFd back to lineBuffered would silently truncate
   * learner output — this test catches that. */
  it("captures fd writes that do not end in a newline", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(1, "no trailing newline");
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.stdout).toBe("no trailing newline");
  });

  it("captures stderr writes that do not end in a newline", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(2, "error without newline");
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.stderr).toBe("error without newline");
  });
});

describe("runWasiBinary — non-zero exit", () => {
  /* proc_exit(code) in the shim throws WASIProcExit, which
   * wasi.start catches and *returns* as the exit code (it does
   * not re-throw). runWasiBinary must read that return value
   * to surface the failure — otherwise non-zero exits silently
   * drop and the freeform UI shows success. */
  it("surfaces stderr as the error when the program exits non-zero", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(2, "panic: index out of bounds\n");
      ctx.exit(101);
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.error).toBe("panic: index out of bounds");
    /* stderr buffer is still populated so the worker can choose
     * to surface it directly if it wants. */
    expect(result.stderr).toBe("panic: index out of bounds\n");
  });

  it("falls back to a generic message when the program exits non-zero with no stderr", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.exit(2);
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.error).toBe("program exited with code 2");
  });

  it("treats exit code 0 as a clean success", async () => {
    cleanup = withSyntheticWasm((ctx) => {
      ctx.write(1, "done\n");
      ctx.exit(0);
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.stdout).toBe("done\n");
    expect(result.error).toBe("");
  });
});

describe("runWasiBinary — trap", () => {
  /* A WebAssembly trap (unreachable, divide-by-zero, etc.) shows
   * up as a thrown Error from `_start` that is NOT WASIProcExit;
   * the shim re-throws it untouched. runWasiBinary's outer catch
   * surfaces the message into `error`. */
  it("surfaces a trap as result.error using the thrown message", async () => {
    cleanup = withSyntheticWasm(() => {
      throw new WebAssembly.RuntimeError("unreachable executed");
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.error).toBe("unreachable executed");
  });

  it("surfaces a non-Error throw via String(err)", async () => {
    cleanup = withSyntheticWasm(() => {
      /* eslint-disable-next-line @typescript-eslint/only-throw-error */
      throw "raw string throw";
    });
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.error).toBe("raw string throw");
  });
});

describe("runWasiBinary — invalid wasm", () => {
  /* WebAssembly.compile rejection bubbles up through the same
   * try/catch as a trap. The error message is whatever the
   * compile path threw. */
  it("surfaces the compile error as result.error", async () => {
    cleanup = withSyntheticWasm(
      () => {
        /* never runs — compile failed before instantiate. */
      },
      { compileFails: new WebAssembly.CompileError("invalid section id") },
    );
    const result = await runWasiBinary(DUMMY_BYTES);
    expect(result.error).toBe("invalid section id");
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
