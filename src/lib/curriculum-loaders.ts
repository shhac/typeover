import { getCollection, type CollectionEntry } from "astro:content";
import type { Target } from "./content-schema";

/*
 * Astro-runtime-coupled curriculum loaders. Pulled out of
 * `./curriculum-nav.ts` because vitest can't resolve `astro:content`'s
 * runtime `getCollection` — only its type-only exports erase to
 * nothing at transpile time.
 *
 * Re-exported by `./curriculum` so route pages keep a single
 * `~/lib/curriculum` import. The nav module stays test-importable
 * for the params + adjacency helpers.
 */

type Module = CollectionEntry<"modules">;
type Theme = CollectionEntry<"themes">;
type Exercise = CollectionEntry<"exercises">;

/** Per-language curriculum data — the three collections filtered to a
 *  single track's content. Each `/[lang]/*.astro` page that renders
 *  the full lang curriculum (the index, module overview) wants
 *  exactly this shape; without the helper each page re-inlined the
 *  same three `getCollection × 3` Promise.all + three
 *  `.filter(x => x.data.target === lang)` lines, easy to drift on
 *  one page (e.g. forget to filter exercises). */
export interface LangCollections {
  modules: Module[];
  themes: Theme[];
  exercises: Exercise[];
}

export async function loadLangCollections(lang: Target): Promise<LangCollections> {
  const [allModules, allThemes, allExercises] = await Promise.all([
    getCollection("modules"),
    getCollection("themes"),
    getCollection("exercises"),
  ]);
  return {
    modules: allModules.filter((m) => m.data.target === lang),
    themes: allThemes.filter((t) => t.data.target === lang),
    exercises: allExercises.filter((ex) => ex.data.target === lang),
  };
}
