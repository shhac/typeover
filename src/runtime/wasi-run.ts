/*
 * Shared WASI execution primitives for the language workers.
 *
 * Both rust-worker.ts and zig-worker.ts produce wasm32-wasip1
 * binaries (the Rust one comes from the compile-service; the Zig
 * one comes from the in-browser compiler) and then run them under
 * @bjorn3/browser_wasi_shim. The "build fd table → instantiate →
 * triage exit codes" pipeline was duplicated; extracting it here
 * lets the next language join with one call.
 *
 * The Zig worker keeps its low-level `runWasi(module, wasi,
 * stderrBuf)` helper alongside because its compile stage needs a
 * cached `WebAssembly.Module` plus a custom fd table (cwd preopen,
 * stdlib mount). This file's `runWasiBinary` is the high-level
 * convenience for the "just run this wasm and capture stdio"
 * call sites — the post-compile path on both workers.
 *
 * Per design-docs/32. No DOM dependencies; importable from any
 * Web Worker context.
 */

import {
  ConsoleStdout,
  File,
  OpenFile,
  PreopenDirectory,
  WASI,
  wasi as wasiDefs,
  type Fd,
  type Inode,
} from "@bjorn3/browser_wasi_shim";

export interface WasiRunResult {
  stdout: string;
  stderr: string;
  /** Empty on a clean exit. Compile-time traps (panic, unreachable,
   *  stack overflow) and non-zero exit codes land here. */
  error: string;
}

/** Capture writes to a WASI fd into a `{ text }` accumulator.
 *
 *  The shim's `ConsoleStdout.lineBuffered` ignores partial trailing
 *  lines — Rust `print!` (no newline) and Zig compile-error
 *  emissions would silently disappear. This rolls a stream-decoder
 *  variant that appends every chunk regardless of newline. Originally
 *  lived in zig-worker.ts; centralised here so the Rust worker gets
 *  the same fidelity without re-rolling it. */
export function captureFd(buf: { text: string }): ConsoleStdout {
  const dec = new TextDecoder("utf-8", { fatal: false });
  const fd = new ConsoleStdout((chunk) => {
    buf.text += dec.decode(chunk, { stream: true });
  });
  fd.fd_pwrite = () => ({ ret: wasiDefs.ERRNO_SPIPE, nwritten: 0 });
  return fd;
}

/** Run a wasm32-wasip1 binary with captured stdio + an empty cwd
 *  preopen. Returns `{ stdout, stderr, error }` in the shape the
 *  worker eval surfaces to the freeform UI. Never throws — any
 *  exception (compile failure, trap, non-zero exit) is folded into
 *  `error`. */
export async function runWasiBinary(
  wasmBytes: ArrayBuffer,
  argv: readonly string[] = ["main.wasm"],
): Promise<WasiRunResult> {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };

  const fds: Fd[] = [
    new OpenFile(new File([])),
    captureFd(stdoutBuf),
    captureFd(stderrBuf),
    new PreopenDirectory(".", new Map<string, Inode>()),
  ];
  const wasi = new WASI([...argv], [], fds, { debug: false });

  let error = "";
  try {
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    /* The shim's `wasi.start` catches WASIProcExit internally and
     * returns the exit code; only "real" traps (unreachable,
     * div-by-zero, etc.) propagate as a thrown Error. So capture
     * the return value here — without it, non-zero exits would
     * silently drop and the freeform UI would render success.
     *
     * The shim's start signature uses an Instance type alias that
     * doesn't quite match what `WebAssembly.instantiate` returns;
     * the cast is purely a lib-types compat shim. */
    const exitCode = wasi.start(
      instance as unknown as Parameters<typeof wasi.start>[0],
    );
    if (exitCode !== 0) {
      error =
        stderrBuf.text.trim() || `program exited with code ${exitCode}`;
    }
  } catch (err) {
    /* Compile failure or wasm trap — surface the message. */
    const e = err as { message?: string };
    error = e.message || String(err);
  }

  return { stdout: stdoutBuf.text, stderr: stderrBuf.text, error };
}
