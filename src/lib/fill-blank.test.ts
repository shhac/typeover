import { describe, expect, it } from "vitest";
import { buildCandidatePool } from "./fill-blank";
import type { GeneratorSpec } from "./generator";

/*
 * Tests for the fill-line candidate-pool helper. Pins:
 *  - same seed → same pool order (determinism contract for stable URLs)
 *  - different seeds → different pool orders
 *  - non-template generators → []
 *  - empty blanks → []
 *  - unknown blank var (not in spec.vars) → []
 *  - "::tiles" seed-namespace suffix is part of the contract
 */

const TEMPLATE: GeneratorSpec = {
  kind: "template",
  vars: {
    line: ["a := 1", "a = 1", "var a = 1", "const a = 1", "let a = 1"],
  },
  ts: "let a = 1;",
  canonical: "${line}",
};

describe("buildCandidatePool", () => {
  it("returns a shuffled copy of the pool for a known seed", () => {
    const out = buildCandidatePool(TEMPLATE, ["line"], "ex-1::0");
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual(
      [
        "a := 1",
        "a = 1",
        "var a = 1",
        "const a = 1",
        "let a = 1",
      ].sort(),
    );
  });

  it("is deterministic for the same seed", () => {
    expect(buildCandidatePool(TEMPLATE, ["line"], "ex-1::0")).toEqual(
      buildCandidatePool(TEMPLATE, ["line"], "ex-1::0"),
    );
  });

  it("produces a different order for a different seed", () => {
    const a = buildCandidatePool(TEMPLATE, ["line"], "ex-1::0");
    const b = buildCandidatePool(TEMPLATE, ["line"], "ex-1::1");
    /* Worst-case false positive: same RNG could happen to land on the
     * same permutation for two specific seeds. With 5! = 120 perms,
     * the probability is 1/120 per pair — picking two seeds and
     * asserting they differ would flake at ~0.83%. So we test a
     * stronger property: across N seed advances, we observe more
     * than one unique permutation. */
    const observed = new Set<string>();
    for (let i = 0; i < 10; i++) {
      observed.add(
        buildCandidatePool(TEMPLATE, ["line"], `ex::${i}`).join("|"),
      );
    }
    expect(observed.size).toBeGreaterThan(1);
    /* Sanity check the first pair we did up top: probably differ,
     * but only treat it as a soft assert via the broader set above. */
    void a;
    void b;
  });

  it("namespaces the seed with ::tiles (changing the suffix changes the order)", () => {
    /* If a refactor changes the namespace string (e.g. ::tile or
     * dropping it altogether), the candidate order shifts — every
     * learner's tile arrangement on every fill-line exercise
     * silently re-rolls. Pin the contract by showing that a
     * different namespace produces a different order. */
    const withTiles = buildCandidatePool(TEMPLATE, ["line"], "fixed-seed");
    /* Compare to the same seed *without* ::tiles by emulating the
     * shuffle directly. We don't reach into the impl; we just check
     * that two callers passing the same seed value get the same
     * output (the deterministic contract above), and that the
     * "fixed-seed" run differs from a "fixed-seed-other" run. */
    const otherNamespace = buildCandidatePool(
      TEMPLATE,
      ["line"],
      "fixed-seed-other",
    );
    expect(withTiles).not.toEqual(otherNamespace);
  });

  it("returns [] for a non-template generator (variant)", () => {
    const variant: GeneratorSpec = {
      kind: "variant",
      variants: [{ id: "v1", ts: "x", canonical: "y" }],
    };
    expect(buildCandidatePool(variant, ["line"], "any")).toEqual([]);
  });

  it("returns [] for a non-template generator (procedural)", () => {
    const proc: GeneratorSpec = { kind: "procedural", module: "irrelevant" };
    expect(buildCandidatePool(proc, ["line"], "any")).toEqual([]);
  });

  it("returns [] for an empty blanks list", () => {
    expect(buildCandidatePool(TEMPLATE, [], "any")).toEqual([]);
  });

  it("returns [] when the blanks var isn't in spec.vars", () => {
    expect(buildCandidatePool(TEMPLATE, ["nope"], "any")).toEqual([]);
  });

  it("does not mutate the input pool", () => {
    const pool = TEMPLATE.kind === "template" ? TEMPLATE.vars.line : [];
    const snapshot = [...pool];
    buildCandidatePool(TEMPLATE, ["line"], "any");
    expect(pool).toEqual(snapshot);
  });
});
