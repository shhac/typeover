import { describe, expect, it } from "vitest";
import {
  EXERCISE_TYPE_LABELS,
  buildCurriculumTree,
  byOrder,
  exerciseHref,
  findAdjacentExercises,
  loadExerciseContext,
  loadThemeContext,
  paramsForExercise,
  themeHref,
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
  ({ id, data: { order } }) as Parameters<typeof buildCurriculumTree>[0][number];
const theme = (id: string, moduleId: string, order: number) =>
  ({ id, data: { order, moduleId } }) as Parameters<typeof buildCurriculumTree>[1][number];
const exercise = (id: string, themeId: string, order: number) =>
  ({ id, data: { order, themeId } }) as Parameters<typeof buildCurriculumTree>[2][number];

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
    expect([...arr].sort(byOrder).map((x) => x.id)).toEqual(["first", "second", "third"]);
  });
});

describe("buildCurriculumTree", () => {
  it("sorts modules by data.order", () => {
    const tree = buildCurriculumTree([mod("m2", 2), mod("m1", 1), mod("m3", 3)], [], []);
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
    const tree = buildCurriculumTree([mod("m1", 1)], [theme("t1", "m1", 1)], []);
    expect(tree[0].themes[0].firstExercise).toBeUndefined();
    expect(tree[0].themes[0].exerciseCount).toBe(0);
  });

  it("does not mutate the input arrays (the `.slice()` guard)", () => {
    /* A regression that drops the .slice() before .sort() would
     * mutate the shared themesByModule.get(...) array, leading to
     * subtle dev-mode hydration bugs. Pin this. */
    const modules = [mod("m2", 2), mod("m1", 1)];
    const themes = [theme("t2", "m1", 2), theme("t1", "m1", 1)];
    const exercises = [exercise("e2", "t1", 2), exercise("e1", "t1", 1)];
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
    expect(exerciseHref("foundations/variables/01")).toBe("/go/foundations/variables/01");
  });
});

describe("themeHref", () => {
  it("returns /go/<themeId>", () => {
    expect(themeHref("foundations/variables")).toBe("/go/foundations/variables");
  });
});

describe("paramsForExercise", () => {
  it("splits a well-formed id into module/theme/index", () => {
    expect(paramsForExercise("foundations/variables/01")).toEqual({
      module: "foundations",
      theme: "variables",
      index: "01",
    });
  });

  it("returns null when the id has fewer than 3 parts", () => {
    expect(paramsForExercise("foundations/variables")).toBeNull();
    expect(paramsForExercise("foundations")).toBeNull();
    expect(paramsForExercise("")).toBeNull();
  });

  it("returns null when the id has more than 3 parts", () => {
    expect(paramsForExercise("a/b/c/d")).toBeNull();
  });

  it("returns null when any part is empty", () => {
    expect(paramsForExercise("foundations//01")).toBeNull();
    expect(paramsForExercise("/variables/01")).toBeNull();
    expect(paramsForExercise("foundations/variables/")).toBeNull();
  });
});

describe("EXERCISE_TYPE_LABELS", () => {
  it("has a label for every exercise type in the schema", () => {
    expect(Object.keys(EXERCISE_TYPE_LABELS).sort()).toEqual([
      "fill-line",
      "fill-word",
      "freeform",
      "mcq",
    ]);
  });
});

describe("loadThemeContext", () => {
  const modA = mod("modA", 1);
  const modB = mod("modB", 2);
  const themeA1 = theme("modA/themeA1", "modA", 1);
  const exA1a = exercise("modA/themeA1/01", "modA/themeA1", 1);
  const exA1b = exercise("modA/themeA1/02", "modA/themeA1", 2);
  const exB1a = exercise("modB/themeB1/01", "modB/themeB1", 1);

  it("returns the parent module and sorted exercises for a known theme", () => {
    const ctx = loadThemeContext(themeA1, {
      modules: [modA, modB],
      exercises: [exA1b, exA1a, exB1a],
    });
    expect(ctx?.module.id).toBe("modA");
    expect(ctx?.exercises.map((e) => e.id)).toEqual(["modA/themeA1/01", "modA/themeA1/02"]);
  });

  it("returns null when the parent module is missing", () => {
    expect(loadThemeContext(themeA1, { modules: [modB], exercises: [exA1a] })).toBeNull();
  });

  it("returns empty exercises when the theme has none yet", () => {
    const ctx = loadThemeContext(themeA1, {
      modules: [modA],
      exercises: [exB1a],
    });
    expect(ctx?.exercises).toEqual([]);
  });

  it("does not mutate the input collections", () => {
    const exercises = [exA1b, exA1a];
    const snapshot = exercises.map((e) => e.id);
    loadThemeContext(themeA1, { modules: [modA], exercises });
    expect(exercises.map((e) => e.id)).toEqual(snapshot);
  });
});

describe("findAdjacentExercises", () => {
  const ex1 = exercise("modA/themeA1/01", "modA/themeA1", 1);
  const ex2 = exercise("modA/themeA1/02", "modA/themeA1", 2);
  const ex3 = exercise("modA/themeA1/03", "modA/themeA1", 3);
  /* Same module, different theme — must NOT be considered an adjacent. */
  const otherTheme = exercise("modA/themeA2/01", "modA/themeA2", 1);

  it("returns next-only for the first exercise in a theme", () => {
    const { prev, next } = findAdjacentExercises(ex1, [ex1, ex2, ex3]);
    expect(prev).toBeNull();
    expect(next?.id).toBe("modA/themeA1/02");
  });

  it("returns both for a middle exercise", () => {
    const { prev, next } = findAdjacentExercises(ex2, [ex1, ex2, ex3]);
    expect(prev?.id).toBe("modA/themeA1/01");
    expect(next?.id).toBe("modA/themeA1/03");
  });

  it("returns prev-only for the last exercise in a theme", () => {
    const { prev, next } = findAdjacentExercises(ex3, [ex1, ex2, ex3]);
    expect(prev?.id).toBe("modA/themeA1/02");
    expect(next).toBeNull();
  });

  it("sorts by data.order, not input order", () => {
    const { prev, next } = findAdjacentExercises(ex2, [ex3, ex1, ex2]);
    expect(prev?.id).toBe("modA/themeA1/01");
    expect(next?.id).toBe("modA/themeA1/03");
  });

  it("does not cross theme boundaries", () => {
    /* The last exercise in theme1 has no next, even when theme2's
     * exercises are in the same input list. Cross-theme progression
     * is a deliberate future decision; today the theme boundary is
     * a stop. */
    const { prev, next } = findAdjacentExercises(ex3, [ex1, ex2, ex3, otherTheme]);
    expect(prev?.id).toBe("modA/themeA1/02");
    expect(next).toBeNull();
  });

  it("returns both nulls when the exercise isn't in the list", () => {
    const orphan = exercise("modA/themeA1/99", "modA/themeA1", 99);
    expect(findAdjacentExercises(orphan, [ex1, ex2])).toEqual({
      prev: null,
      next: null,
    });
  });
});

describe("loadExerciseContext", () => {
  const modA = mod("modA", 1);
  const themeA1 = theme("modA/themeA1", "modA", 1);
  const exA1 = exercise("modA/themeA1/01", "modA/themeA1", 1);

  it("returns the parent theme and module for a known exercise", () => {
    const ctx = loadExerciseContext(exA1, {
      modules: [modA],
      themes: [themeA1],
    });
    expect(ctx?.theme.id).toBe("modA/themeA1");
    expect(ctx?.module.id).toBe("modA");
  });

  it("returns null when the parent theme is missing", () => {
    expect(loadExerciseContext(exA1, { modules: [modA], themes: [] })).toBeNull();
  });

  it("returns null when the parent module is missing", () => {
    expect(loadExerciseContext(exA1, { modules: [], themes: [themeA1] })).toBeNull();
  });
});
