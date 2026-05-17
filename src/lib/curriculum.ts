import type { CollectionEntry } from "astro:content";

type Module = CollectionEntry<"modules">;
type Theme = CollectionEntry<"themes">;
type Exercise = CollectionEntry<"exercises">;

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

export type ThemeNode = {
  theme: Theme;
  firstExercise: Exercise | undefined;
  exerciseCount: number;
};

export type ModuleNode = {
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
