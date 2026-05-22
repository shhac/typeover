/// <reference lib="WebWorker" />
/*
 * Zig runtime in a Web Worker.
 *
 * Mirrors src/runtime/yaegi-worker.ts in shape: Comlink-exposed
 * `ready()` + `eval(code)` returning { stdout, stderr, error }. The
 * shape difference vs Yaegi is the *pipeline*: Zig has no embeddable
 * source-level interpreter, so we run the actual self-hosted Zig
 * compiler as a WASI program against the user's source, then execute
 * the wasm it produces — two nested WASI runs in one worker.
 *
 * Asset model (staged under public/zig/ by runtime/zig-wasm/build.sh):
 *   /zig/zig.wasm           — the compiler (~3.3 MB raw / ~900 KB brotli)
 *   /zig/libcompiler_rt.a   — manually linked compiler-rt archive
 *   /zig/zig-stdlib.tar.gz  — stdlib tree, mounted at /lib via WASI preopen
 *
 * Loading is split: `ready()` only fetches the compiler bytes (we don't
 * instantiate yet — each compile gets a fresh WASI context, so caching
 * the *module* is what matters). The stdlib tarball + libcompiler_rt.a
 * are deferred to the first `eval()`. That keeps the initial Zig-page
 * cost down to ~1 MB even though the full payload is ~3.4 MB brotli.
 *
 * Why no separate "runner" worker (like zigtools/playground uses):
 * the typing-exercise host (main thread) already owns the
 * terminate-and-respawn lifecycle via terminateRunner() in
 * src/runtime/index.ts. If learner code hangs, the whole worker dies
 * and a fresh one boots — simpler than a two-worker dance for our
 * single-shot, run-on-submit use case.
 */

import { expose } from "comlink";
import {
  ConsoleStdout,
  Directory,
  File,
  OpenFile,
  PreopenDirectory,
  WASI,
  wasi as wasiDefs,
  type Fd,
  type Inode,
} from "@bjorn3/browser_wasi_shim";
import { buildStdlibTree, decompressIfGzipped } from "./zig-assets";

interface ZigResult {
  stdout: string;
  stderr: string;
  /* Empty on a clean compile + run. Compile errors land here verbatim
   * from the Zig compiler's stderr; runtime traps (panic, unreachable)
   * land here too. */
  error: string;
}

interface PreparedAssets {
  /* Cached compiler module — instantiated fresh per eval (each WASI
   * run wants a clean memory + fd table) but compiled once. */
  compilerModule: WebAssembly.Module;
  /* In-memory directory tree of the Zig stdlib, ready to hand to a
   * PreopenDirectory at /lib. */
  stdlibDir: Directory;
  /* Pre-fetched contents of libcompiler_rt.a — copied into each
   * eval's cwd preopen so the compiler can manually link it. */
  libCompilerRt: Uint8Array;
}

let assetsPromise: Promise<PreparedAssets> | null = null;
let compilerPromise: Promise<WebAssembly.Module> | null = null;

/* Step A — fetch + compile the Zig compiler wasm. Cheap to redo on
 * worker restart; the browser caches /zig/zig.wasm so the second
 * worker on the same page is fast. */
function loadCompilerModule(): Promise<WebAssembly.Module> {
  if (compilerPromise) return compilerPromise;
  compilerPromise = (async () => {
    const res = await fetch("/zig/zig.wasm");
    if (!res.ok) throw new Error(`zig.wasm fetch failed (${res.status})`);
    return WebAssembly.compileStreaming(res);
  })();
  return compilerPromise;
}

/* Step B — fetch + decompress + parse the stdlib tarball, fetch
 * libcompiler_rt.a. Deferred until the first eval — most callers of
 * `ready()` are pre-warming the compiler ahead of any actual run, and
 * the stdlib is the bulk of the on-the-wire payload (~2.4 MB brotli).
 *
 * Cached for the worker's lifetime. The Directory tree is rebuilt
 * from a shared underlying File set on each eval (we hand a fresh
 * PreopenDirectory wrapping the same Inode map). */
function loadHeavyAssets(): Promise<PreparedAssets> {
  if (assetsPromise) return assetsPromise;
  assetsPromise = (async () => {
    const [compilerModule, stdlibDir, libCompilerRt] = await Promise.all([
      loadCompilerModule(),
      fetchStdlib(),
      fetchLibCompilerRt(),
    ]);
    return { compilerModule, stdlibDir, libCompilerRt };
  })();
  return assetsPromise;
}

async function fetchStdlib(): Promise<Directory> {
  const res = await fetch("/zig/zig-stdlib.tar.gz");
  if (!res.ok) throw new Error(`zig-stdlib.tar.gz fetch failed (${res.status})`);
  const compressed = await res.arrayBuffer();
  const buf = await decompressIfGzipped(compressed);
  return buildStdlibTree(buf);
}

async function fetchLibCompilerRt(): Promise<Uint8Array> {
  const res = await fetch("/zig/libcompiler_rt.a");
  if (!res.ok) throw new Error(`libcompiler_rt.a fetch failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/* Captures stdout/stderr from a WASI program. The shim ships
 * `ConsoleStdout.lineBuffered`, but it ignores partial trailing lines
 * — the Zig compiler emits unterminated `error: ...` lines on failure
 * and we'd lose them. Roll our own that just appends every write. */
function captureFd(buf: { text: string }): ConsoleStdout {
  const dec = new TextDecoder("utf-8", { fatal: false });
  const fd = new ConsoleStdout((chunk) => {
    buf.text += dec.decode(chunk, { stream: true });
  });
  fd.fd_pwrite = () => ({ ret: wasiDefs.ERRNO_SPIPE, nwritten: 0 });
  return fd;
}

/* WASI bytecode → JS exit-code triage. Returns either a clean exit
 * or a rich error reason; never throws. Centralised so the compile
 * and run pipelines share the same shape and we don't repeat the
 * try/catch + exit-code-non-zero plumbing twice. */
type WasiOutcome = { ok: true; exitCode: number } | { ok: false; reason: string };

function runWasi(
  module: WebAssembly.Module,
  wasi: WASI,
  stderrBuf: { text: string },
): Promise<WasiOutcome>;
function runWasi(
  module: ArrayBuffer,
  wasi: WASI,
  stderrBuf: { text: string },
): Promise<WasiOutcome>;
async function runWasi(
  moduleOrBytes: WebAssembly.Module | ArrayBuffer,
  wasi: WASI,
  stderrBuf: { text: string },
): Promise<WasiOutcome> {
  const mod =
    moduleOrBytes instanceof WebAssembly.Module
      ? moduleOrBytes
      : await WebAssembly.compile(moduleOrBytes);
  const instance = await WebAssembly.instantiate(mod, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  try {
    /* Cast: the shim types `start` against an Instance shape that
     * matches what `WebAssembly.instantiate` returns; the small lib
     * type diff doesn't matter at runtime. */
    const exitCode = wasi.start(instance as unknown as Parameters<typeof wasi.start>[0]);
    return { ok: true, exitCode };
  } catch (err) {
    /* Zig traps and the shim's `wasi.start` exit-throw both land
     * here. Surface stderr alongside the raw error so the learner
     * sees the diagnostic. */
    const errStr = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: stderrBuf.text ? `${stderrBuf.text}\n${errStr}` : errStr,
    };
  }
}

/* Builds the fd table the compile-stage WASI context wants. Hoisting
 * cwd into a named const lets the post-run lookup read
 * `cwdFd.dir.contents.get(...)` directly — no `as PreopenDirectory`
 * cast on `fds[3]`, no risk of an array reorder desyncing the cast. */
function buildCompileFds(
  source: string,
  assets: PreparedAssets,
  stdoutBuf: { text: string },
  stderrBuf: { text: string },
): { fds: Fd[]; cwdFd: PreopenDirectory } {
  const cwdEntries = new Map<string, Inode>([
    ["main.zig", new File(new TextEncoder().encode(source))],
    ["libcompiler_rt.a", new File(assets.libCompilerRt)],
  ]);
  const cwdFd = new PreopenDirectory(".", cwdEntries);
  const fds: Fd[] = [
    new OpenFile(new File([])),
    captureFd(stdoutBuf),
    captureFd(stderrBuf),
    cwdFd,
    new PreopenDirectory("/lib", assets.stdlibDir.contents),
    new PreopenDirectory("/cache", new Map<string, Inode>()),
  ];
  return { fds, cwdFd };
}

/* Read `main.wasm` out of the post-compile cwd preopen, copying into
 * a fresh ArrayBuffer so the caller has a definite
 * `Uint8Array<ArrayBuffer>` view for downstream `WebAssembly.compile`
 * (the shim's `File.data` widens to `ArrayBufferLike` in TS, which
 * the BufferSource overload narrows poorly). */
function extractMainWasm(cwdFd: PreopenDirectory, stderrText: string): ArrayBuffer {
  const mainWasm = cwdFd.dir.contents.get("main.wasm");
  if (!(mainWasm instanceof File)) {
    throw new Error(`compile succeeded but main.wasm not found in cwd; stderr: ${stderrText}`);
  }
  const out = new ArrayBuffer(mainWasm.data.byteLength);
  new Uint8Array(out).set(mainWasm.data);
  return out;
}

/* Stage 1: invoke the compiler. Mirrors the zigtools playground's
 * argv exactly — `build-exe main.zig libcompiler_rt.a` with the two
 * `-fno-...` flags that work around limitations of the self-hosted
 * wasm backend. Returns an ArrayBuffer of main.wasm on success, or
 * throws with the captured stderr on compile failure. */
async function compile(source: string, assets: PreparedAssets): Promise<ArrayBuffer> {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };
  const { fds, cwdFd } = buildCompileFds(source, assets, stdoutBuf, stderrBuf);
  const argv = [
    "zig.wasm",
    "build-exe",
    "main.zig",
    "libcompiler_rt.a",
    "-fno-compiler-rt",
    "-fno-entry",
  ];
  const wasi = new WASI(argv, [], fds, { debug: false });
  const outcome = await runWasi(assets.compilerModule, wasi, stderrBuf);
  if (!outcome.ok) {
    throw new Error(stderrBuf.text || `compile crashed: ${outcome.reason}`);
  }
  if (outcome.exitCode !== 0) {
    throw new Error(stderrBuf.text || `compile failed with exit code ${outcome.exitCode}`);
  }
  return extractMainWasm(cwdFd, stderrBuf.text);
}

/* Stage 2: run the compiled program. Separate WASI context, separate
 * memory — the compiler's address space is irrelevant. We give it a
 * read-only stdin and capture stdout/stderr the same way as compile.
 * If wasi.start throws, it's typically a Zig trap (panic, unreachable,
 * stack overflow) — `runWasi` surfaces that as `outcome.reason`. */
async function run(
  wasmBytes: ArrayBuffer,
): Promise<{ stdout: string; stderr: string; error: string }> {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };

  const fds: Fd[] = [
    new OpenFile(new File([])),
    captureFd(stdoutBuf),
    captureFd(stderrBuf),
    new PreopenDirectory(".", new Map<string, Inode>()),
  ];
  const wasi = new WASI(["main.wasm"], [], fds, { debug: false });
  const outcome = await runWasi(wasmBytes, wasi, stderrBuf);

  let error = "";
  if (!outcome.ok) {
    error = outcome.reason;
  } else if (outcome.exitCode !== 0) {
    error = stderrBuf.text || `program exited with code ${outcome.exitCode}`;
  }
  return { stdout: stdoutBuf.text, stderr: stderrBuf.text, error };
}

const api = {
  /** Idempotent — first call kicks off the compiler wasm fetch. The
   *  heavier stdlib + compiler-rt fetches are deferred to the first
   *  eval() call. */
  async ready(): Promise<void> {
    await loadCompilerModule();
  },

  /** Compile + run user Zig source. Resolves to { stdout, stderr,
   *  error }. `error` is empty on a clean compile + clean exit;
   *  compile errors and runtime traps both surface there. */
  async eval(code: string): Promise<ZigResult> {
    const assets = await loadHeavyAssets();
    let wasm: ArrayBuffer;
    try {
      wasm = await compile(code, assets);
    } catch (err) {
      return { stdout: "", stderr: "", error: err instanceof Error ? err.message : String(err) };
    }
    return run(wasm);
  },
};

expose(api);

export type ZigWorkerAPI = typeof api;
