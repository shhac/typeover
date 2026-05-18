import { describe, expect, it } from "vitest";
import {
  buildCurriculumTree,
  byOrder,
  exerciseHref,
  truncateIntro,
} from "./curriculum";

/*
 * Tests for the pure curriculum helpers that power /go and the dynamic
 * exercise route. Off-by-one ordering bugs or a missing `.slice()`
 * before `.sort()` would silently mis-display the curriculum — these
 * pin both behaviours.
 *
 * Astro's `CollectionEntry<T>` types are heavy and irrelevant to the
 * logic here. We cast minimal `{ id, data: { order, ... } }` shapes
 * to satisfy the type signatures — the functions never touch the
 * other CollectionEntry fields.
 */

const mod = (id: string, order: number) =>
  ({ id, data: { order } } as Parameters<typeof buildCurriculumTree>[0][number]);
const theme = (id: string, moduleId: string, order: number) =>
  ({ id, data: { order, moduleId } } as Parameters<
    typeof buildCurriculumTree
  >[1][number]);
const exercise = (id: string, themeId: string, order: number) =>
  ({ id, data: { order, themeId } } as Parameters<
    typeof buildCurriculumTree
  >[2][number]);

describe("byOrder", () => {
  it("sorts ascending by data.order", () => {
    const arr = [
      { id: "c", data: { order: 3 } },
      { id: "a", data: { order: 1 } },
      { id: "b", data: { order: 2 } },
    ];
    const sorted = [...arr].sort(byOrder);
    expect(sorted.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves original order for equal-`order` entries (stable)", () => {
    /* Array.prototype.sort is stable per ECMAScript 2019, so byOrder
     * relying on tiebreaker = original index is safe. */
    const arr = [
      { id: "first", data: { order: 5 } },
      { id: "second", data: { order: 5 } },
      { id: "third", data: { order: 5 } },
    ];
    expect([...arr].sort(byOrder).map((x) => x.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});

describe("buildCurriculumTree", () => {
  it("sorts modules by data.order", () => {
    const tree = buildCurriculumTree(
      [mod("m2", 2), mod("m1", 1), mod("m3", 3)],
      [],
      [],
    );
    expect(tree.map((n) => n.module.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("sorts themes within a module by data.order", () => {
    const tree = buildCurriculumTree(
      [mod("m1", 1)],
      [theme("t2", "m1", 2), theme("t1", "m1", 1), theme("t3", "m1", 3)],
      [],
    );
    expect(tree[0].themes.map((t) => t.theme.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("sorts exercises within a theme by data.order", () => {
    const tree = buildCurriculumTree(
      [mod("m1", 1)],
      [theme("t1", "m1", 1)],
      [exercise("e3", "t1", 3), exercise("e1", "t1", 1), exercise("e2", "t1", 2)],
    );
    expect(tree[0].themes[0].firstExercise?.id).toBe("e1");
    expect(tree[0].themes[0].exerciseCount).toBe(3);
  });

  it("module with no themes returns themes: []", () => {
    const tree = buildCurriculumTree([mod("m1", 1)], [], []);
    expect(tree[0].themes).toEqual([]);
  });

  it("theme with no exercises returns firstExercise=undefined, exerciseCount=0", () => {
    const tree = buildCurriculumTree(
      [mod("m1", 1)],
      [theme("t1", "m1", 1)],
      [],
    );
    expect(tree[0].themes[0].firstExercise).toBeUndefined();
    expect(tree[0].themes[0].exerciseCount).toBe(0);
  });

  it("does not mutate the input arrays (the `.slice()` guard)", () => {
    /* A regression that drops the .slice() before .sort() would
     * mutate the shared themesByModule.get(...) array, leading to
     * subtle dev-mode hydration bugs. Pin this. */
    const modules = [mod("m2", 2), mod("m1", 1)];
    const themes = [theme("t2", "m1", 2), theme("t1", "m1", 1)];
    const exercises = [
      exercise("e2", "t1", 2),
      exercise("e1", "t1", 1),
    ];
    const beforeM = modules.map((m) => m.id);
    const beforeT = themes.map((t) => t.id);
    const beforeE = exercises.map((e) => e.id);
    buildCurriculumTree(modules, themes, exercises);
    expect(modules.map((m) => m.id)).toEqual(beforeM);
    expect(themes.map((t) => t.id)).toEqual(beforeT);
    expect(exercises.map((e) => e.id)).toEqual(beforeE);
  });
});

describe("truncateIntro", () => {
  it("returns the input trimmed when under the limit", () => {
    expect(truncateIntro("  hello  ", 100)).toBe("hello");
  });

  it("returns the input trimmed when exactly at the limit", () => {
    const s = "x".repeat(180);
    expect(truncateIntro(s, 180)).toBe(s);
  });

  it("truncates to max chars and appends an ellipsis when over the limit", () => {
    const s = "x".repeat(200);
    const out = truncateIntro(s, 180);
    expect(out).toBe("x".repeat(180) + "…");
  });

  it("trims trailing whitespace before the ellipsis", () => {
    /* If the cut lands in the middle of a space run, the ellipsis
     * shouldn't be preceded by stray whitespace. */
    const s = "a".repeat(178) + "   bcdef";
    const out = truncateIntro(s, 180);
    expect(out).toBe("a".repeat(178) + "…");
  });

  it("uses 180 as the default max", () => {
    const s = "y".repeat(181);
    expect(truncateIntro(s)).toBe("y".repeat(180) + "…");
  });
});

describe("exerciseHref", () => {
  it("returns /go/<exerciseId>", () => {
    expect(exerciseHref("foundations/variables/01")).toBe(
      "/go/foundations/variables/01",
    );
  });
});
