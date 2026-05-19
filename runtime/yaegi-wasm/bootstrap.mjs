/*
 * Shared Yaegi bootstrap for Node-side CLIs (smoke.mjs, matrix.mjs,
 * verify-runnable.mjs).
 *
 * Each script used to duplicate ~10 lines of fetch wasm_exec.js → run
 * via new Function → instantiate yaegi.wasm → go.run → yield. Lifted
 * here so the three CLIs read as their own purpose (snippet matrix
 * vs smoke cases vs content scan) and the bootstrap timing /
 * microtask-yield is in one place.
 *
 * The browser worker (src/runtime/yaegi-worker.ts) does the same
 * thing for the in-page runtime — that path is kept separate
 * because it runs inside a Web Worker rather than Node and has
 * different fetch semantics (network fetch vs node:fs/promises).
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* Resolve repo-relative paths. The CLIs all live in runtime/yaegi-wasm/
 * so the repo root is two levels up. */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const defaultWasmPath = join(repoRoot, "public", "yaegi", "yaegi.wasm");
const defaultExecPath = join(repoRoot, "public", "yaegi", "wasm_exec.js");

/**
 * Boot Yaegi inside the Node process and return the eval function
 * registered on globalThis. After this resolves, callers invoke
 * `yaegiEval(code)` and get back {stdout, stderr, error}.
 *
 * Returns the eval function rather than just resolving so callers
 * can hold a direct reference (and so a future async-init refactor
 * can swap the registration mechanism without changing call sites).
 */
export async function bootstrapYaegi({
  wasmPath = defaultWasmPath,
  execPath = defaultExecPath,
} = {}) {
  const execSrc = await readFile(execPath, "utf8");
  /* wasm_exec.js is a classic non-module script that registers `Go`
   * on globalThis. Function-constructor execution gives it global
   * scope without a top-level eval. */
  new Function(execSrc)();

  const go = new globalThis.Go();
  const wasmBytes = await readFile(wasmPath);
  const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
  /* Fire-and-forget the Go runtime — main() registers yaegiEval and
   * then parks on a channel. The promise won't resolve until the
   * runtime exits, which it won't, by design. */
  void go.run(instance);

  /* Yield one macrotask so yaegiEval registration completes before
   * the first call. A microtask wasn't enough in practice; the
   * 50 ms timeout was the legacy value across all three CLIs and
   * is preserved here. */
  await new Promise((r) => setTimeout(r, 50));

  if (typeof globalThis.yaegiEval !== "function") {
    throw new Error("WASM ran but did not register yaegiEval");
  }
  return globalThis.yaegiEval;
}
