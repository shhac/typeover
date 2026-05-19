# typeover

**Learn Go from your TypeScript knowledge.**

A bilingual learning site that teaches Go to TypeScript developers
through side-by-side translation. Every concept is introduced as a
translation from TS you already know, drilled through a four-stage
exercise progression — recognition, tile fill-in, line composition,
freeform code — and revealed only when *you* ask.

Built for the audience that bounces off "A Tour of Go" because they
don't need to learn programming, they need to learn the syntactic and
idiomatic shifts that put their TS reflexes in the right Go shape.

## Where you are

This is a working build, not a launched product. Module 1
(**Foundations**) is complete — all six themes ship the full 9/9
progression (recognition → fill-word → fill-line → freeform), Yaegi
runs in a Web Worker for the freeform and fill-line slots, and a
module-completion screen with a one-tap share lives at the end. The
remaining gate to a public launch is the items on
[`design-docs/07-release.md`](design-docs/07-release.md)'s
pre-launch checklist — domain, OG copy review, real-device mobile
pass, Lighthouse score.

## Try it

```bash
pnpm install
pnpm dev
```

Then visit:

- `/` — landing page
- `/go` — the full Go curriculum (6 modules, 31 themes)
- `/go/foundations/variables/01` — the first exercise

Every exercise is **parameterised** — the values you see are picked
deterministically from a seed, and the "Another" button gives you a
fresh instance of the same drill without leaving the page. Progress
is tracked in `localStorage`; nothing leaves your device.

## Curriculum (Go target)

| # | Module | Themes | Status |
|---|---|---|---|
| 1 | **Foundations** | variables, numeric primitives, strings/bytes/runes, conditionals, loops, functions & multi-return | 9/9 each — complete |
| 2 | Collections | arrays vs slices, maps, iteration | scaffolded |
| 3 | Types & methods | structs, methods, pointers, nil & zero values | scaffolded |
| 4 | Interfaces & generics | interfaces, generics | scaffolded |
| 5 | Errors & packaging | (T, error), errors.Is/As, type assertions, packages, modules | scaffolded |
| 6 | Concurrency | goroutines, channels, select, sync | scaffolded |
| 7 | Idioms & ecosystem | defer, embedding, context, testing, small-interface idiom, project layout, gotchas | scaffolded |

Full curriculum at [`design-docs/10-curriculum-go.md`](design-docs/10-curriculum-go.md).

## Stack

- **[Astro 6](https://astro.build)** — content-heavy, islands-based, ships zero JS on static lessons
- **[Solid](https://www.solidjs.com)** — small reactive bundles for the interactive exercise components
- **[Tailwind 4](https://tailwindcss.com)** — CSS-first design tokens (`@theme` directives)
- **[Yaegi](https://github.com/traefik/yaegi)** compiled to WASM and run in a Web Worker — Go interpreter for freeform and fill-line grading
- **[CodeMirror 6](https://codemirror.net)** (planned) — editor for freeform code
- **pnpm**, **Vercel** for hosting

## How it's built

Each exercise is a Zod-validated YAML file under
`src/content/exercises/<module>/<theme>/<NN>.yaml` with a generator
spec. The generator types are:

- **`template`** — `${var}` substitution from per-pool value choices
- **`variant`** — pre-authored variant set (used when template substitution can't capture the variation)
- **`procedural`** *(planned)* — algorithmic generation for the most-drilled themes

The exercise *type* (`mcq` / `fill-word` / `fill-line` / `freeform`)
determines which Solid component renders it; all four share an
`ExerciseShell` chrome and a `useExercisePhase` lifecycle hook so the
mechanics stay consistent across types.

Design rationale and the longer-form decisions live in
[`design-docs/`](design-docs/):

| Doc | Question it answers |
|---|---|
| [`01-vision.md`](design-docs/01-vision.md) | What is typeover, who is it for, why does it exist? |
| [`02-pedagogy.md`](design-docs/02-pedagogy.md) | How does typeover actually teach? Theme vs lesson; exercise progression. |
| [`03-stack.md`](design-docs/03-stack.md) | Why Astro + Solid + Tailwind + Vercel + pnpm? |
| [`04-runtime-strategy.md`](design-docs/04-runtime-strategy.md) | How do we run Go in the browser? Yaegi tradeoff and fallback. |
| [`05-design-system.md`](design-docs/05-design-system.md) | What does typeover look like, and what's the design-system contract? |
| [`06-voice-and-feedback.md`](design-docs/06-voice-and-feedback.md) | How does typeover speak to learners? Failure UX, hints, reveals. |
| [`08-accessibility-and-mobile.md`](design-docs/08-accessibility-and-mobile.md) | A11y commitments + full mobile support. |
| [`09-authoring.md`](design-docs/09-authoring.md) | Community-friendly authoring: lesson template, schema, generator types. |

## Contributing

Yes please. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup,
authoring conventions, and the bar for new exercises.

The schema is community-friendly *by design* — every exercise is a
single YAML file with a documented shape, the generator does the
randomisation, and the rendering layer is shared. The most useful
contributions right now are:

1. Authoring exercises for unwritten themes (Modules 2–7 are
   scaffolded but empty).
2. Improving distractors on shipped exercises — the bar is "each
   distractor fails in a *distinct* way."
3. Reviewing pedagogy: catching exercises that drill the wrong
   concept or have a leaky "least common ancestor" with prior
   themes.

## Licence

MIT — see [`LICENSE`](LICENSE).
