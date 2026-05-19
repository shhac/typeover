---
name: astro-solid-interop
last-touched: 2026-05-19
---

# Astro ⇄ Solid boundary reference

This is the contract every page-to-island handoff in typeover follows.
Diverge at your peril; we've been bitten by each rule below.

## Rule 1 — data loading happens in Astro frontmatter, NOT in Solid islands

The page's `---` block loads collections via `getCollection` / `getEntry`
and resolves any joins (`loadThemeContext`, `loadExerciseContext`,
`findAdjacentExercises`). The Solid island receives the resolved shape
as props.

Why: `astro:content` is server-only. See
`learnings/astro-content-server-only.md`.

## Rule 2 — props passed to islands must be serialisable

Astro serialises island props to JSON, ships them in HTML, deserialises
on the client. Anything non-JSON-serialisable (functions, class
instances, `Date` objects after round-trip become strings, Map/Set
become `{}` and `[]`) crosses the boundary unsafely.

✅ Safe: strings, numbers, booleans, plain objects/arrays.
✅ Safe: `CollectionEntry<"exercises">["data"]` — Zod-parsed plain JSON.
❌ Not safe: a `() => ...` lambda. (Wire it up inside the island instead.)
❌ Not safe: an `instanceof Map`. (Use a plain object record.)

## Rule 3 — children between tags work; JSX inside attribute braces does not

```astro
<!-- ✅ works -->
<SolidIsland>
  <Badge slot="...">via slot</Badge>
</SolidIsland>

<!-- ❌ Astro template parser refuses this -->
<SolidIsland left={<Badge>nope</Badge>} />
```

See `learnings/astro-jsx-in-attributes.md`. Reach for `.astro` named
slots when you want multi-region container components.

## Rule 4 — hydration directive must be set explicitly

A Solid component imported into an `.astro` page renders server-side
by default — but it WON'T be interactive without one of:

- `client:visible` (our default)
- `client:load`
- `client:idle`
- `client:only="solid-js"`

Forgetting the directive is a silent failure: the page renders, looks
correct, and nothing responds to clicks.

## Rule 5 — `~/components/ds` re-exports are the path to Solid components

Pages import:

```ts
import { Mcq } from "~/components/exercise/Mcq";
import { Badge, Container, Heading } from "~/components/ds";
```

Don't import directly from `~/components/ds/Badge` — the barrel re-export
in `index.ts` is the agreed surface. Adding a new DS component means
also adding the re-export.

## File pointers

- `src/pages/go/[module]/[theme]/[index].astro` — the canonical
  "load context in frontmatter, hand to Solid island" page.
- `src/components/exercise/Mcq.tsx` — minimal Solid island with
  serialisable props only.
- `src/components/ds/index.ts` — DS barrel re-export.
- `src/content.config.ts` — server-only Zod schema home.
