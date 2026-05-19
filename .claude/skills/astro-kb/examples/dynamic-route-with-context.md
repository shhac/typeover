---
name: dynamic-route-with-context
last-touched: 2026-05-19
---

# Example: dynamic exercise route with load-context

Real shape used in
`src/pages/go/[module]/[theme]/[index].astro`. Trimmed to the
essential frontmatter; the JSX render layer omitted.

```astro
---
import { getCollection, type CollectionEntry } from "astro:content";
import BaseLayout from "~/layouts/BaseLayout.astro";
import { Mcq } from "~/components/exercise/Mcq";
import {
  exerciseHref,
  findAdjacentExercises,
  loadExerciseContext,
  paramsForExercise,
  themeHref,
} from "~/lib/curriculum";

type ExerciseEntry = CollectionEntry<"exercises">;

export async function getStaticPaths() {
  const exercises = await getCollection("exercises");
  return exercises.flatMap((entry) => {
    const params = paramsForExercise(entry.id);
    if (!params) return [];
    return [{ params, props: { entry } }];
  });
}

interface Props {
  entry: ExerciseEntry;
}

const { entry } = Astro.props;
const ex = entry.data;

const [modules, themes, exercises] = await Promise.all([
  getCollection("modules"),
  getCollection("themes"),
  getCollection("exercises"),
]);
const ctx = loadExerciseContext(entry, { modules, themes });
if (!ctx) {
  throw new Error(
    `Exercise "${entry.id}" has a dangling parent reference (themeId="${ex.themeId}")`,
  );
}
const { module: moduleEntry, theme: themeEntry } = ctx;

const { next } = findAdjacentExercises(entry, exercises);
const nextExerciseHref = next ? exerciseHref(next.id) : undefined;
const parentThemeHref = themeHref(themeEntry.id);
---

<BaseLayout title={`${themeEntry.data.title} — typeover`}>
  <Mcq
    client:visible
    exerciseId={entry.id}
    prompt={ex.prompt}
    generator={ex.generator}
    hints={ex.hints}
    nextExerciseHref={nextExerciseHref}
    themeHref={parentThemeHref}
  />
</BaseLayout>
```

## What this demonstrates

- `getStaticPaths` with `flatMap` + the `paramsForExercise` skip-malformed
  pattern.
- Three collections loaded in parallel via `Promise.all`.
- `loadExerciseContext` returns `null` on dangling references; the
  page throws with an actionable message (includes the broken id).
- `findAdjacentExercises` for cross-exercise navigation; result is
  passed to the Solid island as a string prop (serialisable).
- `client:visible` on the island.

## Where to adapt this

- Theme-overview route uses the same pattern with
  `loadThemeContext` instead.
- A future module-overview route would use a parallel
  `loadModuleContext` (not yet written — add it when needed).
