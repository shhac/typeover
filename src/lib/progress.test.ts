import { afterEach, describe, expect, it } from "vitest";
import {
  getExerciseProgress,
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

describe("progress storage — corrupt-blob backup (task #37)", () => {
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
