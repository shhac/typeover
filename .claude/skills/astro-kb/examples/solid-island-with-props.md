---
name: solid-island-with-props
last-touched: 2026-05-19
---

# Example: Solid island called from an Astro page

Real shape from `src/components/exercise/Mcq.tsx` and the route that
mounts it. Demonstrates: the props contract, the hydration directive,
and the rule that all props must be JSON-serialisable.

## The component (Solid, `.tsx`)

```tsx
import { createSignal, For } from "solid-js";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import { useExercisePhase } from "~/lib/exercise-phase";
import { ExerciseShell } from "./ExerciseShell";
import { McqOption } from "./McqOption";

interface McqProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec; // Zod-inferred plain object — serialisable
  hints: readonly [string, string, string];
  nextExerciseHref?: string;
  themeHref?: string;
}

export function Mcq(props: McqProps) {
  // ... headless lifecycle hooks, render via ExerciseShell ...
}
```

Notes:

- Every prop is a string, number, boolean, or a plain object/array of
  those. No functions, no `Date`, no `Map`. Astro serialises props
  across the hydration boundary; non-serialisable props arrive as
  `{}` or worse on the client.
- `GeneratorSpec` is `z.infer<typeof GeneratorSchema>` — a plain object
  shape from `src/lib/generator.ts`. Plain JSON.

## The mount (Astro, `.astro`)

```astro
<Mcq
  client:visible
  exerciseId={entry.id}
  prompt={ex.prompt}
  generator={ex.generator}
  hints={ex.hints}
  nextExerciseHref={nextExerciseHref}
  themeHref={parentThemeHref}
/>
```

Notes:

- `client:visible` defers hydration until the island is scrolled into
  view. See `learnings/astro-island-hydration-directives.md` for why
  this is our default.
- Attribute values are JavaScript expressions in `{...}` — no JSX. If
  you find yourself wanting `<SomeComponent>` inside `{...}`, you've
  hit the rule from `learnings/astro-jsx-in-attributes.md` and should
  use `.astro` named slots instead.
- The island renders server-side first (Astro runs Solid SSR), then
  hydrates when the directive fires. Layout doesn't shift.

## When this pattern breaks down

- Props that need to change at runtime (e.g. a callback from page to
  island): wire them inside the island via signals, not as props.
- Props that need to *come back* (island → page communication): not
  possible across the boundary. Use a shared store or URL state.
- Islands that need DOM measurements before the page is ready: use
  `client:load` instead of `client:visible`.
