import type { CollectionEntry } from "astro:content";
import { byOrder } from "./curriculum";

type Module = CollectionEntry<"modules">;
type Theme = CollectionEntry<"themes">;
type Exercise = CollectionEntry<"exercises">;

/*
 * Route-time navigation helpers — context loads (theme/exercise
 * parent resolution) and adjacency walks (next/previous exercise
 * within or across themes).
 *
 * URL builders and collection-id parsers (`exerciseHref`,
 * `paramsForExercise`, etc.) used to live here but moved to
 * `./curriculum-paths` — they're pure string ops with no
 * `CollectionEntry` shape, so non-route consumers (chips,
 * breadcrumbs, tests) can import them without the Astro type
 * machinery. The umbrella `./curriculum` module re-exports
 * everything so existing callers' import paths stay stable.
 *
 * Both files share Astro's CollectionEntry types but serve
 * different consumers:
 *   - curriculum.ts  → /[lang] index, ModuleCompleteCard
 *                      (tree-building, coverage rollup)
 *   - curriculum-paths → anywhere (pure string helpers)
 *   - curriculum-nav   → exercise + theme routes
 *                      (Previous/Next walks, breadcrumb context)
 */

/* ============================ Context loads ========================= */

export type ThemeContext = {
  module: Module;
  exercises: Exercise[];
};

/**
 * Resolve the parent module and child exercise list for a theme,
 * already sorted by `data.order`. Centralises the join that all three
 * theme/exercise-aware pages were doing inline. The exercises list
 * is sliced from any shared cache before sorting so it never mutates
 * the caller's array.
 */
export function loadThemeContext(
  theme: Theme,
  collections: { modules: readonly Module[]; exercises: readonly Exercise[] },
): ThemeContext | null {
  const module = collections.modules.find((m) => m.id === theme.data.moduleId);
  if (!module) return null;
  const exercises = collections.exercises
    .filter((ex) => ex.data.themeId === theme.id)
    .sort(byOrder);
  return { module, exercises };
}

export type ExerciseContext = {
  module: Module;
  theme: Theme;
};

/**
 * Resolve the parent theme and module for an exercise. Returns null
 * if either parent is missing — surfaces broken content references
 * loudly at build time rather than letting the route render with
 * undefined breadcrumbs.
 */
export function loadExerciseContext(
  exercise: Exercise,
  collections: { modules: readonly Module[]; themes: readonly Theme[] },
): ExerciseContext | null {
  const theme = collections.themes.find((t) => t.id === exercise.data.themeId);
  if (!theme) return null;
  const module = collections.modules.find((m) => m.id === theme.data.moduleId);
  if (!module) return null;
  return { module, theme };
}

/* ============================ Adjacency walks ======================= */

/**
 * Find the previous and next exercises within the same theme, in
 * `data.order` order. Returns `null` for either side that doesn't
 * exist (first exercise has no prev; last has no next).
 *
 * Powers the "Next exercise →" button in ExerciseShell so learners
 * can advance from Exercise 1 to Exercise 2 without bouncing back
 * to the theme overview.
 */
export function findAdjacentExercises(
  exercise: Exercise,
  allExercises: readonly Exercise[],
): { prev: Exercise | null; next: Exercise | null } {
  const siblings = allExercises
    .filter((ex) => ex.data.themeId === exercise.data.themeId)
    .sort(byOrder);
  const i = siblings.findIndex((ex) => ex.id === exercise.id);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: siblings[i - 1] ?? null,
    next: siblings[i + 1] ?? null,
  };
}

/* The three cross-theme walks (`lastExerciseInModule`,
 * `firstExerciseOfNextTheme`, `lastExerciseOfPreviousTheme`) all
 * start from the same triple: own theme, that theme's sibling list
 * sorted by order, and the index of the own theme in that list.
 * Lift it into one named helper so each caller reads as the unique
 * thing it does (look at the tail, look at i+1, look at i-1). */
interface ModuleThemeContext {
  ownTheme: Theme;
  moduleThemes: Theme[];
  index: number;
}
function moduleThemeContext(
  exercise: Exercise,
  themes: readonly Theme[],
): ModuleThemeContext | null {
  const ownTheme = themes.find((t) => t.id === exercise.data.themeId);
  if (!ownTheme) return null;
  const moduleThemes = themes
    .filter((t) => t.data.moduleId === ownTheme.data.moduleId)
    .sort(byOrder);
  const index = moduleThemes.findIndex((t) => t.id === ownTheme.id);
  return { ownTheme, moduleThemes, index };
}

/**
 * Is this the last exercise of the last theme in its module?
 *
 * Used by the exercise route to pick the right "Next →" target:
 *   - within-theme next exists                → next exercise
 *   - last in theme but more themes in module → first ex. of next theme
 *   - last exercise of last theme in module   → module-complete page
 *
 * Returns the moduleId when true (so the caller can build the
 * /go/<module>/complete href without re-resolving the parent) or
 * null when not the last-in-module.
 */
export function lastExerciseInModule(
  exercise: Exercise,
  themes: readonly Theme[],
  allExercises: readonly Exercise[],
): { moduleId: string } | null {
  const ctx = moduleThemeContext(exercise, themes);
  if (!ctx) return null;
  const isLastTheme = ctx.moduleThemes[ctx.moduleThemes.length - 1]?.id === ctx.ownTheme.id;
  if (!isLastTheme) return null;
  const themeExercises = allExercises
    .filter((ex) => ex.data.themeId === ctx.ownTheme.id)
    .sort(byOrder);
  const isLastExercise = themeExercises[themeExercises.length - 1]?.id === exercise.id;
  return isLastExercise ? { moduleId: ctx.ownTheme.data.moduleId } : null;
}

/**
 * Cross-theme "next exercise" — first exercise of the next theme in
 * the same module by order. Used by the route to keep the "Next
 * exercise →" button moving forward across theme boundaries.
 *
 * Returns null when there is no next theme in this module (i.e.
 * we're in the last theme; `lastExerciseInModule` covers that
 * tail).
 */
export function firstExerciseOfNextTheme(
  exercise: Exercise,
  themes: readonly Theme[],
  allExercises: readonly Exercise[],
): Exercise | null {
  const ctx = moduleThemeContext(exercise, themes);
  if (!ctx) return null;
  const nextTheme = ctx.moduleThemes[ctx.index + 1];
  if (!nextTheme) return null;
  const nextThemeExercises = allExercises
    .filter((ex) => ex.data.themeId === nextTheme.id)
    .sort(byOrder);
  return nextThemeExercises[0] ?? null;
}

/**
 * Cross-theme "previous exercise" — last exercise of the previous
 * theme in the same module by order. Mirror of
 * `firstExerciseOfNextTheme`. Used by the route to render
 * "← Previous exercise" so a learner can back up across theme
 * boundaries without bouncing to the curriculum index.
 *
 * Returns null when there is no previous theme in this module
 * (i.e. we're in the first theme; the caller falls back to the
 * theme overview link).
 */
export function lastExerciseOfPreviousTheme(
  exercise: Exercise,
  themes: readonly Theme[],
  allExercises: readonly Exercise[],
): Exercise | null {
  const ctx = moduleThemeContext(exercise, themes);
  if (!ctx) return null;
  const prevTheme = ctx.moduleThemes[ctx.index - 1];
  if (!prevTheme) return null;
  const prevThemeExercises = allExercises
    .filter((ex) => ex.data.themeId === prevTheme.id)
    .sort(byOrder);
  return prevThemeExercises[prevThemeExercises.length - 1] ?? null;
}
