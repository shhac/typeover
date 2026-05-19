---
name: astro-kb
description: Local knowledge base for working with Astro in this codebase — interop edges with Solid, content-collection patterns, dynamic-route conventions, and gotchas that bit us. Read the relevant subfile before touching .astro files, content schemas, or component boundaries between Astro and Solid islands.
---

# Astro knowledge base for typeover

A record of what we've learned about Astro 6 + Solid + Tailwind 4 in
the typeover codebase. Trees:

- `learnings/` — what we discovered, why it matters, the symptom that
  taught us. Read these first when something behaves unexpectedly.
- `references/` — settled patterns we use here, with file pointers.
  Read these before adding new pages, components, or content schemas.
- `examples/` — minimal working snippets demonstrating a pattern in
  isolation. Read these when you want a copy-able shape.

## How to use this skill

**Before touching `.astro` files** — skim `references/astro-solid-interop.md`
and `references/content-collections.md`. These have bitten us repeatedly
and the failure modes are silent.

**Before adding a new dynamic route** — skim `references/dynamic-routes.md`
for the `getStaticPaths` shape we use and the `paramsForExercise` helper
that guards against malformed ids.

**When something fails confusingly** — check `learnings/` first. Most of
what's there is a "I expected X, got Y, here's why" record that will
save you the debugging round-trip.

**When adding to this skill** — keep entries terse. One concrete
symptom + one concrete fix per file. If you find yourself writing
generic Astro tutorial content, that belongs in upstream docs, not
here. The value of this skill is project-specific failure modes.

## Files

### learnings/
- `astro-jsx-in-attributes.md` — Astro's template parser refuses
  nested component JSX in attribute braces. Cost us a Crumbs
  extraction. The fix is named slots in `.astro` components.
- `astro-content-server-only.md` — `astro:content` imports break in
  client code. Caught early but worth remembering.
- `astro-island-hydration-directives.md` — When to use `client:visible`
  vs `client:load` vs `client:idle` for exercise islands.

### references/
- `astro-solid-interop.md` — How we cross the Astro/Solid boundary:
  props in, slots out, what works, what doesn't.
- `content-collections.md` — Our Zod schema pattern, content-id format,
  how `getCollection` interacts with our `loadThemeContext` helpers.
- `dynamic-routes.md` — `getStaticPaths` shape, `paramsForExercise`,
  build-time invariant checks (throw on dangling refs).

### examples/
- `dynamic-route-with-context.md` — A minimal exercise-route frontmatter
  showing the load-then-throw-if-dangling pattern.
- `solid-island-with-props.md` — A minimal `<SolidComponent client:visible
  prop=...>` call site, including a serializable-prop note.
