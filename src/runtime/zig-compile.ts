/*
 * Zig compile pipeline — fetch the compiler + stdlib + libcompiler_rt,
 * run `zig build-exe` against the learner's source under a WASI
 * context, hand back the produced `main.wasm` bytes.
 *
 * Extracted from zig-worker.ts so the asset-loading + compile-stage
 * logic is reachable without standing up a Comlink-expose'd worker
 * module. The worker is a thin wrapper around `tryCompile()` —
 * everything else lives here.
 *
 * Mirrors what zigtools/playground does, but as a single one-shot
 * compile-then-run pipeline rather than a long-lived REPL: the
 * compiler module is cached for the worker's lifetime; the heavier
 * stdlib + libcompiler_rt fetches are deferred to the first eval.
 *
 * Asset model (staged under public/zig/ by runtime/zig-wasm/build.sh):
 *   /zig/zig.wasm           — the compiler (~3.3 MB raw / ~900 KB brotli)
 *   /zig/libcompiler_rt.a   — manually linked compiler-rt archive
 *   /zig/zig-stdlib.tar.gz  — stdlib tree, mounted at /lib via WASI preopen
 */

import {
  Directory,
  File,
  OpenFile,
  PreopenDirectory,
  WASI,
  type Fd,
  type Inode,
} from "@bjorn3/browser_wasi_shim";
import { buildStdlibTree, decompressIfGzipped } from "./zig-assets";
import { captureFd } from "./wasi-run";
import { errorMessage } from "~/lib/error-message";

export interface PreparedAssets {
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

/** Step A — fetch + compile the Zig compiler wasm. Cheap to redo on
 *  worker restart; the browser caches /zig/zig.wasm so the second
 *  worker on the same page is fast. */
export function loadCompilerModule(): Promise<WebAssembly.Module> {
  if (compilerPromise) return compilerPromise;
  compilerPromise = (async () => {
    const res = await fetch("/zig/zig.wasm");
    if (!res.ok) throw new Error(`zig.wasm fetch failed (${res.status})`);
    return WebAssembly.compileStreaming(res);
  })();
  return compilerPromise;
}

/** Step B — fetch + decompress + parse the stdlib tarball, fetch
 *  libcompiler_rt.a. Deferred until the first eval — most callers of
 *  `ready()` are pre-warming the compiler ahead of any actual run, and
 *  the stdlib is the bulk of the on-the-wire payload (~2.4 MB brotli).
 *
 *  Cached for the worker's lifetime. The Directory tree is rebuilt
 *  from a shared underlying File set on each eval (we hand a fresh
 *  PreopenDirectory wrapping the same Inode map). */
export function loadHeavyAssets(): Promise<PreparedAssets> {
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

/* WASI bytecode → JS exit-code triage. Returns either a clean exit
 * or a rich error reason; never throws. Centralised so the compile
 * and run pipelines share the same shape and we don't repeat the
 * try/catch + exit-code-non-zero plumbing twice.
 *
 * `runWasi` here (taking a Module + WASI + stderr buffer) is the
 * lower-level form used by the compile stage. The high-level
 * `runWasiBinary` in wasi-run.ts wraps WebAssembly.compile around
 * raw bytes and is used by the post-compile run stage; the two
 * coexist because the compile stage needs the cached
 * WebAssembly.Module + custom fd table form. */
type WasiOutcome = { ok: true; exitCode: number } | { ok: false; reason: string };

async function runWasi(
  module: WebAssembly.Module,
  wasi: WASI,
  stderrBuf: { text: string },
): Promise<WasiOutcome> {
  const instance = await WebAssembly.instantiate(module, {
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
    const errStr = errorMessage(err);
    return {
      ok: false,
      reason: stderrBuf.text ? `${stderrBuf.text}\n${errStr}` : errStr,
    };
  }
}

/** Builds the fd table the compile-stage WASI context wants. Hoisting
 *  cwd into a named const lets the post-run lookup read
 *  `cwdFd.dir.contents.get(...)` directly — no `as PreopenDirectory`
 *  cast on `fds[3]`, no risk of an array reorder desyncing the cast. */
export function buildCompileFds(
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

/** Read `main.wasm` out of the post-compile cwd preopen, copying into
 *  a fresh ArrayBuffer so the caller has a definite
 *  `Uint8Array<ArrayBuffer>` view for downstream `WebAssembly.compile`
 *  (the shim's `File.data` widens to `ArrayBufferLike` in TS, which
 *  the BufferSource overload narrows poorly). */
export function extractMainWasm(cwdFd: PreopenDirectory, stderrText: string): ArrayBuffer {
  const mainWasm = cwdFd.dir.contents.get("main.wasm");
  if (!(mainWasm instanceof File)) {
    throw new Error(`compile succeeded but main.wasm not found in cwd; stderr: ${stderrText}`);
  }
  const out = new ArrayBuffer(mainWasm.data.byteLength);
  new Uint8Array(out).set(mainWasm.data);
  return out;
}

/** Stage 1: invoke the compiler. Mirrors the zigtools playground's
 *  argv exactly — `build-exe main.zig libcompiler_rt.a` with the two
 *  `-fno-...` flags that work around limitations of the self-hosted
 *  wasm backend. Returns an ArrayBuffer of main.wasm on success, or
 *  throws with the captured stderr on compile failure. */
export async function compile(source: string, assets: PreparedAssets): Promise<ArrayBuffer> {
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

/** Result-envelope wrapper around `compile()` so the worker's eval()
 *  can read as a flat early-return chain rather than a try/catch
 *  around the throwing variant. */
export async function tryCompile(
  code: string,
  assets: PreparedAssets,
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; error: string }> {
  try {
    return { ok: true, bytes: await compile(code, assets) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
