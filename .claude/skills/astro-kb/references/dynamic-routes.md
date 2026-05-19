---
name: dynamic-routes
last-touched: 2026-05-19
---

# Dynamic-route reference

## Filesystem → URL mapping

Astro maps directory structure to URLs. We use bracketed dirs for
dynamic params:

```
src/pages/
  go/
    index.astro                          → /go
    [module]/
      [theme]/
        index.astro                      → /go/<module>/<theme>
        [index].astro                    → /go/<module>/<theme>/<index>
```

The `[index].astro` form (file named with brackets) and `index.astro`
inside a `[theme]/` directory are different patterns. Astro picks the
right route at build.

## `getStaticPaths` shape

Every dynamic route must export `getStaticPaths` from its frontmatter.
It returns `Array<{ params, props }>`:

```ts
export async function getStaticPaths() {
  const exercises = await getCollection("exercises");
  return exercises.flatMap((entry) => {
    const params = paramsForExercise(entry.id);
    if (!params) return [];
    return [{ params, props: { entry } }];
  });
}
```

Why `flatMap` and not `map`: skipping malformed entries needs `[]`
returns, which `flatMap` flattens away. Plain `map` would return
`undefined` slots which break the build.

The `params` shape must match the bracketed path segments exactly
(e.g. `{ module, theme, index }` for `[module]/[theme]/[index].astro`).

## Use `paramsForExercise` for id parsing

`paramsForExercise(id)` in `src/lib/curriculum.ts`:

- Splits `<mod>/<theme>/<idx>` into three params.
- Returns `null` for malformed ids (wrong segment count, empty segments).
- 4 unit tests cover the failure modes.

Don't inline `entry.id.split("/")` — that's how we ended up with a
silent `/go/foundations/02.yaml/undefined` route before the helper
landed.

## Props are typed by an interface, not by the params

```ts
interface Props {
  entry: CollectionEntry<"exercises">;
}

const { entry } = Astro.props;
```

Astro infers props from the `props` field of `getStaticPaths` returns
when the `Props` interface is declared. Keep `Props` minimal — pass
the resolved entry, not the raw id, so the page doesn't re-fetch it.

## Frontmatter loading pattern

```ts
const [modules, themes, exercises] = await Promise.all([
  getCollection("modules"),
  getCollection("themes"),
  getCollection("exercises"),
]);
const ctx = loadExerciseContext(entry, { modules, themes });
if (!ctx) {
  throw new Error(`Exercise "${entry.id}" has a dangling parent reference`);
}
const { module: moduleEntry, theme: themeEntry } = ctx;
```

Rationale:

- `Promise.all` to parallelise three collection reads — none of them
  depend on each other.
- `loadExerciseContext` does the join in one place; if a future page
  needs the same shape, it uses the helper rather than reinventing.
- Throw on `null` so a dangling reference aborts the build with a
  clear message, instead of rendering `undefined` chips.

## Where errors surface

`getStaticPaths` runs at build time. A `throw` aborts the build. The
runtime page render never sees a broken context.

The build output names the failing route file but NOT the offending
content id — that's why our error messages include `entry.id` in the
thrown string.
