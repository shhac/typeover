import type { CollectionEntry } from "astro:content";

type Module = CollectionEntry<"modules">;
type Theme = CollectionEntry<"themes">;
type Exercise = CollectionEntry<"exercises">;

export type ExerciseType = Exercise["data"]["type"];

/**
 * Display labels for each exercise type. Typed as a complete record so
 * adding a fifth type to the schema fails the build here, not on the
 * page. Replaces the per-page `satisfies Record<...>` exhaustiveness
 * workarounds.
 */
export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  mcq: "multiple choice",
  "fill-word": "fill word",
  "fill-line": "fill line",
  freeform: "freeform",
};

/** Stable sort by `data.order`. Tiebreaker is original array order. */
export const byOrder = <T extends { data: { order: number } }>(a: T, b: T) =>
  a.data.order - b.data.order;

/** Truncate a string to a max length, returning the assembled string with
 *  an ellipsis when truncated. Intro snippets on the curriculum overview
 *  use this; centralised so the limit is in one place. */
export function truncateIntro(s: string, max = 180): string {
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "…";
}

type ThemeNode = {
  theme: Theme;
  firstExercise: Exercise | undefined;
  exerciseCount: number;
};

type ModuleNode = {
  module: Module;
  themes: ThemeNode[];
};

/**
 * Build a sorted, denormalised curriculum tree. One pass over each
 * collection; afterwards, page rendering reads only from the tree.
 * Replaces a per-render filter+sort that was being repeated multiple
 * times per module.
 */
export function buildCurriculumTree(
  modules: Module[],
  themes: Theme[],
  exercises: Exercise[],
): ModuleNode[] {
  const themesByModule = new Map<string, Theme[]>();
  for (const theme of themes) {
    const list = themesByModule.get(theme.data.moduleId) ?? [];
    list.push(theme);
    themesByModule.set(theme.data.moduleId, list);
  }

  const exercisesByTheme = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const list = exercisesByTheme.get(ex.data.themeId) ?? [];
    list.push(ex);
    exercisesByTheme.set(ex.data.themeId, list);
  }

  return [...modules].sort(byOrder).map((module) => {
    const themesForModule = (themesByModule.get(module.id) ?? [])
      .slice()
      .sort(byOrder);
    return {
      module,
      themes: themesForModule.map((theme) => {
        const themeExercises = (exercisesByTheme.get(theme.id) ?? [])
          .slice()
          .sort(byOrder);
        return {
          theme,
          firstExercise: themeExercises[0],
          exerciseCount: themeExercises.length,
        };
      }),
    };
  });
}

/** Exercise IDs are `<module>/<theme>/<index>`, which maps 1-to-1 to
 *  the /go/[module]/[theme]/[index] dynamic route. */
export const exerciseHref = (exerciseId: string) => `/go/${exerciseId}`;

/** Theme IDs are `<module>/<theme>`, which maps 1-to-1 to the
 *  /go/[module]/[theme] overview route. */
export const themeHref = (themeId: string) => `/go/${themeId}`;

/**
 * Parse an exercise collection id (`<module>/<theme>/<index>`) into
 * the route params Astro's `getStaticPaths` returns. Returns `null` if
 * the id has the wrong shape — content with a malformed path would
 * silently render `/go/foundations/02.yaml/undefined`-style routes
 * otherwise.
 */
export function paramsForExercise(
  id: string,
): { module: string; theme: string; index: string } | null {
  const parts = id.split("/");
  if (parts.length !== 3) return null;
  const [module, theme, index] = parts;
  if (!module || !theme || !index) return null;
  return { module, theme, index };
}

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
  const module = collections.modules.find(
    (m) => m.id === theme.data.moduleId,
  );
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
