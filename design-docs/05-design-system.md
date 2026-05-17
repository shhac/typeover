# 05 — Design system

## Aesthetic

Three influences, in priority order:

1. **Bloomberg Terminal** — dark surfaces, monospace-first, amber accents,
   sharp corners, information density. The terminal aesthetic signals
   "professional tool, not toy."
2. **TypeScript docs** — clean blue accents, readable typography for prose
   sections.
3. **Go docs (`pkg.go.dev`)** — cyan/teal accents (Go brand `#00ADD8`),
   minimal chrome, content-first layout.

The combination resolves naturally: **dark Bloomberg-style chrome** as the
shell, **TS blue and Go cyan** as language-coded accents inside lesson
content, **amber** for focus / active / "look here" affordances.

## Tokens

Defined in `src/styles/global.css` under `@theme`:

- **Surfaces:** `bg-base`, `bg-panel`, `bg-elevated`, `bg-inset` (graduated
  near-black; `bg-base` is `#0a0a0b`, never pure `#000` to reduce eye
  strain on long sessions).
- **Borders:** `border-default`, `border-strong`, `border-accent` (the last
  reserved for hovered/active emphasis).
- **Text:** `fg-primary`, `fg-secondary`, `fg-muted`, `fg-faint` — four
  steps, used consistently so layout hierarchy reads at a glance.
- **Accents:** `accent-amber`, `accent-ts`, `accent-go`, each with a `-dim`
  variant for de-emphasised states.
- **State:** `success`, `warning`, `error`.
- **Type:** `font-mono` (JetBrains Mono primary), `font-sans` (Inter).
- **Radius:** 2–4 px, never larger. Sharp corners are part of the look.

## Component principles

1. **One component per file.** Each file in `src/components/ds/` owns one
   concept. The barrel export in `index.ts` is the consumption surface.
2. **Solid throughout.** Even purely-presentational components are `.tsx`
   in Solid, so they can be hydrated as islands when needed without
   refactoring.
3. **Props closed at compile time.** Variants are string-literal unions
   keyed into class lookup tables. No `cva` library — the lookup is
   trivial and the lookup pattern is more readable than another DSL.
4. **Compose with `splitProps`.** Keep custom props out of the underlying
   DOM element; everything else passes through via `{...rest}`.
5. **Tailwind utilities, not custom CSS classes.** The design system is
   the named-token layer; tailwind is the assembly layer.
6. **Mono is the default for code, badges, button labels.** Sans for
   reading prose. This makes language switches visually obvious.

## Components shipped in v0

| File | Purpose |
|---|---|
| `Container.tsx` | Width-constrained centered column. |
| `Stack.tsx` | Flex layout primitive (row/col + gap). |
| `Heading.tsx` | h1–h4 with optional accent colour. |
| `Text.tsx` | Body text with tone + size + family. |
| `Panel.tsx` | Bordered card with optional Bloomberg-style label strip. |
| `Badge.tsx` | Inline label, including TS/Go language flags. |
| `Button.tsx` | Primary / secondary / ghost / danger × sm/md/lg. |
| `CodeBlock.tsx` | Display-only code with language strip + filename. |
| `Kbd.tsx` | Keyboard key indicator. |
| `Divider.tsx` | Horizontal/vertical rule. |
| `index.ts` | Barrel export. |

## Components yet to build

These will arrive as the corresponding pages need them:

- `Quiz/MultipleChoice` — radio list with feedback states
- `Quiz/TileFill` — DnD slot filler
- `Quiz/ConstrainedWrite` — CodeMirror + submit/feedback
- `Runner` — CodeMirror + worker-backed run button + output console
- `Nav`, `Breadcrumb`, `ProgressBar`, `Toast`

## Rules for adding components

- A new component goes in `src/components/ds/` only if it's a reusable
  primitive. Page-specific composition stays in `src/pages/` or
  `src/components/<feature>/`.
- Any new colour or spacing token goes in `@theme` first, not inline.
- Any new variant goes in the component's class-lookup table; don't
  branch with conditionals inside JSX.
- If two components share more than ~30 lines of logic, extract a third.
