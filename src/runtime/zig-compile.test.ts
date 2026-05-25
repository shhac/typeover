import { describe, expect, it } from "vitest";
import { Directory, File, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import {
  buildCompileFds,
  extractMainWasm,
  tryCompile,
  type PreparedAssets,
} from "./zig-compile";

/*
 * Direct tests for the pure-ish surface of the Zig compile
 * pipeline. The actual `compile()` round-trip (load wasm → WASI
 * run → main.wasm extract) needs a real Zig compiler module and
 * runs as part of the integration smoke; this file pins the
 * fd-table assembly and the post-compile extraction, plus the
 * try-wrap of `compile()` for the failure-envelope contract.
 *
 * The full `compile()` is also indirectly covered via the existing
 * `runtime/wasi-run.test.ts` pattern (synthetic WebAssembly.Module
 * + synthetic instance) for the run stage; the compile-stage WASI
 * harness is too coupled to the real Zig binary's argv conventions
 * to mock at this layer, so we stop at the seams we own.
 */

function makeAssets(overrides: Partial<PreparedAssets> = {}): PreparedAssets {
  return {
    compilerModule: {} as WebAssembly.Module,
    stdlibDir: new Directory(new Map()),
    libCompilerRt: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]),
    ...overrides,
  };
}

describe("buildCompileFds", () => {
  it("seats main.zig + libcompiler_rt.a in the cwd preopen", () => {
    const assets = makeAssets({ libCompilerRt: new Uint8Array([1, 2, 3]) });
    const stdoutBuf = { text: "" };
    const stderrBuf = { text: "" };
    const { cwdFd } = buildCompileFds("const std = @import(\"std\");\n", assets, stdoutBuf, stderrBuf);

    const main = cwdFd.dir.contents.get("main.zig");
    const rt = cwdFd.dir.contents.get("libcompiler_rt.a");
    expect(main).toBeInstanceOf(File);
    expect(rt).toBeInstanceOf(File);
    if (main instanceof File) {
      /* main.zig content round-trips through UTF-8 encode. */
      expect(new TextDecoder().decode(main.data)).toBe("const std = @import(\"std\");\n");
    }
    if (rt instanceof File) {
      /* libcompiler_rt.a is the prepared bytes verbatim. */
      expect(Array.from(rt.data)).toEqual([1, 2, 3]);
    }
  });

  it("assembles fd 0/1/2 as stdin/stdout/stderr and fd 3 as the cwd preopen", () => {
    /* The Zig compiler argv depends on this exact fd-table layout:
     *   0: OpenFile(empty) — stdin
     *   1: captureFd(stdoutBuf)
     *   2: captureFd(stderrBuf)
     *   3: PreopenDirectory(".", cwdEntries) ← exposed as cwdFd
     *   4: PreopenDirectory("/lib", stdlib)
     *   5: PreopenDirectory("/cache", empty)
     * A reorder regression would either hang the compiler waiting
     * for input on the wrong fd or silently drop its diagnostics.
     * The post-run lookup in extractMainWasm reads cwdFd directly
     * (not fds[3]), so the cwdFd-vs-fds[3] alias is what's pinned. */
    const { fds, cwdFd } = buildCompileFds("", makeAssets(), { text: "" }, { text: "" });
    expect(fds.length).toBe(6);
    expect(fds[3]).toBe(cwdFd);
    expect(fds[4]).toBeInstanceOf(PreopenDirectory);
    expect(fds[5]).toBeInstanceOf(PreopenDirectory);
  });

  /* captureFd binding contract — that writes land in the
   * supplied buf — is pinned by wasi-run.test.ts. Verifying the
   * shim's iovec write path here would duplicate that coverage
   * and rely on internal fd_write encoding details we deliberately
   * don't touch. */
});

describe("extractMainWasm", () => {
  it("returns a fresh ArrayBuffer copy of main.wasm's bytes", () => {
    const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const cwd = new PreopenDirectory(".", new Map([["main.wasm", new File(bytes)]]));
    const out = extractMainWasm(cwd, "");
    expect(out).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(out)).toEqual(bytes);
  });

  it("copies into a fresh buffer (not an alias of the File's data)", () => {
    /* The doc-comment makes the copy-vs-alias contract explicit:
     * downstream `WebAssembly.compile` needs a definite
     * Uint8Array<ArrayBuffer> view, not the shim's broader
     * ArrayBufferLike alias. Mutate the returned buffer and check
     * the source File is unaffected. */
    const original = new Uint8Array([1, 2, 3, 4]);
    const cwd = new PreopenDirectory(".", new Map([["main.wasm", new File(original)]]));
    const out = extractMainWasm(cwd, "");
    new Uint8Array(out)[0] = 0xff;
    expect(original[0]).toBe(1);
  });

  it("throws when main.wasm is missing, including the captured stderr", () => {
    const cwd = new PreopenDirectory(".", new Map());
    expect(() => extractMainWasm(cwd, "error: parse error at line 3")).toThrow(
      /main\.wasm not found.*error: parse error at line 3/,
    );
  });

  it("throws when the entry exists but isn't a File (e.g. a Directory)", () => {
    /* Defensive: the `instanceof File` check protects against a
     * tar-extraction or fd-table regression that places a
     * Directory named "main.wasm" in cwd. Without the check the
     * downstream WebAssembly.compile would explode on garbage
     * bytes; with it, the failure surfaces here with a useful
     * message. */
    const cwd = new PreopenDirectory(
      ".",
      new Map([["main.wasm", new Directory(new Map())]]),
    );
    expect(() => extractMainWasm(cwd, "")).toThrow(/main\.wasm not found/);
  });
});

describe("tryCompile — failure envelope", () => {
  /* `compile()` throws on a failed compile (and on internal traps
   * from runWasi). `tryCompile` wraps that in the ok-tagged
   * envelope so the worker's eval() reads as a flat early-return.
   * The envelope shape matters: a regression that returned
   * `{ok:true, bytes:undefined}` instead of `{ok:false, error}`
   * would silently feed undefined into runWasiBinary on a
   * compile failure. */
  it("returns ok=false with the thrown message when assets are malformed", async () => {
    /* The compilerModule is `{}` — `WebAssembly.instantiate` will
     * reject it. The error string is the actual exception
     * message, surfaced verbatim. */
    const result = await tryCompile("fn main() {}", makeAssets());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
