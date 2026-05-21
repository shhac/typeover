import { describe, expect, it } from "vitest";
import {
  firstExerciseOfNextTheme,
  lastExerciseInModule,
  lastExerciseOfPreviousTheme,
} from "./curriculum-nav";
import type { CollectionEntry } from "astro:content";

/*
 * Direct unit tests for the three cross-theme adjacency walks
 * that power the exercise route's Next / Previous buttons. The
 * within-theme walker `findAdjacentExercises` is tested in
 * `curriculum.test.ts` (same shape); these three are the
 * boundary-spanning siblings that the prior suite skipped.
 *
 * An off-by-one or missing `.slice()` before `.sort()` here would
 * silently break advance/back-up at theme boundaries — easily
 * missed in manual QA on a 31-theme curriculum.
 *
 * Heavy CollectionEntry types are stubbed with minimal
 * `{ id, data }` shapes; the walkers never touch the other
 * fields.
 */

type Theme = CollectionEntry<"themes">;
type Exercise = CollectionEntry<"exercises">;

const theme = (id: string, moduleId: string, order: number): Theme =>
  ({ id, data: { order, moduleId } }) as Theme;
const exercise = (id: string, themeId: string, order: number): Exercise =>
  ({ id, data: { order, themeId } }) as Exercise;

describe("firstExerciseOfNextTheme", () => {
  const themes = [
    theme("modA/t1", "modA", 1),
    theme("modA/t2", "modA", 2),
    theme("modA/t3", "modA", 3),
    theme("modB/t1", "modB", 1),
  ];
  const exercises = [
    exercise("modA/t1/01", "modA/t1", 1),
    exercise("modA/t1/02", "modA/t1", 2),
    exercise("modA/t2/01", "modA/t2", 1),
    exercise("modA/t2/02", "modA/t2", 2),
    exercise("modA/t3/01", "modA/t3", 1),
    exercise("modB/t1/01", "modB/t1", 1),
  ];

  it("returns the first exercise of the next theme within the same module", () => {
    const result = firstExerciseOfNextTheme(
      exercise("modA/t1/02", "modA/t1", 2),
      themes,
      exercises,
    );
    expect(result?.id).toBe("modA/t2/01");
  });

  it("walks across theme boundaries by `order`, not array position", () => {
    /* Themes inserted out-of-order — the walker must sort first
     * before indexing the next neighbour. */
    const shuffled = [...themes].reverse();
    const result = firstExerciseOfNextTheme(
      exercise("modA/t1/02", "modA/t1", 2),
      shuffled,
      exercises,
    );
    expect(result?.id).toBe("modA/t2/01");
  });

  it("returns null when this is the last theme in the module", () => {
    const result = firstExerciseOfNextTheme(
      exercise("modA/t3/01", "modA/t3", 1),
      themes,
      exercises,
    );
    expect(result).toBeNull();
  });

  it("does NOT cross module boundaries — modA's last theme does not point at modB", () => {
    /* "next theme in the SAME module" — the walker must not
     * step out of modA into modB even though modB exists. */
    const result = firstExerciseOfNextTheme(
      exercise("modA/t3/01", "modA/t3", 1),
      themes,
      exercises,
    );
    expect(result).toBeNull();
  });

  it("returns null when the next theme is empty (no exercises authored)", () => {
    const emptyNextThemes = [theme("modX/t1", "modX", 1), theme("modX/t2", "modX", 2)];
    const onlyT1 = [exercise("modX/t1/01", "modX/t1", 1)];
    const result = firstExerciseOfNextTheme(
      exercise("modX/t1/01", "modX/t1", 1),
      emptyNextThemes,
      onlyT1,
    );
    expect(result).toBeNull();
  });

  it("returns null when the exercise's own theme is missing from the themes list", () => {
    const result = firstExerciseOfNextTheme(
      exercise("dangling/t1/01", "dangling/t1", 1),
      themes,
      exercises,
    );
    expect(result).toBeNull();
  });
});

describe("lastExerciseOfPreviousTheme", () => {
  const themes = [
    theme("modA/t1", "modA", 1),
    theme("modA/t2", "modA", 2),
    theme("modA/t3", "modA", 3),
  ];
  const exercises = [
    exercise("modA/t1/01", "modA/t1", 1),
    exercise("modA/t1/02", "modA/t1", 2),
    exercise("modA/t1/03", "modA/t1", 3),
    exercise("modA/t2/01", "modA/t2", 1),
    exercise("modA/t3/01", "modA/t3", 1),
  ];

  it("returns the LAST exercise of the previous theme (not the first)", () => {
    const result = lastExerciseOfPreviousTheme(
      exercise("modA/t2/01", "modA/t2", 1),
      themes,
      exercises,
    );
    expect(result?.id).toBe("modA/t1/03");
  });

  it("returns null when this is the first theme in the module", () => {
    const result = lastExerciseOfPreviousTheme(
      exercise("modA/t1/01", "modA/t1", 1),
      themes,
      exercises,
    );
    expect(result).toBeNull();
  });

  it("walks by `order`, not array position", () => {
    const shuffled = [...themes].reverse();
    const result = lastExerciseOfPreviousTheme(
      exercise("modA/t3/01", "modA/t3", 1),
      shuffled,
      exercises,
    );
    expect(result?.id).toBe("modA/t2/01");
  });

  it("returns null when the previous theme is empty", () => {
    const onlyT2 = [exercise("modA/t2/01", "modA/t2", 1)];
    const result = lastExerciseOfPreviousTheme(
      exercise("modA/t2/01", "modA/t2", 1),
      themes,
      onlyT2,
    );
    expect(result).toBeNull();
  });
});

describe("lastExerciseInModule", () => {
  const themes = [
    theme("modA/t1", "modA", 1),
    theme("modA/t2", "modA", 2),
    theme("modA/t3", "modA", 3),
    theme("modB/t1", "modB", 1),
  ];
  const exercises = [
    exercise("modA/t1/01", "modA/t1", 1),
    exercise("modA/t2/01", "modA/t2", 1),
    exercise("modA/t3/01", "modA/t3", 1),
    exercise("modA/t3/02", "modA/t3", 2),
    exercise("modA/t3/03", "modA/t3", 3),
    exercise("modB/t1/01", "modB/t1", 1),
  ];

  it("returns the moduleId when the exercise is the last exercise of the last theme", () => {
    const result = lastExerciseInModule(
      exercise("modA/t3/03", "modA/t3", 3),
      themes,
      exercises,
    );
    expect(result).toEqual({ moduleId: "modA" });
  });

  it("returns null when this is the last theme but NOT its last exercise", () => {
    const result = lastExerciseInModule(
      exercise("modA/t3/02", "modA/t3", 2),
      themes,
      exercises,
    );
    expect(result).toBeNull();
  });

  it("returns null when this is the last exercise of a non-last theme", () => {
    const result = lastExerciseInModule(
      exercise("modA/t1/01", "modA/t1", 1),
      themes,
      exercises,
    );
    expect(result).toBeNull();
  });

  it("identifies last theme by `order`, not array position", () => {
    const shuffled = [...themes].reverse();
    const result = lastExerciseInModule(
      exercise("modA/t3/03", "modA/t3", 3),
      shuffled,
      exercises,
    );
    expect(result).toEqual({ moduleId: "modA" });
  });

  it("returns null when the exercise's theme is missing from the themes list", () => {
    const result = lastExerciseInModule(
      exercise("dangling/t/01", "dangling/t", 1),
      themes,
      exercises,
    );
    expect(result).toBeNull();
  });
});
