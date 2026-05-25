import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash";

describe("sha256Hex", () => {
  /* Cache-coordination is keyed on this hex. Any regression in
   * byte ordering, padding, or case would cause silent cache
   * misses (SW lookups never find prebake-written assets), so
   * pin the bytes against canonical SHA-256 vectors. */

  it("hashes the empty string to the well-known SHA-256 vector", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes ASCII `abc` to the well-known vector", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic across repeated calls", async () => {
    const a = await sha256Hex("typeover");
    const b = await sha256Hex("typeover");
    expect(a).toBe(b);
  });

  it("output is always 64 lowercase hex characters", async () => {
    const samples = ["", "a", "fn main() {}", "🦀"];
    for (const s of samples) {
      const hex = await sha256Hex(s);
      expect(hex).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("pads bytes < 0x10 with a leading zero (catches `.toString(16)` w/o padStart regression)", async () => {
    /* SHA-256("abc") = ba 78 16 bf 8f 01 cf ea ...
     * The 6th byte is 0x01 — must serialize as "01", not "1".
     * Without padStart(2, "0"), the hex would lose a char here
     * and the overall length-64 invariant would also fail; but
     * pin this substring so a regression has a clear message. */
    const hex = await sha256Hex("abc");
    expect(hex.slice(10, 12)).toBe("01");
  });
});
