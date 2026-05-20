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
    const themesForModule = (themesByModule.get(module.id) ?? []).slice().sort(byOrder);
    return {
      module,
      themes: themesForModule.map((theme) => {
        const themeExercises = (exercisesByTheme.get(theme.id) ?? []).slice().sort(byOrder);
        return {
          theme,
          firstExercise: themeExercises[0],
          exerciseCount: themeExercises.length,
        };
      }),
    };
  });
}

/**
 * Site-wide coverage rollup of the same tree the curriculum page
 * renders. Used by the `<CurriculumCoverage>` overview chip on
 * /go (design-docs/25 — promoted from `pnpm content:report`).
 *
 * Returns absolute counts, never percentages — let the caller
 * format. `themesCovered` is themes with ≥1 authored exercise,
 * mirroring the `pnpm content:report` rule.
 */
export interface CoverageSummary {
  totalModules: number;
  totalThemes: number;
  themesCovered: number;
  totalExercises: number;
  /** Modules with every theme covered. Symmetric with the
   *  `pnpm content:report` "complete" tier. */
  modulesComplete: number;
  /** Modules with at least one but not all themes covered. */
  modulesPartial: number;
  /** Modules with no themes covered at all (pre-launch stubs). */
  modulesEmpty: number;
}

export function summariseCoverage(tree: readonly ModuleNode[]): CoverageSummary {
  let totalThemes = 0;
  let themesCovered = 0;
  let totalExercises = 0;
  let modulesComplete = 0;
  let modulesPartial = 0;
  let modulesEmpty = 0;
  for (const { themes } of tree) {
    if (themes.length === 0) {
      modulesEmpty++;
      continue;
    }
    let coveredInModule = 0;
    for (const t of themes) {
      totalThemes++;
      totalExercises += t.exerciseCount;
      if (t.exerciseCount > 0) {
        themesCovered++;
        coveredInModule++;
      }
    }
    if (coveredInModule === 0) modulesEmpty++;
    else if (coveredInModule === themes.length) modulesComplete++;
    else modulesPartial++;
  }
  return {
    totalModules: tree.length,
    totalThemes,
    themesCovered,
    totalExercises,
    modulesComplete,
    modulesPartial,
    modulesEmpty,
  };
}

/** Exercise IDs are `<module>/<theme>/<index>`, which maps 1-to-1 to
 *  the /go/[module]/[theme]/[index] dynamic route. */
export const exerciseHref = (exerciseId: string) => `/go/${exerciseId}`;

/** Theme IDs are `<module>/<theme>`, which maps 1-to-1 to the
 *  /go/[module]/[theme] overview route. */
export const themeHref = (themeId: string) => `/go/${themeId}`;

/** Module-overview route. Single-module narrower view of /go —
 *  used by breadcrumbs that used to lie about their destination. */
export const moduleHref = (moduleId: string) => `/go/${moduleId}`;

/** Module-completion celebration page. Linked from the last
 *  exercise of the last theme in a module via the `nextExerciseHref`
 *  the route file computes. */
export const moduleCompleteHref = (moduleId: string) => `/go/${moduleId}/complete`;

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
