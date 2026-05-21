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
  mcq: "pick one",
  "fill-word": "fill blanks",
  "fill-line": "type one line",
  freeform: "write a program",
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
  /** All exercise IDs in this theme, sorted by `order`. Consumers
   *  that need to subscribe to per-exercise progress (e.g. the
   *  curriculum-grid theme card) feed this into `summarizeTheme`. */
  exerciseIds: string[];
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
          exerciseIds: themeExercises.map((e) => e.id),
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

/* ======================= Re-exports (sibling module) =================
 * Navigation helpers (hrefs, paramsForExercise, context loads,
 * adjacency walks) moved to `./curriculum-nav.ts`. Re-exported
 * here to keep every existing `~/lib/curriculum` import working.
 * New code should import from `./curriculum-nav` directly. */
export {
  exerciseHref,
  findAdjacentExercises,
  firstExerciseOfNextTheme,
  langHref,
  langOf,
  lastExerciseInModule,
  lastExerciseOfPreviousTheme,
  loadExerciseContext,
  loadThemeContext,
  moduleCompleteHref,
  moduleHref,
  paramsForExercise,
  paramsForModule,
  paramsForTheme,
  themeHref,
  type ExerciseContext,
  type ThemeContext,
} from "./curriculum-nav";
