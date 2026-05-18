import { describe, expect, it } from "vitest";
import { safeParseProgress } from "./progress";

/*
 * Pure unit tests for the parse/validate path. These previously had
 * to round-trip through localStorage in progress.test.ts; now they
 * test the function directly so a future Zod swap (task #37) lands
 * with no test reshuffling.
 */

describe("safeParseProgress", () => {
  it("returns an empty progress for null input", () => {
    const p = safeParseProgress(null);
    expect(p.version).toBe(1);
    expect(p.exercises).toEqual({});
    expect(p.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns empty for malformed JSON", () => {
    expect(safeParseProgress("{not json").exercises).toEqual({});
  });

  it("returns empty for a future-version payload", () => {
    const future = JSON.stringify({
      version: 2,
      startedAt: "2026-01-01T00:00:00.000Z",
      exercises: {},
    });
    expect(safeParseProgress(future).exercises).toEqual({});
  });

  it("returns empty for a v1 payload missing the exercises field (the partial-write guard)", () => {
    /* Pinned per design-docs/12 P1: a v1 blob without `exercises`
     * would previously crash at exerciseSlot when a recorder ran.
     * The harden now coerces it to empty(). */
    const partial = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
    });
    expect(safeParseProgress(partial).exercises).toEqual({});
  });

  it("returns empty when exercises is a non-object (e.g. null or array)", () => {
    const nullExercises = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      exercises: null,
    });
    expect(safeParseProgress(nullExercises).exercises).toEqual({});
  });

  it("round-trips a well-formed v1 payload unchanged", () => {
    const ok = {
      version: 1 as const,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      exercises: {
        "ex-1": {
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-02T00:00:00.000Z",
          instancesSeen: 3,
          instancesPassed: 1,
          instancesFailed: 0,
          hintsUsedTotal: 2,
        },
      },
    };
    expect(safeParseProgress(JSON.stringify(ok))).toEqual(ok);
  });
});
