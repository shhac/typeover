---
name: astro-island-hydration-directives
discovered: 2026-05-17 (iter-2)
context: choosing the right hydration directive for exercise components
---

# `client:visible` is the right default for exercise islands

## The choices

Astro lets you opt each island into hydration with one of:

- `client:load` — hydrate immediately on page load. Largest TTI cost.
- `client:idle` — hydrate when `requestIdleCallback` fires. Cheaper
  but unpredictable on slow devices.
- `client:visible` — hydrate when scrolled into view (IntersectionObserver).
  Pay the JS cost only when the user actually looks at the island.
- `client:media="..."` — hydrate conditionally on a media query.
- `client:only="solid-js"` — never render server-side, hydrate
  immediately on client. Skips SSR entirely.

## What we use

Every `<Mcq>` / `<FillBlankWord>` / `<FillBlankLine>` in the exercise
route uses `client:visible`. Three reasons:

1. The exercise is below-the-fold on smaller screens (prompt + TS
   snippet sit above it). Hydrating only when scrolled in is
   measurably cheaper.
2. The island carries `useExerciseInstance` which fires
   `recordInstanceSeen` on the FIRST hydration. `client:visible`
   correctly defers that recording until the learner actually engages
   — see also `learnings/createEffect-vs-createMemo-recording.md`
   (planned).
3. The island is rendered server-side first (Astro renders Solid's
   SSR output), so the layout doesn't shift when hydration kicks in.

## When NOT to use `client:visible`

- Components that depend on `useExerciseProgress` to read localStorage
  at mount need either `client:load` or `client:only` — server can't
  read localStorage, and `client:visible` deferral means progress
  chips show stale "0 seen" until the user scrolls.
- Theme-overview cards if they ever become interactive would need
  `client:visible` too, but they're currently pure links (no JS).

## Cost we observed

44 → 75 pages built after the theme overview route landed; build went
from 2.24s → 2.40s. Hydration JS is per-island; total JS in the
exercise route is `~5kB` of Solid runtime + ~2kB component code. No
single-page metric regressed.
