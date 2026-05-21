/*
 * Sanity-check the staged Zig WASM artifacts in Node before trusting
 * the browser worker.
 *
 * Uses @bjorn3/browser_wasi_shim — the same WASI implementation the
 * browser worker depends on — so this exercises the exact code path
 * the worker takes, just with file:// reads instead of fetch. That
 * shared shim is the load-bearing dependency for the whole runtime,
 * and node:wasi's stricter permission gates wouldn't have surfaced a
 * regression in the shim path anyway.
 *
 * Run with: node runtime/zig-wasm/smoke.mjs
 *
 * Requires: `pnpm runtime:zig:build` has staged the artifacts under
 * public/zig/. Will fail loud if any are missing.
 *
 * Lives outside the build path; not shipped to the browser.
 */

import {
  ConsoleStdout,
  Directory,
  File,
  OpenFile,
  PreopenDirectory,
  WASI,
  wasi as wasiDefs,
} from "@bjorn3/browser_wasi_shim";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const stageDir = join(repoRoot, "public", "zig");

const ZIG_WASM = join(stageDir, "zig.wasm");
const LIB_RT = join(stageDir, "libcompiler_rt.a");
const STDLIB_TAR = join(stageDir, "zig-stdlib.tar.gz");

for (const f of [ZIG_WASM, LIB_RT, STDLIB_TAR]) {
  try {
    await readFile(f);
  } catch {
    console.error(`✗ Missing artifact: ${f}\n  Run \`pnpm runtime:zig:build\` first.`);
    process.exit(1);
  }
}

console.log("→ Loading compiler + stdlib + compiler_rt...");
const [compilerBytes, libRtBytes, stdlibDir] = await Promise.all([
  readFile(ZIG_WASM),
  readFile(LIB_RT),
  loadStdlibFromTarball(STDLIB_TAR),
]);
const compilerModule = await WebAssembly.compile(compilerBytes);
console.log(`  zig.wasm:           ${compilerBytes.length} bytes`);
console.log(`  libcompiler_rt.a:   ${libRtBytes.length} bytes`);
console.log(`  stdlib root files:  ${stdlibDir.contents.size}`);

const cases = [
  {
    name: "hello world (writeStreamingAll on stdout)",
    code: `const std = @import("std");

pub fn main(init: std.process.Init) !void {
    try std.Io.File.stdout().writeStreamingAll(init.io, "hello from zig\\n");
}
`,
    wantStdoutContains: "hello from zig",
    wantError: false,
  },
  {
    name: "deliberate type-mismatch compile error",
    code: `const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const x: u32 = "not a number";
    _ = x;
    _ = init;
}
`,
    wantStdoutContains: null,
    wantError: true,
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  console.log(`\n=== ${c.name} ===`);
  const compileResult = await compile(c.code);
  if (!compileResult.ok) {
    console.log("  compile stderr:", JSON.stringify(compileResult.stderr.slice(0, 400)));
    const ok = c.wantError === true;
    console.log("  =>", ok ? "PASS (expected compile error)" : "FAIL (compile failed)");
    if (ok) pass++;
    else fail++;
    continue;
  }
  console.log(`  compiled OK (main.wasm = ${compileResult.bytes.length} bytes)`);

  const runResult = await run(compileResult.bytes);
  console.log("  stdout:", JSON.stringify(runResult.stdout));
  if (runResult.stderr) console.log("  stderr:", JSON.stringify(runResult.stderr));
  console.log("  error :", JSON.stringify(runResult.error));

  const ok =
    c.wantError === true
      ? runResult.error !== ""
      : runResult.error === "" &&
        (c.wantStdoutContains === null || runResult.stdout.includes(c.wantStdoutContains));
  console.log("  =>", ok ? "PASS" : "FAIL");
  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass}/${pass + fail} cases pass`);
process.exit(fail === 0 ? 0 : 1);

/* --- compile + run helpers — duplicate the worker's pipeline ----- */

function captureFd(buf) {
  const dec = new TextDecoder("utf-8", { fatal: false });
  const fd = new ConsoleStdout((chunk) => {
    buf.text += dec.decode(chunk, { stream: true });
  });
  fd.fd_pwrite = () => ({ ret: wasiDefs.ERRNO_SPIPE, nwritten: 0 });
  return fd;
}

async function compile(source) {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };

  const cwd = new Map([
    ["main.zig", new File(new TextEncoder().encode(source))],
    ["libcompiler_rt.a", new File(libRtBytes)],
  ]);

  const fds = [
    new OpenFile(new File([])),
    captureFd(stdoutBuf),
    captureFd(stderrBuf),
    new PreopenDirectory(".", cwd),
    new PreopenDirectory("/lib", stdlibDir.contents),
    new PreopenDirectory("/cache", new Map()),
  ];

  const wasi = new WASI(
    ["zig.wasm", "build-exe", "main.zig", "libcompiler_rt.a", "-fno-compiler-rt", "-fno-entry"],
    [],
    fds,
    { debug: false },
  );
  const instance = await WebAssembly.instantiate(compilerModule, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  let exitCode = 0;
  try {
    exitCode = wasi.start(instance);
  } catch (err) {
    return { ok: false, stderr: stderrBuf.text || String(err) };
  }
  if (exitCode !== 0) return { ok: false, stderr: stderrBuf.text };
  const cwdFd = fds[3];
  const mainWasm = cwdFd.dir.contents.get("main.wasm");
  if (!(mainWasm instanceof File))
    return { ok: false, stderr: stderrBuf.text + "(no main.wasm produced)" };
  return { ok: true, bytes: new Uint8Array(mainWasm.data) };
}

async function run(wasmBytes) {
  const stdoutBuf = { text: "" };
  const stderrBuf = { text: "" };

  const fds = [
    new OpenFile(new File([])),
    captureFd(stdoutBuf),
    captureFd(stderrBuf),
    new PreopenDirectory(".", new Map()),
  ];

  const wasi = new WASI(["main.wasm"], [], fds, { debug: false });
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  let error = "";
  try {
    const exitCode = wasi.start(instance);
    if (exitCode !== 0) error = stderrBuf.text || `program exited with code ${exitCode}`;
  } catch (err) {
    error = stderrBuf.text ? `${stderrBuf.text}\n${String(err)}` : String(err);
  }
  return { stdout: stdoutBuf.text, stderr: stderrBuf.text, error };
}

/* Read tar.gz from disk → in-memory Directory tree rooted at the
 * inner `lib/` (so the compiler can open /lib/std/std.zig once
 * mounted). Mirrors the worker's `fetchStdlib()` without the
 * DecompressionStream + fetch detour. */
async function loadStdlibFromTarball(tgzPath) {
  const chunks = [];
  await pipeline(
    createReadStream(tgzPath),
    createGunzip(),
    new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    }),
  );
  const buf = Buffer.concat(chunks);

  const root = new Map();
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    const name = readCstr(header, 0, 100);
    if (!name) {
      offset += 512;
      continue;
    }
    const sizeOct = readCstr(header, 124, 12).trim();
    const typeflag = String.fromCharCode(header[156]);
    const prefix = readCstr(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = parseInt(sizeOct || "0", 8);

    offset += 512;
    const dataStart = offset;
    offset += Math.ceil(size / 512) * 512;

    if (typeflag !== "0" && typeflag !== "" && typeflag !== " ") continue;
    if (!fullName.startsWith("lib/")) continue;
    const rel = fullName.slice("lib/".length);
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
    cur.set(parts[parts.length - 1], new Uint8Array(buf.subarray(dataStart, dataStart + size)));
  }

  return treeToDirectory(root);
}

function treeToDirectory(node) {
  const contents = new Map();
  for (const [name, value] of node.entries()) {
    if (value instanceof Uint8Array) contents.set(name, new File(value));
    else contents.set(name, treeToDirectory(value));
  }
  return new Directory(contents);
}

function readCstr(buf, start, len) {
  const slice = buf.subarray(start, start + len);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? len : nul).toString("utf8");
}
