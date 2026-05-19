---
name: astro-content-server-only
discovered: 2026-05-17 (iter-2)
context: generator.ts wanted Zod for runtime schema validation
---

# `astro:content` and its `z` are server-only

## The symptom

`generator.ts` originally did:

```ts
import { z } from "astro:content";
export const GeneratorSchema = z.discriminatedUnion(...);
```

Worked in `content.config.ts`. Broke when imported into a Solid
component (`Mcq.tsx`) at hydration:

```
ReferenceError: astro:content is not defined
```

## Why

`astro:content` is a build-time module Astro injects into the server
bundle. Client islands (Solid `.tsx` files marked `client:visible`)
never receive it. The fact that the Zod re-export *exists* in
server-side type-checking and YAML validation doesn't mean it's
available at runtime in the browser.

## The fix

Add `zod` as a direct dependency and import from there:

```ts
import { z } from "zod";
```

Use `z` everywhere in shared runtime code (`generator.ts`,
`progress.ts`, future schema work).

`content.config.ts` can still import from `astro:content` — that file
is server-only by design and never crosses the hydration boundary.

## Test

`generator.ts` is imported by both `content.config.ts` (server) and
exercise components (client). If both consumers build, the import is
safe.

## What else this rules out

- Don't import `getCollection` / `getEntry` from a `.tsx` Solid
  component. They're server-only too.
- Page-side data loading happens in the frontmatter of `.astro` files,
  then gets passed to Solid islands as props. See
  `references/astro-solid-interop.md` for the boundary contract.
