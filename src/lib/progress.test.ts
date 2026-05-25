import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aggregateModuleProgress,
  findNextUnfinishedExerciseId,
  getExerciseProgress,
  lastTouchedExerciseId,
  recordHintUsed,
  recordInstanceFailed,
  recordInstancePassed,
  recordInstanceSeen,
} from "./progress";

const STORAGE_KEY = "typeover:progress";

/** Read whatever the module wrote to localStorage. Use this to assert
 *  on the byte-level shape that downstream readers (and future
 *  format-version migrations) will see. */
const readRaw = (): unknown => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
};

type RawProgress = {
  version: number;
  startedAt: string;
  lastSeenAt: string;
  exercises: Record<
    string,
    {
      firstSeenAt: string;
      lastSeenAt: string;
      instancesSeen: number;
      instancesPassed: number;
      instancesFailed: number;
      hintsUsedTotal: number;
    }
  >;
};

describe("progress storage — SSR path", () => {
  /* Restored automatically by vitest.setup.ts's beforeEach. */
  afterEach(() => {
    /* no-op — beforeEach re-creates the shim each test */
  });

  it("recorders are no-ops and do not throw when localStorage is undefined", () => {
    /* delete so `typeof localStorage === "undefined"` matches */
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => recordInstanceSeen("ex-1")).not.toThrow();
    expect(() => recordInstancePassed("ex-1")).not.toThrow();
    expect(() => recordInstanceFailed("ex-1")).not.toThrow();
    expect(() => recordHintUsed("ex-1")).not.toThrow();
  });

  it("getExerciseProgress returns a fresh slot when localStorage is undefined", () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    const slot = getExerciseProgress("ex-1");
    expect(slot.instancesSeen).toBe(0);
    expect(slot.instancesPassed).toBe(0);
    expect(slot.instancesFailed).toBe(0);
    expect(slot.hintsUsedTotal).toBe(0);
  });
});

describe("progress storage — malformed inputs", () => {
  it("read returns a clean slot when storage contains malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const slot = getExerciseProgress("ex-1");
    expect(slot.instancesSeen).toBe(0);
  });

  it("read returns a clean slot when storage contains a future-version payload", () => {
    /* version 2 is silently dropped today — pin this so any change is
     * deliberate (task #37 may revisit). */
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, startedAt: "2026-01-01T00:00:00.000Z", exercises: {} }),
    );
    const slot = getExerciseProgress("ex-1");
    expect(slot.instancesSeen).toBe(0);
  });
});

describe("progress storage — corrupt-blob backup", () => {
  /* Pinned per design-docs/99 — when a non-null payload fails to
   * parse, we copy the raw value to typeover:progress:corrupt-<ts>
   * before resetting, so a future migration / forensic pass can
   * recover a learner's history instead of silently destroying it. */

  const backupKeys = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith("typeover:progress:corrupt-")) keys.push(k);
    }
    return keys;
  };

  it("backs up the raw value when JSON is invalid", () => {
    const raw = "{not json";
    localStorage.setItem(STORAGE_KEY, raw);
    getExerciseProgress("ex-1");
    const keys = backupKeys();
    expect(keys).toHaveLength(1);
    expect(localStorage.getItem(keys[0]!)).toBe(raw);
  });

  it("backs up the raw value when the schema rejects a corrupt slot", () => {
    const raw = JSON.stringify({
      version: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      exercises: { "ex-1": null },
    });
    localStorage.setItem(STORAGE_KEY, raw);
    getExerciseProgress("ex-1");
    const keys = backupKeys();
    expect(keys).toHaveLength(1);
    expect(localStorage.getItem(keys[0]!)).toBe(raw);
  });

  it("does NOT create a backup when storage is empty", () => {
    /* fresh learner: no key at all → no backup needed */
    getExerciseProgress("ex-1");
    expect(backupKeys()).toHaveLength(0);
  });

  it("does NOT create a backup on the SSR path (no localStorage)", () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => getExerciseProgress("ex-1")).not.toThrow();
    /* no localStorage to inspect, but the recorder also must not throw */
  });

  it("reads share a single JSON.parse across one tick", () => {
    /* design-docs/18 F-3 + design-docs/19 F-4. Before the cache
     * landed, ModuleCompleteCard fired ~116 reads per render,
     * each JSON.parse-ing + Zod-validating the same blob.
     * Now the cache holds a single parse for the lifetime of a
     * write(); 100 successive getExerciseProgress calls hit
     * JSON.parse at most once. */
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        startedAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        exercises: {},
      }),
    );
    const parseSpy = vi.spyOn(JSON, "parse");
    const before = parseSpy.mock.calls.length;
    for (let i = 0; i < 100; i += 1) getExerciseProgress(`ex-${i}`);
    const parseCalls = parseSpy.mock.calls.length - before;
    parseSpy.mockRestore();
    expect(parseCalls).toBeLessThanOrEqual(1);
  });

  it("getExerciseProgress is pure (does not create persisted slots on read)", () => {
    /* Before this fix `getExerciseProgress` went through
     * exerciseSlot, which mutated the in-memory parsed Progress
     * to insert a fresh slot. Now an un-touched id returns a
     * fresh empty slot but the underlying Progress isn't
     * mutated, so storage stays empty until a real recorder
     * (recordInstanceSeen / etc.) writes. */
    getExerciseProgress("never-touched");
    const raw = localStorage.getItem(STORAGE_KEY);
    /* No storage write happened — the key is still null. */
    expect(raw).toBeNull();
  });

  it("backs up exactly once even across many reads of the same corrupt blob", () => {
    /* design-docs/19 F-1 — the unbounded-leak fix. A corrupt blob
     * triggers ONE backup, then the main key is overwritten with an
     * empty Progress, so subsequent reads return cleanly with no
     * more backup writes. Without this, ModuleCompleteCard's
     * O(themes × exercises) reads would mint 100+ backup keys per
     * page load. */
    localStorage.setItem(STORAGE_KEY, "{not json");
    for (let i = 0; i < 50; i += 1) getExerciseProgress(`ex-${i}`);
    expect(backupKeys()).toHaveLength(1);
    /* And the main key is now an empty Progress, not the corrupt
     * blob. */
    const main = localStorage.getItem(STORAGE_KEY);
    expect(main).not.toBeNull();
    expect(main).not.toContain("not json");
    expect(JSON.parse(main!).version).toBe(1);
  });

  it("writes the backup key BEFORE resetting the main key (ordering guarantee)", () => {
    /* handleCorruptProgress must persist the backup before
     * overwriting the main key. If the write order were reversed,
     * a crash between the two setItem calls would lose the corrupt
     * blob with no backup. Pin the ordering via a setItem spy. */
    const spy = vi.spyOn(localStorage, "setItem");
    localStorage.setItem(STORAGE_KEY, "{not json");
    spy.mockClear();

    getExerciseProgress("ex-1");

    const calls = spy.mock.calls.map(([key]) => key as string);
    const backupIdx = calls.findIndex((k) => k.startsWith("typeover:progress:corrupt-"));
    const mainIdx = calls.findIndex((k) => k === STORAGE_KEY);
    expect(backupIdx).toBeGreaterThanOrEqual(0);
    expect(mainIdx).toBeGreaterThanOrEqual(0);
    expect(backupIdx).toBeLessThan(mainIdx);
    spy.mockRestore();
  });
});

describe("progress storage — recorder semantics", () => {
  it("recordInstanceSeen creates the slot with firstSeenAt set", () => {
    recordInstanceSeen("ex-1");
    const slot = getExerciseProgress("ex-1");
    expect(slot.instancesSeen).toBe(1);
    expect(slot.firstSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(slot.lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("calling recordInstanceSeen twice preserves firstSeenAt and increments instancesSeen", () => {
    recordInstanceSeen("ex-1");
    const first = getExerciseProgress("ex-1").firstSeenAt;
    recordInstanceSeen("ex-1");
    const after = getExerciseProgress("ex-1");
    expect(after.firstSeenAt).toBe(first);
    expect(after.instancesSeen).toBe(2);
  });

  it("seen + pass + seen produces instancesSeen=2, instancesPassed=1", () => {
    recordInstanceSeen("ex-1");
    recordInstancePassed("ex-1");
    recordInstanceSeen("ex-1");
    const slot = getExerciseProgress("ex-1");
    expect(slot.instancesSeen).toBe(2);
    expect(slot.instancesPassed).toBe(1);
  });

  it("recordHintUsed advances lastSeenAt (the iter-1 latent-bug regression guard)", () => {
    recordInstanceSeen("ex-1");
    const before = getExerciseProgress("ex-1").lastSeenAt;
    /* Force at least 1 ms gap so the ISO timestamp differs */
    const start = Date.now();
    while (Date.now() === start) {
      /* spin briefly */
    }
    recordHintUsed("ex-1");
    const after = getExerciseProgress("ex-1").lastSeenAt;
    expect(after > before).toBe(true);
  });
});

describe("progress storage — single-now invariant (iter-18)", () => {
  it("after any record*, slot.lastSeenAt === progress.lastSeenAt (byte-equal)", () => {
    /* Pins commit 73bdbdc — bumpExercise is the single timestamp
     * authority. Catches a future "convenient" extra now() call in
     * write() or a recorder. */
    recordInstanceSeen("ex-1");
    const raw = readRaw() as RawProgress;
    expect(raw.exercises["ex-1"]?.lastSeenAt).toBe(raw.lastSeenAt);

    recordHintUsed("ex-1");
    const raw2 = readRaw() as RawProgress;
    expect(raw2.exercises["ex-1"]?.lastSeenAt).toBe(raw2.lastSeenAt);

    recordInstancePassed("ex-1");
    const raw3 = readRaw() as RawProgress;
    expect(raw3.exercises["ex-1"]?.lastSeenAt).toBe(raw3.lastSeenAt);
  });

  it("non-mutated slot's lastSeenAt does NOT match progress.lastSeenAt after another exercise is bumped", () => {
    /* Sanity check that the invariant above is non-vacuous: bumping
     * ex-2 advances p.lastSeenAt but leaves ex-1's slot timestamp
     * untouched (no global slap-on-every-write). */
    recordInstanceSeen("ex-1");
    const start = Date.now();
    while (Date.now() === start) {
      /* spin briefly so the ISO timestamps differ */
    }
    recordInstanceSeen("ex-2");
    const raw = readRaw() as RawProgress;
    expect(raw.exercises["ex-1"]?.lastSeenAt).not.toBe(raw.lastSeenAt);
    expect(raw.exercises["ex-2"]?.lastSeenAt).toBe(raw.lastSeenAt);
  });
});

describe("progress storage — read-existing-blob round-trip", () => {
  /* Pinned by the code-structure pass: existing tests all start from
   * empty storage. A future Zod `.strict()` or `.readonly()` tightening
   * (task #37 follow-ups) could break the `read() → mutate → write()`
   * cycle silently — every recorder would fail to in-place-mutate the
   * parsed value. Seeding storage with a non-empty blob and asserting
   * the round-trip catches that regression. */

  const seeded = {
    version: 1,
    startedAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-02T00:00:00.000Z",
    exercises: {
      "ex-1": {
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-02T00:00:00.000Z",
        instancesSeen: 5,
        instancesPassed: 3,
        instancesFailed: 1,
        hintsUsedTotal: 2,
      },
      "ex-2": {
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-02T00:00:00.000Z",
        instancesSeen: 7,
        instancesPassed: 4,
        instancesFailed: 0,
        hintsUsedTotal: 1,
      },
    },
  };

  it("recordInstanceSeen on a pre-seeded blob increments ex-1, leaves ex-2 untouched", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    recordInstanceSeen("ex-1");

    const after1 = getExerciseProgress("ex-1");
    expect(after1.instancesSeen).toBe(6);
    expect(after1.instancesPassed).toBe(3);
    expect(after1.instancesFailed).toBe(1);
    expect(after1.hintsUsedTotal).toBe(2);
    expect(after1.firstSeenAt).toBe("2026-01-01T00:00:00.000Z");
    expect(after1.lastSeenAt > "2026-01-02T00:00:00.000Z").toBe(true);

    const after2 = getExerciseProgress("ex-2");
    expect(after2.instancesSeen).toBe(7);
    expect(after2.instancesPassed).toBe(4);
    expect(after2.lastSeenAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("progress.lastSeenAt advances on a pre-seeded blob mutation", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    recordInstanceSeen("ex-1");
    const raw = readRaw() as RawProgress;
    expect(raw.lastSeenAt > "2026-01-02T00:00:00.000Z").toBe(true);
  });
});

describe("aggregateModuleProgress", () => {
  /* Pure module-level aggregate used by ModuleCompleteCard. Lives
   * here so the four-let onMount loop in the card can be replaced
   * with a one-liner that's testable without a Solid render harness.
   * design-docs/20 lens-1 + lens-3. */

  const THEMES = [
    { exerciseIds: ["m/t1/01", "m/t1/02"] },
    { exerciseIds: ["m/t2/01", "m/t2/02", "m/t2/03"] },
  ];

  it("returns all-zero for a fresh blob", () => {
    const result = aggregateModuleProgress(THEMES);
    expect(result).toEqual({
      exercisesPassed: 0,
      totalExercises: 5,
      themesComplete: 0,
      hintsUsedTotal: 0,
    });
  });

  it("counts passed across themes, hints across exercises, themesComplete only when ALL theme exercises pass", () => {
    recordInstancePassed("m/t1/01");
    recordInstancePassed("m/t1/02"); /* theme 1 fully passed */
    recordInstancePassed("m/t2/01"); /* theme 2 partially passed */
    recordHintUsed("m/t1/01");
    recordHintUsed("m/t1/01");
    recordHintUsed("m/t2/03");
    expect(aggregateModuleProgress(THEMES)).toEqual({
      exercisesPassed: 3,
      totalExercises: 5,
      themesComplete: 1,
      hintsUsedTotal: 3,
    });
  });

  it("an empty theme is NOT counted complete (no false-credit for stubs)", () => {
    /* Mirrors summarizeTheme's contract — see design-docs/19 F-23
     * and the helper's own comment. */
    expect(aggregateModuleProgress([{ exerciseIds: [] }])).toEqual({
      exercisesPassed: 0,
      totalExercises: 0,
      themesComplete: 0,
      hintsUsedTotal: 0,
    });
  });
});

describe("findNextUnfinishedExerciseId", () => {
  const THEMES = [{ exerciseIds: ["m/t1/01", "m/t1/02"] }, { exerciseIds: ["m/t2/01", "m/t2/02"] }];

  it("returns the first id when nothing is passed", () => {
    expect(findNextUnfinishedExerciseId(THEMES)).toBe("m/t1/01");
  });

  it("skips passed exercises and returns the next unfinished, traversing themes in order", () => {
    recordInstancePassed("m/t1/01");
    expect(findNextUnfinishedExerciseId(THEMES)).toBe("m/t1/02");
    recordInstancePassed("m/t1/02");
    expect(findNextUnfinishedExerciseId(THEMES)).toBe("m/t2/01");
  });

  it("returns null when every exercise across every theme is passed", () => {
    recordInstancePassed("m/t1/01");
    recordInstancePassed("m/t1/02");
    recordInstancePassed("m/t2/01");
    recordInstancePassed("m/t2/02");
    expect(findNextUnfinishedExerciseId(THEMES)).toBeNull();
  });
});

describe("lastTouchedExerciseId", () => {
  it("returns null when no progress is recorded", () => {
    expect(lastTouchedExerciseId()).toBeNull();
  });

  it("returns the only recorded id when exactly one exists", () => {
    recordInstanceSeen("foundations/loops/03");
    expect(lastTouchedExerciseId()).toBe("foundations/loops/03");
  });

  it("returns the most-recently-touched id across multiple exercises", async () => {
    recordInstanceSeen("foundations/variables/01");
    /* Wait a beat so ISO timestamps differ between calls.
     * `recordInstanceSeen` stamps `lastSeenAt = new Date().toISOString()`;
     * back-to-back calls in the same ms would otherwise tie. */
    await new Promise((r) => setTimeout(r, 5));
    recordInstanceSeen("foundations/loops/05");
    expect(lastTouchedExerciseId()).toBe("foundations/loops/05");

    /* A later touch on the older id moves it back to the front. */
    await new Promise((r) => setTimeout(r, 5));
    recordInstancePassed("foundations/variables/01");
    expect(lastTouchedExerciseId()).toBe("foundations/variables/01");
  });
});

describe("legacy ID migration (lang prefix)", () => {
  /* Pre-multi-language IDs were `<module>/<theme>/<index>` — three
   * segments. After the Zig-track reorg they became
   * `<lang>/<module>/<theme>/<index>` (four segments). Existing
   * learners' localStorage carries the old shape; the first read on
   * a fresh tab silently rewrites every legacy key under a `go/`
   * prefix and persists. */

  const seedLegacy = (exercises: RawProgress["exercises"]) => {
    const blob: RawProgress = {
      version: 1,
      startedAt: "2025-01-01T00:00:00.000Z",
      lastSeenAt: "2025-01-01T00:00:00.000Z",
      exercises,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  };

  const slot = (lastSeenAt: string) => ({
    firstSeenAt: "2025-01-01T00:00:00.000Z",
    lastSeenAt,
    instancesSeen: 1,
    instancesPassed: 1,
    instancesFailed: 0,
    hintsUsedTotal: 0,
  });

  it("rewrites a 3-segment id to a `go/`-prefixed 4-segment id", () => {
    seedLegacy({ "foundations/variables/01": slot("2025-02-01T00:00:00.000Z") });
    /* First read triggers the migration + write-back. */
    const ex = getExerciseProgress("go/foundations/variables/01");
    expect(ex.instancesPassed).toBe(1);
    const persisted = readRaw() as RawProgress;
    expect(persisted.exercises["go/foundations/variables/01"]).toBeDefined();
    expect(persisted.exercises["foundations/variables/01"]).toBeUndefined();
  });

  it("leaves modern 4-segment ids untouched", () => {
    seedLegacy({ "go/foundations/variables/01": slot("2025-02-01T00:00:00.000Z") });
    const ex = getExerciseProgress("go/foundations/variables/01");
    expect(ex.instancesPassed).toBe(1);
    const persisted = readRaw() as RawProgress;
    /* Modern ids stay as-is; no spurious double-prefix. */
    expect(persisted.exercises["go/foundations/variables/01"]).toBeDefined();
    expect(persisted.exercises["go/go/foundations/variables/01"]).toBeUndefined();
  });

  it("prefers the modern entry when both shapes exist for the same exercise", () => {
    seedLegacy({
      "foundations/variables/01": slot("2024-01-01T00:00:00.000Z"),
      "go/foundations/variables/01": slot("2025-02-01T00:00:00.000Z"),
    });
    const ex = getExerciseProgress("go/foundations/variables/01");
    /* Both legacy + modern carry instancesPassed: 1; the modern
     * timestamp wins, and the legacy key is dropped. */
    expect(ex.lastSeenAt).toBe("2025-02-01T00:00:00.000Z");
    const persisted = readRaw() as RawProgress;
    expect(persisted.exercises["foundations/variables/01"]).toBeUndefined();
  });

  it("ignores ids with the wrong segment count", () => {
    seedLegacy({
      "weird-bare-key": slot("2025-02-01T00:00:00.000Z"),
      "go/foundations/variables/01": slot("2025-02-01T00:00:00.000Z"),
    });
    /* Trigger a read. */
    getExerciseProgress("go/foundations/variables/01");
    const persisted = readRaw() as RawProgress;
    /* The bare id is meaningless under either schema; leave it alone
     * so a future migration can decide what to do with it. */
    expect(persisted.exercises["weird-bare-key"]).toBeDefined();
  });

  it("rewrites every legacy id in a single pass", () => {
    /* Pin the for-of loop's "process every entry" contract. A
     * regression that short-circuits after the first migration
     * would silently leave the rest of the learner's progress
     * stranded. */
    seedLegacy({
      "foundations/variables/01": slot("2025-02-01T00:00:00.000Z"),
      "foundations/loops/03": slot("2025-02-02T00:00:00.000Z"),
      "types/structs/05": slot("2025-02-03T00:00:00.000Z"),
    });
    /* One read triggers one migration pass. */
    getExerciseProgress("go/foundations/variables/01");
    const persisted = readRaw() as RawProgress;
    expect(persisted.exercises["go/foundations/variables/01"]).toBeDefined();
    expect(persisted.exercises["go/foundations/loops/03"]).toBeDefined();
    expect(persisted.exercises["go/types/structs/05"]).toBeDefined();
    /* All three legacy keys are gone. */
    expect(persisted.exercises["foundations/variables/01"]).toBeUndefined();
    expect(persisted.exercises["foundations/loops/03"]).toBeUndefined();
    expect(persisted.exercises["types/structs/05"]).toBeUndefined();
  });

  it("migration is one-shot — a second read does not re-write", () => {
    /* Pin the "migration runs exactly once per cache-cold session"
     * contract. After the first read writes the rewritten blob
     * back, subsequent reads must hit the cached migrated value
     * and skip the migration branch entirely. A regression that
     * re-runs the migration on every read would re-`setItem` and
     * thrash any listener subscribed to the change event. */
    seedLegacy({ "foundations/variables/01": slot("2025-02-01T00:00:00.000Z") });
    /* Spy on setItem to count the writes. The first read should
     * fire exactly one write (the migration). Three subsequent
     * reads should fire none. */
    const spy = vi.spyOn(localStorage, "setItem");
    getExerciseProgress("go/foundations/variables/01");
    const writesAfterMigration = spy.mock.calls.length;
    expect(writesAfterMigration).toBeGreaterThanOrEqual(1);
    getExerciseProgress("go/foundations/variables/01");
    getExerciseProgress("go/foundations/loops/05");
    getExerciseProgress("go/types/structs/02");
    /* No additional writes from re-reads. */
    expect(spy.mock.calls.length).toBe(writesAfterMigration);
    spy.mockRestore();
  });

  it("preserves the top-level lastSeenAt — migration is a key-rewrite, not a touch", () => {
    /* The Progress envelope has its own `lastSeenAt` separate from
     * the per-exercise slots. The migration's job is to rewrite
     * exercise keys; it must not stamp the envelope, otherwise
     * `lastTouchedExerciseId` and any time-based analytics would
     * see a phantom "session" at migration time. */
    const envelopeTs = "2024-12-31T23:59:59.000Z";
    const blob: RawProgress = {
      version: 1,
      startedAt: "2024-01-01T00:00:00.000Z",
      lastSeenAt: envelopeTs,
      exercises: { "foundations/variables/01": slot("2025-02-01T00:00:00.000Z") },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    getExerciseProgress("go/foundations/variables/01");
    const persisted = readRaw() as RawProgress;
    expect(persisted.lastSeenAt).toBe(envelopeTs);
    expect(persisted.startedAt).toBe("2024-01-01T00:00:00.000Z");
  });
});
