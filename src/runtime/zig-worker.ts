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
import { untar } from "@andrewbranch/untar.js";
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

  let buf = await res.arrayBuffer();
  const magic = new Uint8Array(buf, 0, 2);
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    /* Server didn't already gunzip; decompress in the worker. */
    const ds = new DecompressionStream("gzip");
    const stream = new Response(buf).body!.pipeThrough(ds);
    buf = await new Response(stream).arrayBuffer();
  }

  /* The tar bundle is rooted at `lib/std/...` — we want to mount at
   * `/lib` inside WASI, so we strip the `lib/` prefix here and the
   * compiler sees `/lib/std/...`. */
  const entries = untar(buf);
  type Tree = Map<string, Tree | Uint8Array>;
  const root: Tree = new Map();
  for (const e of entries) {
    if (!e.filename.startsWith("lib/")) continue;
    const rel = e.filename.slice("lib/".length);
    if (!rel) continue;
    const parts = rel.split("/");
    let cur = root;
    for (const seg of parts.slice(0, -1)) {
      let next = cur.get(seg);
      if (!next || next instanceof Uint8Array) {
        next = new Map();
        cur.set(seg, next);
      }
      cur = next;
    }
    cur.set(parts[parts.length - 1]!, e.fileData);
  }
  return treeToDirectory(root);
}

function treeToDirectory(node: Map<string, Map<string, unknown> | Uint8Array>): Directory {
  const contents = new Map<string, Inode>();
  for (const [name, value] of node.entries()) {
    if (value instanceof Uint8Array) {
      contents.set(name, new File(value));
    } else {
      /* Recurse — `value` is a Tree (Map). The cast keeps TypeScript
       * quiet without us threading a Tree alias through the public
       * worker surface. */
      contents.set(name, treeToDirectory(value as Map<string, Map<string, unknown> | Uint8Array>));
    }
  }
  return new Directory(contents);
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

/* Stage 1: invoke the compiler. Mirrors the zigtools playground's
 * argv exactly — `build-exe main.zig libcompiler_rt.a` with the two
 * `-fno-...` flags that work around limitations of the self-hosted
 * wasm backend. Returns an ArrayBuffer of main.wasm on success, or
 * throws with the captured stderr on compile failure.
 *
 * Returns an ArrayBuffer (not the shim's Uint8Array) so the
 * downstream WebAssembly.compile call sees a definite
 * Uint8Array<ArrayBuffer> in TS's lib types. */
async function compile(source: string, assets: PreparedAssets): Promise<ArrayBuffer> {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };

  const mainZig = new File(new TextEncoder().encode(source));
  const libCompilerRtFile = new File(assets.libCompilerRt);

  const cwdEntries = new Map<string, Inode>([
    ["main.zig", mainZig],
    ["libcompiler_rt.a", libCompilerRtFile],
  ]);

  const fds = [
    new OpenFile(new File([])),
    captureFd(stdoutBuf),
    captureFd(stderrBuf),
    new PreopenDirectory(".", cwdEntries),
    new PreopenDirectory("/lib", assets.stdlibDir.contents),
    new PreopenDirectory("/cache", new Map<string, Inode>()),
  ] satisfies Fd[];

  const argv = [
    "zig.wasm",
    "build-exe",
    "main.zig",
    "libcompiler_rt.a",
    "-fno-compiler-rt",
    "-fno-entry",
  ];

  const wasi = new WASI(argv, [], fds, { debug: false });
  const instance = await WebAssembly.instantiate(assets.compilerModule, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  let exitCode = 0;
  try {
    /* Cast: the shim types `start` against an Instance shape that
     * matches what `WebAssembly.instantiate` returns; the small lib
     * type diff doesn't matter at runtime. */
    exitCode = wasi.start(instance as unknown as Parameters<typeof wasi.start>[0]);
  } catch (err) {
    throw new Error(stderrBuf.text || `compile crashed: ${String(err)}`);
  }
  if (exitCode !== 0) {
    throw new Error(stderrBuf.text || `compile failed with exit code ${exitCode}`);
  }

  const cwdFd = fds[3] as PreopenDirectory;
  const mainWasm = cwdFd.dir.contents.get("main.wasm");
  if (!(mainWasm instanceof File)) {
    throw new Error(`compile succeeded but main.wasm not found in cwd; stderr: ${stderrBuf.text}`);
  }
  /* Copy into a freshly-allocated ArrayBuffer so the caller has a
   * definite Uint8Array<ArrayBuffer> view available — the shim's
   * `File.data` is typed as bare Uint8Array which TS widens to
   * ArrayBufferLike. */
  const out = new ArrayBuffer(mainWasm.data.byteLength);
  new Uint8Array(out).set(mainWasm.data);
  return out;
}

/* Stage 2: run the compiled program. Separate WASI context, separate
 * memory — the compiler's address space is irrelevant. We give it a
 * read-only stdin and capture stdout/stderr the same way as compile.
 * If wasi.start throws, it's typically a Zig trap (panic, unreachable,
 * stack overflow) — surface that as the program's error. */
async function run(
  wasmBytes: ArrayBuffer,
): Promise<{ stdout: string; stderr: string; error: string }> {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };

  const fds = [
    new OpenFile(new File([])),
    captureFd(stdoutBuf),
    captureFd(stderrBuf),
    new PreopenDirectory(".", new Map<string, Inode>()),
  ] satisfies Fd[];

  const wasi = new WASI(["main.wasm"], [], fds, { debug: false });
  /* Two-step (compile then instantiate) instead of the
   * BufferSource overload of `WebAssembly.instantiate` — the BufferSource
   * overload's return type narrows poorly in TS strict mode when the
   * argument is a Uint8Array variable. */
  const userModule = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(userModule, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  let error = "";
  try {
    const exitCode = wasi.start(instance as unknown as Parameters<typeof wasi.start>[0]);
    if (exitCode !== 0) {
      error = stderrBuf.text || `program exited with code ${exitCode}`;
    }
  } catch (err) {
    /* Zig traps come back as Error("Aborted()") from the WASI shim's
     * abi exit path. Tack on stderr (the panic message often lives
     * there) so the learner sees the diagnostic. */
    error = stderrBuf.text ? `${stderrBuf.text}\n${String(err)}` : String(err);
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
