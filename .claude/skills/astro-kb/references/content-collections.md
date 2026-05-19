---
name: content-collections
last-touched: 2026-05-19
---

# Content collections + Zod reference

## Where

- Schemas: `src/content.config.ts`. One file, three collections
  (`modules`, `themes`, `exercises`), all target-aware (currently
  Go only; future-proof for `z.enum(["go", "rust", ...])`).
- YAML content: `src/content/<collection>/<path>.yaml`. The path
  segments become the `entry.id`.

## ID format invariant

Astro derives `entry.id` from the filename. We use this as the route
parameter source via `paramsForExercise(id)` in `src/lib/curriculum.ts`.
The format is:

- modules: `<module>` (one segment)
- themes: `<module>/<theme>` (two segments)
- exercises: `<module>/<theme>/<index>` (three segments)

If an exercise YAML is misfiled (e.g. `foundations/02.yaml` instead of
`foundations/variables/02.yaml`), `paramsForExercise` returns `null`
and `getStaticPaths` skips that entry — the route just isn't generated.
That's a deliberate fail-quiet: the malformed YAML still appears in
content but doesn't silently produce a `/go/foundations/02.yaml/undefined`
route.

## The Zod schema lives separately from runtime

`GeneratorSchema` is owned by `src/lib/generator.ts` and imported by
`content.config.ts`. This is so:

1. Runtime code (`generator.ts → generate()`) and content validation
   share one source of truth — the TS types are `z.infer`red from the
   same schema the YAML is validated against.
2. Adding a new generator kind (e.g. `procedural`) updates both the
   YAML validator and the dispatcher in one place.

Don't import `z` from `astro:content` into `generator.ts` — it's
server-only. Use the standalone `zod` package directly.

## Joining collections — use the helpers

Each Astro page that needs a module/theme/exercise join should use the
helpers in `src/lib/curriculum.ts`, not inline `find`/`filter`. The
helpers are unit-tested; inline joins are not.

- `loadThemeContext(theme, { modules, exercises })` → `{ module, exercises }`
  (exercises sorted by `data.order`). Returns `null` if module is
  missing — page should throw.
- `loadExerciseContext(exercise, { modules, themes })` → `{ module, theme }`.
  Returns `null` on dangling references — page should throw.
- `findAdjacentExercises(exercise, allExercises)` → `{ prev, next }`
  within the same theme.

## Build-time invariants

When a load helper returns `null`, the page MUST throw rather than
render with undefined props. Astro's `getStaticPaths` runs at build
time, so the throw aborts the build — exactly when we want to catch
a broken content reference. The error message should name the broken
id so the author can locate the YAML.

Example: see `src/pages/go/[module]/[theme]/[index].astro` lines
40-46.

## Adding a new collection

1. Add the schema to `content.config.ts`.
2. Add an `export const collections = { ... }` entry.
3. If adding a new `z.enum` field that the dispatcher uses, also
   update the runtime in `generator.ts` and any consumer record
   (e.g. `EXERCISE_TYPE_LABELS`).
4. Re-run `pnpm typecheck` to catch downstream gaps.

## Cross-field validation (`.refine`)

Currently NOT implemented. Some authoring mistakes (fill-word exercise
authored without `blanks: [...]`) only surface at runtime via
vacuous-truth guards. Task #38 in the project's task list tracks
adding `.refine()` cross-field checks. Pattern when it lands:

```ts
exerciseCollection.refine(
  (ex) => ex.type !== "fill-word" || (ex.blanks && ex.blanks.length > 0),
  { message: "fill-word exercises require a non-empty `blanks` list" },
);
```
