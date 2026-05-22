import { untar } from "@andrewbranch/untar.js";
import { Directory, File, type Inode } from "@bjorn3/browser_wasi_shim";

/*
 * Pure helpers for assembling the Zig compiler's WASI preopen
 * filesystem from network-fetched bytes. No DOM dependencies, no
 * `fetch` calls — the worker (`zig-worker.ts`) orchestrates the
 * fetches and passes ArrayBuffers in. Keeping these pure means:
 *
 *   - The tar-bomb / prefix-strip logic is testable without
 *     spinning up a worker harness.
 *   - The Node smoke harness can import the same code path under
 *     a different I/O strategy (`node:zlib` gunzip + filesystem
 *     read) without duplicating the tree-build logic.
 *
 * Three exports:
 *
 *   - `decompressIfGzipped(buf)` — magic-byte detect + browser
 *     DecompressionStream. The smoke harness skips this entirely
 *     and feeds in already-decompressed bytes from `createGunzip`,
 *     so a server that pre-gunzips the response also flows
 *     unchanged.
 *   - `buildStdlibTree(buf)` — accepts an uncompressed tar
 *     buffer, returns a `Directory` rooted at the stdlib's `lib/`
 *     subtree (the prefix is stripped so the WASI mount-point at
 *     `/lib` lines up with the compiler's expectations).
 *
 * (`treeToDirectory` used to be exported as a sharing handhold for
 * the Node smoke harness, but the harness keeps its own copy
 * because it's `.mjs` and can't import this `.ts` module cleanly.
 * Re-export when an actual consumer materialises.)
 */

/** Internal tree shape — segment name → either a subtree or a
 *  file's bytes. Built up incrementally as we walk tar entries. */
type Tree = Map<string, Tree | Uint8Array>;

/** Browser-only: detect a gzip header and decompress in-place
 *  using `DecompressionStream("gzip")`. If `buf` is already
 *  decompressed (server-side gunzip, or a hand-built test
 *  fixture), returns the input unchanged. */
export async function decompressIfGzipped(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const magic = new Uint8Array(buf, 0, 2);
  if (magic[0] !== 0x1f || magic[1] !== 0x8b) return buf;
  const ds = new DecompressionStream("gzip");
  const stream = new Response(buf).body!.pipeThrough(ds);
  return new Response(stream).arrayBuffer();
}

/** Parse an uncompressed tar buffer (via `@andrewbranch/untar.js`)
 *  into a stdlib Directory rooted at the inner `lib/` subtree.
 *  The Zig compiler's WASI preopen expects `/lib/std/...`, so
 *  stripping the prefix here means the mount point matches without
 *  any per-entry path arithmetic at compile-time. */
export function buildStdlibTree(buf: ArrayBuffer): Directory {
  const entries = untar(buf);
  const root: Tree = new Map();
  for (const e of entries) {
    if (!e.filename.startsWith("lib/")) continue;
    const rel = e.filename.slice("lib/".length);
    if (!rel) continue;
    insertPath(root, rel.split("/"), e.fileData);
  }
  return treeToDirectory(root);
}

/** Walk `parts` deep into `root`, ensuring intermediate Map nodes
 *  exist, and place `data` at the leaf. Exported via use through
 *  `buildStdlibTree`; not part of the public API directly. */
function insertPath(root: Tree, parts: readonly string[], data: Uint8Array): void {
  let cur = root;
  for (const seg of parts.slice(0, -1)) {
    let next = cur.get(seg);
    if (!next || next instanceof Uint8Array) {
      next = new Map();
      cur.set(seg, next);
    }
    cur = next;
  }
  cur.set(parts[parts.length - 1]!, data);
}

/* Recursive Map → Directory conversion. Internal — used by
 * `buildStdlibTree`. Re-export when a consumer outside this file
 * needs it (e.g. a future smoke-harness rewrite that can import
 * this module). */
function treeToDirectory(node: Tree): Directory {
  const contents = new Map<string, Inode>();
  for (const [name, value] of node.entries()) {
    if (value instanceof Uint8Array) {
      contents.set(name, new File(value));
    } else {
      contents.set(name, treeToDirectory(value));
    }
  }
  return new Directory(contents);
}
