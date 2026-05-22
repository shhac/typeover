import type { CollectionEntry } from "astro:content";
import { byOrder } from "./curriculum";

type Module = CollectionEntry<"modules">;
type Theme = CollectionEntry<"themes">;
type Exercise = CollectionEntry<"exercises">;

/*
 * Route-time navigation helpers — adjacency walks, context
 * resolution, and href builders. Sibling module to curriculum.ts
 * (which owns the build-time tree + coverage aggregation) per the
 * structural review's file-decomposition lens.
 *
 * Both files share Astro's CollectionEntry types but serve
 * different consumers:
 *   - curriculum.ts  → /go index page, ModuleCompleteCard
 *                      (tree-building, coverage rollup)
 *   - curriculum-nav → exercise + theme routes
 *                      (Previous/Next walks, breadcrumb context)
 */

/* ============================== Hrefs =============================== */

/* Multi-language tracks: every collection ID is prefixed with its
 * language slug (`go/foundations/loops/01`,
 * `zig/basics/hello-and-output/01`), and URLs are 1-to-1 with IDs —
 * `/{id}` is the route. The lang is part of the path because the page
 * renders track-specific chrome (LangCrumbs, exercise grader runtime
 * selection, etc.). */

/** Exercise IDs are `<lang>/<module>/<theme>/<index>`, mapping 1-to-1
 *  to the /[lang]/[module]/[theme]/[index] dynamic route. */
export const exerciseHref = (exerciseId: string) => `/${exerciseId}`;

/** Theme IDs are `<lang>/<module>/<theme>`, mapping 1-to-1 to the
 *  /[lang]/[module]/[theme] overview route. */
export const themeHref = (themeId: string) => `/${themeId}`;

/** Module-overview route. Single-module narrower view of the lang
 *  curriculum — used by breadcrumbs that used to lie about their
 *  destination. */
export const moduleHref = (moduleId: string) => `/${moduleId}`;

/** Module-completion celebration page. Linked from the last
 *  exercise of the last theme in a module via the `nextExerciseHref`
 *  the route file computes. */
export const moduleCompleteHref = (moduleId: string) => `/${moduleId}/complete`;

/** Top-of-track index for a given language (`/go`, `/zig`, …). */
export const langHref = (lang: string) => `/${lang}`;

/* =========================== Static-paths =========================== */

/**
 * Parse an exercise collection id (`<lang>/<module>/<theme>/<index>`)
 * into the route params Astro's `getStaticPaths` returns. Returns
 * `null` if the id has the wrong shape — content with a malformed
 * path would silently render `/undefined/...`-style routes otherwise.
 */
export function paramsForExercise(
  id: string,
): { lang: string; module: string; theme: string; index: string } | null {
  const parts = id.split("/");
  if (parts.length !== 4) return null;
  const [lang, module, theme, index] = parts;
  if (!lang || !module || !theme || !index) return null;
  return { lang, module, theme, index };
}

/**
 * Parse a theme collection id (`<lang>/<module>/<theme>`) into route
 * params for the theme-overview page. Returns null if malformed.
 */
export function paramsForTheme(id: string): { lang: string; module: string; theme: string } | null {
  const parts = id.split("/");
  if (parts.length !== 3) return null;
  const [lang, module, theme] = parts;
  if (!lang || !module || !theme) return null;
  return { lang, module, theme };
}

/**
 * Parse a module collection id (`<lang>/<module>`) into route params
 * for the module-overview / module-complete pages. Returns null if
 * malformed.
 */
export function paramsForModule(id: string): { lang: string; module: string } | null {
  const parts = id.split("/");
  if (parts.length !== 2) return null;
  const [lang, module] = parts;
  if (!lang || !module) return null;
  return { lang, module };
}

/** Pull the lang slug off a collection ID (`go/foundations/...` → `"go"`). */
export const langOf = (id: string): string => id.split("/")[0] ?? "";

/* Astro-runtime-coupled collection loaders live in `./curriculum-loaders`
 * (the `getCollection` runtime import would break vitest's resolution
 * of this module). Re-exported via `~/lib/curriculum` so the route
 * files can keep their single import. */

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
  const ownTheme = themes.find((t) => t.id === exercise.data.themeId);
  if (!ownTheme) return null;
  const moduleId = ownTheme.data.moduleId;
  const moduleThemes = themes.filter((t) => t.data.moduleId === moduleId).sort(byOrder);
  const isLastTheme = moduleThemes[moduleThemes.length - 1]?.id === ownTheme.id;
  if (!isLastTheme) return null;
  const themeExercises = allExercises.filter((ex) => ex.data.themeId === ownTheme.id).sort(byOrder);
  const isLastExercise = themeExercises[themeExercises.length - 1]?.id === exercise.id;
  return isLastExercise ? { moduleId } : null;
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
  const ownTheme = themes.find((t) => t.id === exercise.data.themeId);
  if (!ownTheme) return null;
  const moduleThemes = themes
    .filter((t) => t.data.moduleId === ownTheme.data.moduleId)
    .sort(byOrder);
  const i = moduleThemes.findIndex((t) => t.id === ownTheme.id);
  const nextTheme = moduleThemes[i + 1];
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
  const ownTheme = themes.find((t) => t.id === exercise.data.themeId);
  if (!ownTheme) return null;
  const moduleThemes = themes
    .filter((t) => t.data.moduleId === ownTheme.data.moduleId)
    .sort(byOrder);
  const i = moduleThemes.findIndex((t) => t.id === ownTheme.id);
  const prevTheme = moduleThemes[i - 1];
  if (!prevTheme) return null;
  const prevThemeExercises = allExercises
    .filter((ex) => ex.data.themeId === prevTheme.id)
    .sort(byOrder);
  return prevThemeExercises[prevThemeExercises.length - 1] ?? null;
}
