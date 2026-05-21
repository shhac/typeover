import { describe, expect, it } from "vitest";
import { safeParseProgress } from "./progress";

/*
 * Pure unit tests for the parse/validate path. These previously had
 * to round-trip through localStorage in progress.test.ts; now they
 * test the function directly. Parser is Zod-backed (see
 * `ProgressSchema` in progress.ts) — corrupt or shape-mismatched
 * blobs route through `read()` to a timestamped backup key.
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

  it("returns empty when any slot is null", () => {
    /* A future Zod migration will surface this with a typed error;
     * until then, dropping to empty() prevents the downstream
     * `null.instancesSeen` crash in bumpExercise. */
    const corrupt = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      exercises: { "ex-1": null },
    });
    expect(safeParseProgress(corrupt).exercises).toEqual({});
  });

  it("returns empty when a slot has a string counter (NaN risk)", () => {
    /* Without the guard, `"five" + 1 === "five1"` → NaN once it
     * touches a downstream calculation, and that NaN persists. */
    const corrupt = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      exercises: {
        "ex-1": {
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          instancesSeen: "five",
          instancesPassed: 1,
          instancesFailed: 0,
          hintsUsedTotal: 0,
        },
      },
    });
    expect(safeParseProgress(corrupt).exercises).toEqual({});
  });

  it("returns empty when a slot is missing firstSeenAt", () => {
    const corrupt = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      exercises: {
        "ex-1": {
          /* firstSeenAt deliberately absent */
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          instancesSeen: 0,
          instancesPassed: 0,
          instancesFailed: 0,
          hintsUsedTotal: 0,
        },
      },
    });
    expect(safeParseProgress(corrupt).exercises).toEqual({});
  });

  it("returns empty when a slot's counter is NaN", () => {
    const corrupt = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      exercises: {
        "ex-1": {
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          instancesSeen: Number.NaN,
          instancesPassed: 0,
          instancesFailed: 0,
          hintsUsedTotal: 0,
        },
      },
    });
    /* JSON.stringify writes NaN as null; that re-parses as null
     * which is neither finite nor a number — the guard fires. */
    expect(safeParseProgress(corrupt).exercises).toEqual({});
  });

  it("drops the whole blob if any one slot is corrupt (even if others are valid)", () => {
    const corrupt = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      exercises: {
        "ex-1": {
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          instancesSeen: 5,
          instancesPassed: 2,
          instancesFailed: 1,
          hintsUsedTotal: 3,
        },
        "ex-2": null,
      },
    });
    expect(safeParseProgress(corrupt).exercises).toEqual({});
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
