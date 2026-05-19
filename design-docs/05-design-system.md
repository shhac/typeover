# 05 — Design system

## Aesthetic

Three influences blend into one resolution:

1. **Bloomberg Terminal** — dark surfaces, amber accent, monospace-first
   identity. Signals "professional tool."
2. **TypeScript docs** — blue accent; clean prose blocks.
3. **Go docs (`pkg.go.dev`)** — cyan accent; content-first chrome.

The resolution is **dark Linear, not Bloomberg-tight**. We keep Bloomberg's
identity (dark base, amber accent, mono-first, sharp corners), but we
adopt **airy Stripe/Linear-style spacing and density**.

Concretely:

- Generous whitespace, not terminal-tight.
- Base font 15–16px, not 11–12px.
- Borders are selective — present on code blocks and exercise containers,
  absent where spacing + typography already establish hierarchy.
- **Language colour is liberal**: TS blue and Go cyan appear wherever the
  language is referenced (headings, badges, code blocks, prose mentions).
  This is the strongest visual identity moment of the site.

## Layout philosophy

Adaptive by default:

- **≥ 1024px:** side-by-side TS/Go for exercises and comparisons.
- **< 1024px:** stacked TS over Go. No information loss; readability
  preserved.

A single `Adaptive` layout primitive in the DS encapsulates the breakpoint
so pages don't write media queries.

## A11y contract

**Every component in `src/components/ds/` is WCAG 2.2 AA by default.**

See [08-accessibility-and-mobile.md](08-accessibility-and-mobile.md) for
the full contract. Headline rules:

- Semantic HTML.
- Visible focus rings.
- Keyboard operable.
- Contrast verified at the token level.
- No colour-only signal.
- Touch targets ≥ 44px.
- Honour `prefers-reduced-motion`.

A page composed entirely of design-system primitives is a11y-correct
without further work. A page is not allowed to compose primitives in a
way that *breaks* a11y (e.g. nested interactive elements).

## Tokens

Defined in `src/styles/global.css` under `@theme`. The token *names*
are the contract — every component reads from them, never from a
literal. That's what makes themes (see
[13-themes.md](13-themes.md)) one-override-block work.

Surface tokens graduate near-black to slightly-elevated:

- `bg-base`, `bg-panel`, `bg-elevated`, `bg-inset`

Foreground tokens step from primary to faint:

- `fg-primary`, `fg-secondary`, `fg-muted`, `fg-faint`

Border tokens for two strengths plus an accent variant:

- `border-default`, `border-strong`, `border-accent`

Accent tokens — three colours, each with a dimmed variant for
de-emphasised states:

- `accent-amber` (Bloomberg identity, focus / active / primary actions)
- `accent-ts` (`#3178c6` — TypeScript blue)
- `accent-go` (`#00add8` — Go cyan)

State tokens:

- `success`, `warning`, `error`

Type tokens:

- `font-mono` (JetBrains Mono primary)
- `font-sans` (Inter)

Radius tokens (2–4px in the default `normal` shape preset; rebound
by the shape axis in [14-stylistic-themes.md](14-stylistic-themes.md)):

- `radius-sm`, `radius-md`, `radius-lg`

Spacing scale: Tailwind 4's `--spacing` knob (default `0.25rem`).
Rebound by the density axis in
[14-stylistic-themes.md](14-stylistic-themes.md); component code
never writes pixel-literal padding/margin.

## Component principles

1. **One concept per file.** Barrel-exported from `ds/index.ts`.
2. **Solid throughout.** Components are `.tsx` so any can hydrate as an
   island.
3. **Props closed at compile time.** Variants are string-literal unions
   keyed into class lookup tables.
4. **Compose with `splitProps`.** Custom props stay out of the DOM.
5. **Tailwind utilities, not custom CSS.** The DS is the named-token
   layer; Tailwind is the assembly layer.
6. **Mono for code, badges, button labels.** Sans for reading prose.

## Components

Shipped in v0 (initial set, will be retuned for airy direction):

| File | Purpose |
|---|---|
| `Container.tsx` | Width-constrained centered column. |
| `Stack.tsx` | Flex layout primitive (row/col + gap). |
| `Adaptive.tsx` | Split-on-wide, stack-on-narrow layout primitive. |
| `Compare.tsx` | `<figure>` + `<figcaption>` wrapper for TS↔Go side-by-side (design-docs/15 pattern 4). |
| `Heading.tsx` | h1–h4 with optional accent colour. |
| `Text.tsx` | Body text with tone + size + family. |
| `Eyebrow.tsx` | Small mono uppercase section label (design-docs/15 pattern 1). |
| `Panel.tsx` | Bordered container with optional label strip. Reserve `label`-strip use for framing, not grouping. |
| `Badge.tsx` | Inline label, including TS/Go language flags. |
| `Button.tsx` | Primary / secondary / ghost / danger × sm/md/lg. |
| `CodeBlock.tsx` | Display-only code with language strip + filename. |
| `Kbd.tsx` | Keyboard key indicator. |
| `Divider.tsx` | Horizontal/vertical rule. |
| `Feedback.tsx` | Correctness banner with `aria-live`. |
| `HintButton.tsx` | 3-layer hint reveal with escalation. |
| `RevealButton.tsx` | "Show canonical" / "Reveal diff" with destructive-action confirmation. |
| `LangCrumbs.tsx` | TS → arrow → Go breadcrumb strip; takes extras via `children`. |
| `ProgressChip.tsx` | Pure mono "passed/total" chip (theme variant) or "seen N · passed M" (exercise variant). No localStorage — see `src/components/progress/` for the hydrated wrappers. design-docs/11. |

Planned for v0 (still to be added):

| File | Purpose |
|---|---|
| `Choice.tsx` | Radio-style option for MCQ exercises. *(MCQ today renders via `McqOption.tsx` in `src/components/exercise/`; the DS-layer extraction is deferred until another caller appears.)* |
| `Tile.tsx` | Drag-and-drop tile for fill-in-the-blank exercises. *(Retired — fill-line redesign moved off the tile UX; see design-docs/99 fill-line entry.)* |
| `MobileKeyBar.tsx` | Symbol bar above the editor on small screens. *(Surfaced as a concrete proposal 2026-05-19 — see design-docs/99 for the proposed shape; pickup gated on real-device mobile QA.)* |
| `ProgressBar.tsx` | Theme/module progress indicator. *(Parked — see design-docs/11; `<ProgressChip>` covers the v0 surface and a bar would invite the gamification creep the project's posture rejects.)* |

## Deferred: generic `Crumbs` two-badge breadcrumb

`LangCrumbs` is currently a Solid component that bakes in TS/GO badge
content. The badge → arrow → badge pattern now has three callers (TS/GO
strip on the home + curriculum pages, module → theme on the theme
overview, module → theme · exercise N · type on the exercise page). A
generic `Crumbs` taking `left`/`right` JSX-element props + extras
children is the natural extraction.

**Blocker:** Astro's template parser doesn't accept nested component
JSX inside attribute-value braces — `left={<Badge variant="amber">…</Badge>}`
fails with "Expected '>' but found 'variant'" because Astro's parser
disallows component tags inside `{...}` expressions in templates. The
Solid component `Crumbs.tsx` works in pure JSX but not when called
from .astro pages, which is where every breadcrumb consumer lives.

**Path forward (when revisited):**

1. Convert `Crumbs` and `LangCrumbs` to `.astro` files using named
   slots (`<slot name="left" />` / `<slot name="right" />`). Astro's
   slot mechanism is the idiomatic shape for multi-region container
   components.
2. Both files would render their Stack + arrow chrome in Astro and
   take Solid `<Badge>` children naturally via the slot mechanism.
3. Migrate the two `[module]/[theme]/...` Astro pages to use the new
   `Crumbs` component (currently inline Stack + Badge + Text).

Pickup criteria: when (a) a fourth call site lands, OR (b) a chrome
change (arrow glyph swap, separator dot, etc.) would need to be
applied at all three call sites.

## Rules for adding components

- New primitive in `src/components/ds/` only if it's reusable.
  Page-specific composition stays in `src/pages/` or
  `src/components/<feature>/`.
- New tokens go in `@theme` first, never inline.
- **Every colour goes through a token.** Never write `#hex`,
  `rgb(…)`, `text-white`, `bg-zinc-…`, or any literal colour in a
  class. If the colour you need doesn't exist as a token, add it to
  `@theme` first. This is what keeps the "one override block adds a
  theme" contract in [13-themes.md](13-themes.md) honest. Reviewers
  grep for hex literals + Tailwind built-in colour utilities at
  every code-structure pass.
- New variants go in the lookup table, no conditional logic in JSX.
- Components must be a11y-correct on first commit; we do not add a11y
  later as a polish pass.
