import { describe, expect, it } from "vitest";
import { migrateLegacyIds } from "./progress-migrations";
import type { ExerciseProgress, Progress } from "./progress-schema";

/*
 * Direct tests for `migrateLegacyIds` covering every branch of the
 * `needsLegacyPrefix` predicate. The predicate is private; we drive
 * it through the public migration entry point with input IDs shaped
 * to trip each branch.
 *
 * Why this matters: the migration runs on every read() of the
 * Progress blob from localStorage. A regression in any rejection
 * branch (wrong segment count accepted as legacy, empty-segment
 * "corrupt" id silently rewritten, lang-prefixed id double-prefixed)
 * would corrupt the learner's progress on first read after deploy —
 * and the corruption is silent: nothing throws, the keys just stop
 * matching exercise IDs and the UI shows fresh-visitor state.
 */

const slot = (overrides: Partial<ExerciseProgress> = {}): ExerciseProgress => ({
  instancesSeen: 1,
  instancesPassed: 0,
  instancesFailed: 0,
  lastTouchedAt: 1_700_000_000_000,
  ...overrides,
});

const progressOf = (entries: Record<string, ExerciseProgress>): Progress => ({
  version: 4,
  exercises: entries,
});

describe("migrateLegacyIds — happy path", () => {
  it("rewrites 3-segment ids to go-prefixed 4-segment ids", () => {
    const input = progressOf({
      "foundations/variables/01": slot({ instancesSeen: 3 }),
      "foundations/variables/02": slot({ instancesPassed: 1 }),
    });
    const out = migrateLegacyIds(input);
    expect(out).not.toBe(input);
    expect(Object.keys(out.exercises).sort()).toEqual([
      "go/foundations/variables/01",
      "go/foundations/variables/02",
    ]);
    expect(out.exercises["go/foundations/variables/01"]?.instancesSeen).toBe(3);
  });

  it("returns the SAME reference when nothing needs migration", () => {
    /* Reference equality is the signal the caller uses to skip the
     * localStorage write-back. A regression that always returned a
     * new object would burn a write on every read. */
    const input = progressOf({
      "go/foundations/variables/01": slot(),
      "zig/basics/hello-and-output/03": slot(),
    });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("conflict-resolves to the modern entry when both legacy and modern exist", () => {
    /* Legacy: foundations/variables/01 (3-seg). Modern: go/foundations/
     * variables/01 (4-seg, already migrated). The modern record wins
     * — the legacy one is dropped. Per the doc comment, the modern
     * record was almost certainly written more recently. */
    const input = progressOf({
      "foundations/variables/01": slot({ instancesPassed: 0 }),
      "go/foundations/variables/01": slot({ instancesPassed: 5 }),
    });
    const out = migrateLegacyIds(input);
    expect(Object.keys(out.exercises)).toEqual(["go/foundations/variables/01"]);
    expect(out.exercises["go/foundations/variables/01"]?.instancesPassed).toBe(5);
  });
});

describe("migrateLegacyIds — rejection branches (the needsLegacyPrefix matrix)", () => {
  /* Each case carries one id shape that needsLegacyPrefix should
   * REJECT — the entry must come through the migration unchanged.
   * The progress map's reference is checked to ensure no copy is
   * made when there's nothing to do. */

  it("leaves 4-segment ids untouched (already modern, not legacy)", () => {
    const input = progressOf({ "go/foundations/variables/01": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves 2-segment ids untouched (corrupt-ish; nothing to migrate to)", () => {
    /* 2-segment ids would slip past a length-3 check but the predicate
     * rejects anything that isn't exactly 3 segments. They stay as-is
     * rather than being rewritten to a garbage path. */
    const input = progressOf({ "foundations/variables": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves 5+ segment ids untouched", () => {
    const input = progressOf({ "go/foundations/variables/01/extra": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves ids with empty middle segments untouched (corrupt, not legacy)", () => {
    /* The doc-comment specifically calls out "empty segments are
     * corrupt rather than legacy" — silently rewriting them to
     * `go//variables/01` would produce broken routes. */
    const input = progressOf({ "foundations//01": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves ids with an empty leading segment untouched", () => {
    const input = progressOf({ "/variables/01": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves ids with an empty trailing segment untouched", () => {
    const input = progressOf({ "foundations/variables/": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves already-zig-prefixed 3-segment ids untouched (malformed but not legacy Go)", () => {
    /* A 3-segment id starting with `zig/` is malformed (would expect
     * 4 segments after the lang slug) but it's NOT legacy Go — the
     * predicate's defensive lang-slug check rejects it so it doesn't
     * become `go/zig/...`. */
    const input = progressOf({ "zig/foundations/01": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves already-rust-prefixed 3-segment ids untouched", () => {
    const input = progressOf({ "rust/foundations/01": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });

  it("leaves already-go-prefixed 3-segment ids untouched", () => {
    /* Same defence as the zig/rust case — a 3-segment id starting
     * with `go/` would otherwise be rewritten to `go/go/...`, an
     * obvious corruption. */
    const input = progressOf({ "go/foundations/01": slot() });
    expect(migrateLegacyIds(input)).toBe(input);
  });
});

describe("migrateLegacyIds — mixed-shape input", () => {
  it("migrates legacy ids and leaves non-legacy ones in place", () => {
    /* Realistic state mid-migration: some IDs migrated, some not.
     * The function must rewrite only the legacy ones and leave the
     * modern + corrupt entries untouched in the same single pass. */
    const input = progressOf({
      "foundations/variables/01": slot({ instancesSeen: 1 }), // legacy → migrate
      "go/foundations/variables/02": slot({ instancesSeen: 2 }), // modern → keep
      "zig/basics/hello-and-output/01": slot({ instancesSeen: 3 }), // modern → keep
      "foundations//02": slot({ instancesSeen: 4 }), // corrupt → leave alone
    });
    const out = migrateLegacyIds(input);
    expect(Object.keys(out.exercises).sort()).toEqual([
      "foundations//02",
      "go/foundations/variables/01",
      "go/foundations/variables/02",
      "zig/basics/hello-and-output/01",
    ]);
    expect(out.exercises["go/foundations/variables/01"]?.instancesSeen).toBe(1);
    expect(out.exercises["foundations//02"]?.instancesSeen).toBe(4);
  });
});
