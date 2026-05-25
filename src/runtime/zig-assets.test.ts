import { describe, expect, it } from "vitest";
import { Directory, File } from "@bjorn3/browser_wasi_shim";
import { buildStdlibTree, decompressIfGzipped } from "./zig-assets";

/*
 * The Zig stdlib mount is reachable from compile-time `@import("std")`
 * exclusively through this module's `buildStdlibTree` output: the
 * tar-prefix-strip + nested-path insertion is the entire bridge
 * between "tarball bytes on the wire" and "files the Zig compiler's
 * WASI preopen sees at `/lib/std/...`". A regression in the slicing
 * math (e.g. stripping "lib/std/" instead of "lib/") would surface
 * as confusing per-exercise "use of undeclared identifier" errors
 * rather than a single boot-time crash, so this is exactly the
 * kind of seam unit tests should pin.
 *
 * `decompressIfGzipped` has its own coverage gap because the magic-
 * byte detect is the load-bearing part — the smoke harness feeds
 * already-decompressed bytes, so a future change that incorrectly
 * always called DecompressionStream would slip past integration
 * and only break the browser path.
 */

/* ─────────────────────────────────────────────────────────────────
 * Tar fixture helpers — assemble a minimal USTAR tar in-memory so
 * we can drive buildStdlibTree without depending on real fixture
 * files or build-time tar binaries. The @andrewbranch/untar.js
 * parser is forgiving about most header fields; we only fill what
 * matters (filename, size, typeflag, checksum).
 * ───────────────────────────────────────────────────────────────── */

interface TarEntry {
  filename: string;
  data: Uint8Array;
}

function makeTar(entries: readonly TarEntry[]): ArrayBuffer {
  const BLOCK = 512;
  /* Per-entry: one header block + ceil(size/512) data blocks.
   * Followed by two zero blocks marking the end. */
  let totalBlocks = 2;
  for (const e of entries) {
    totalBlocks += 1 + Math.ceil(e.data.byteLength / BLOCK);
  }
  const buf = new Uint8Array(totalBlocks * BLOCK);
  let offset = 0;

  for (const entry of entries) {
    const header = new Uint8Array(BLOCK);
    writeString(header, 0, entry.filename, 100);
    writeOctal(header, 100, 0o644, 7);          /* mode */
    writeOctal(header, 108, 0, 7);              /* uid */
    writeOctal(header, 116, 0, 7);              /* gid */
    writeOctal(header, 124, entry.data.byteLength, 11); /* size */
    writeOctal(header, 136, 0, 11);             /* mtime */
    /* Checksum: fill with spaces, sum all bytes, write octal. */
    for (let i = 148; i < 156; i++) header[i] = 0x20;
    header[156] = 0x30;                          /* typeflag '0' = regular file */
    writeString(header, 257, "ustar", 6);       /* magic */
    writeString(header, 263, "00", 2);          /* version */
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += header[i]!;
    writeOctal(header, 148, sum, 6);
    header[154] = 0;
    header[155] = 0x20;
    buf.set(header, offset);
    offset += BLOCK;
    buf.set(entry.data, offset);
    offset += Math.ceil(entry.data.byteLength / BLOCK) * BLOCK;
  }

  /* The trailing pair of zero blocks is already zeroed because
   * `new Uint8Array(...)` initialises to 0; no work needed. */
  return buf.buffer;
}

function writeString(dst: Uint8Array, at: number, value: string, max: number): void {
  const bytes = new TextEncoder().encode(value);
  const n = Math.min(bytes.byteLength, max);
  for (let i = 0; i < n; i++) dst[at + i] = bytes[i]!;
}

function writeOctal(dst: Uint8Array, at: number, value: number, width: number): void {
  const oct = value.toString(8).padStart(width, "0");
  writeString(dst, at, oct, width);
  dst[at + width] = 0; /* null terminator */
}

/* ─────────────────────────────────────────────────────────────────
 * decompressIfGzipped
 * ───────────────────────────────────────────────────────────────── */

describe("decompressIfGzipped", () => {
  it("returns the input unchanged when there's no gzip magic", async () => {
    /* Plain text — the smoke harness path (server pre-gunzipped) or
     * a hand-built test fixture. Magic-byte check sees no 0x1f 0x8b
     * and falls through. */
    const input = new TextEncoder().encode("hello, world").buffer;
    const out = await decompressIfGzipped(input);
    expect(out).toBe(input);
  });

  it("returns the input unchanged for an arbitrary non-gzip header (0x00 0x00)", async () => {
    /* Defensive: a zero-prefix buffer (e.g. tar's leading filename
     * field, which starts ASCII) must NOT be misidentified as gzip
     * and shouldn't crash. */
    const input = new Uint8Array([0x00, 0x00, 0x01, 0x02]).buffer;
    const out = await decompressIfGzipped(input);
    expect(out).toBe(input);
  });

  it("decompresses a real gzip payload via DecompressionStream", async () => {
    /* Build a real gzip stream by piping a known payload through
     * the browser's CompressionStream, then verify
     * decompressIfGzipped reverses it. This is a round-trip test;
     * if the magic-byte detect or the DecompressionStream
     * piping regresses, both directions break loudly. */
    const payload = new TextEncoder().encode("typeover stdlib tarball test fixture");
    const compressed = await new Response(
      new Response(payload).body!.pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();
    const decompressed = await decompressIfGzipped(compressed);
    /* Compare via Array.from to sidestep ArrayBuffer-subtype
     * mismatches between the two Uint8Array views. */
    expect(Array.from(new Uint8Array(decompressed))).toEqual(Array.from(payload));
  });
});

/* ─────────────────────────────────────────────────────────────────
 * buildStdlibTree
 * ───────────────────────────────────────────────────────────────── */

describe("buildStdlibTree — prefix strip + tree shape", () => {
  it("strips the leading 'lib/' so /lib mount aligns with @import('std')", () => {
    /* The compiler issues `@import("std")` paths against its WASI
     * preopen rooted at `/lib`. The tarball ships files at
     * `lib/std/foo.zig`; we strip `lib/` so `/lib/std/foo.zig` lines
     * up. A regression that stripped the wrong prefix (or didn't
     * strip at all) would make every Zig exercise fail with a
     * confusing "use of undeclared identifier" error rather than a
     * boot crash. */
    const tar = makeTar([
      { filename: "lib/std/builtin.zig", data: new TextEncoder().encode("pub const tag = 0;\n") },
    ]);
    const dir = buildStdlibTree(tar);
    const std = dir.contents.get("std");
    expect(std).toBeInstanceOf(Directory);
    if (std instanceof Directory) {
      const builtin = std.contents.get("builtin.zig");
      expect(builtin).toBeInstanceOf(File);
      if (builtin instanceof File) {
        expect(new TextDecoder().decode(builtin.data)).toBe("pub const tag = 0;\n");
      }
    }
  });

  it("drops tar entries that don't start with 'lib/'", () => {
    /* The real stdlib tarball is hand-trimmed to just `lib/`
     * entries, but a future build-script regression that ships the
     * whole repo would otherwise pollute the WASI mount with
     * documentation, build files, etc. The filter is the safety
     * net. */
    const tar = makeTar([
      { filename: "lib/std/main.zig", data: new TextEncoder().encode("kept\n") },
      { filename: "README.md", data: new TextEncoder().encode("dropped\n") },
      { filename: "build.zig", data: new TextEncoder().encode("dropped\n") },
      { filename: "doc/index.html", data: new TextEncoder().encode("dropped\n") },
    ]);
    const dir = buildStdlibTree(tar);
    /* Only "std" survives at the top level. */
    expect(Array.from(dir.contents.keys())).toEqual(["std"]);
  });

  it("drops the bare 'lib/' directory entry without crashing", () => {
    /* untar emits an entry for the directory itself (`lib/`) as
     * well as its children on most real tarballs. After the
     * "lib/".length slice the relative path is empty; the guard
     * skips it. */
    const tar = makeTar([
      { filename: "lib/", data: new Uint8Array(0) },
      { filename: "lib/std/foo.zig", data: new TextEncoder().encode("a\n") },
    ]);
    const dir = buildStdlibTree(tar);
    expect(dir.contents.has("std")).toBe(true);
  });

  it("builds intermediate Directory nodes for deeply nested paths", () => {
    /* `lib/std/os/linux/syscalls.zig` should land at
     * `std/os/linux/syscalls.zig` with `std`, `os`, `linux` all
     * Directory instances. */
    const tar = makeTar([
      {
        filename: "lib/std/os/linux/syscalls.zig",
        data: new TextEncoder().encode("pub const X = 1;\n"),
      },
    ]);
    const dir = buildStdlibTree(tar);
    const std = dir.contents.get("std");
    expect(std).toBeInstanceOf(Directory);
    if (std instanceof Directory) {
      const os = std.contents.get("os");
      expect(os).toBeInstanceOf(Directory);
      if (os instanceof Directory) {
        const linux = os.contents.get("linux");
        expect(linux).toBeInstanceOf(Directory);
        if (linux instanceof Directory) {
          const syscalls = linux.contents.get("syscalls.zig");
          expect(syscalls).toBeInstanceOf(File);
        }
      }
    }
  });

  it("collects multiple files under the same parent directory", () => {
    /* Multiple peers under the same dir share the Tree Map
     * intermediate before treeToDirectory converts it. A
     * regression in `insertPath` that overwrote the intermediate
     * Map on each entry would drop earlier siblings. */
    const tar = makeTar([
      { filename: "lib/std/a.zig", data: new TextEncoder().encode("a\n") },
      { filename: "lib/std/b.zig", data: new TextEncoder().encode("b\n") },
      { filename: "lib/std/c.zig", data: new TextEncoder().encode("c\n") },
    ]);
    const dir = buildStdlibTree(tar);
    const std = dir.contents.get("std");
    expect(std).toBeInstanceOf(Directory);
    if (std instanceof Directory) {
      expect(new Set(std.contents.keys())).toEqual(new Set(["a.zig", "b.zig", "c.zig"]));
    }
  });

  it("returns an empty Directory when no entry starts with 'lib/'", () => {
    const tar = makeTar([
      { filename: "README.md", data: new TextEncoder().encode("noop\n") },
    ]);
    const dir = buildStdlibTree(tar);
    expect(dir.contents.size).toBe(0);
  });
});
