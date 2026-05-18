import { describe, expect, it } from "vitest";
import { mulberry32, pickFrom, rngFromSeed, shuffle, xmur3 } from "./seed";

describe("xmur3", () => {
  it("hashes the empty string without throwing and returns a usable PRNG seed function", () => {
    const fn = xmur3("");
    expect(typeof fn()).toBe("number");
  });

  it("produces the same hash output for the same input across calls", () => {
    const a = xmur3("typeover");
    const b = xmur3("typeover");
    expect(a()).toBe(b());
  });

  it("produces a different first hash for a different input", () => {
    const a = xmur3("alpha")();
    const b = xmur3("beta")();
    expect(a).not.toBe(b);
  });
});

describe("mulberry32", () => {
  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rngFromSeed (golden)", () => {
  /* Golden test. This is the determinism contract that powers
   * "Try again with the same instance" and stable exercise URLs.
   * If any of these numbers change, every learner's attempt-0 instance
   * silently re-rolls — so we lock them down by snapshot. */
  it("produces a stable first-5 sequence for a known string seed", () => {
    const rng = rngFromSeed("foundations/variables/01::0");
    const seq = [rng(), rng(), rng(), rng(), rng()];
    /* Snapshot via toMatchInlineSnapshot-style literal — assert exact
     * floats. The harness here is `expect(seq).toEqual(<...>)` so an
     * accidental algorithm change will fail loudly with both values. */
    expect(seq).toMatchSnapshot();
  });

  it("produces a different first value for a different seed", () => {
    const a = rngFromSeed("a")();
    const b = rngFromSeed("b")();
    expect(a).not.toBe(b);
  });
});

describe("pickFrom", () => {
  it("returns an element from the array", () => {
    const rng = mulberry32(7);
    const picks = ["x", "y", "z"] as const;
    const picked = pickFrom(rng, picks);
    expect(picks).toContain(picked);
  });

  it("is deterministic for a given rng state", () => {
    const itemsA = ["a", "b", "c", "d"];
    const itemsB = ["a", "b", "c", "d"];
    expect(pickFrom(mulberry32(3), itemsA)).toBe(pickFrom(mulberry32(3), itemsB));
  });

  it("throws on empty input", () => {
    expect(() => pickFrom(mulberry32(0), [])).toThrow(/empty/i);
  });
});

describe("shuffle", () => {
  it("is deterministic for a given rng state", () => {
    expect(shuffle(mulberry32(11), [1, 2, 3, 4, 5])).toEqual(
      shuffle(mulberry32(11), [1, 2, 3, 4, 5]),
    );
  });

  it("returns the same length and same elements (as a set)", () => {
    const input = ["a", "b", "c", "d", "e"];
    const out = shuffle(mulberry32(9), input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort()).toEqual([...input].sort());
  });

  it("returns [] for empty input", () => {
    expect(shuffle(mulberry32(0), [])).toEqual([]);
  });

  it("returns the same single element for a length-1 array", () => {
    expect(shuffle(mulberry32(0), ["only"])).toEqual(["only"]);
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    shuffle(mulberry32(0), input);
    expect(input).toEqual(snapshot);
  });
});
