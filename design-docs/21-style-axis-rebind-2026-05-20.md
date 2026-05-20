# 21 — Style axis rebind (RFC, 2026-05-20)

## Why

The Style axis currently changes shadows + a subtle background pattern.
That's too timid — flipping styles on `/settings` doesn't *feel* like
five distinct documents. The user asked for radical differences: some
styles drop boxes/borders entirely, fonts change, radius semantics
change, alignment changes, even what "light/dark" means may shift.

5 design-lens subagents proposed full rebinds (Bloomberg terminal,
editorial magazine, brutalist web, skeumorphic, Swiss/Bauhaus).
Transcripts in `tmp/tasks/`. This doc is the **synthesis** I'd ship,
pending Paul's review.

## The load-bearing move: shape axis bends per style

Today the shape axis is independent: pick `pill`, every component
gets a 2× radius. After this rebind, the shape axis becomes a
**bias** that each style interprets through its own scaling.
Concretely (locked 2026-05-20 with Paul):

| style       | sharp | normal | rounded | pill |
|-------------|-------|--------|---------|------|
| `terminal`  | 0     | 2px    | 4px     | 8px  | (gentle progression, never round)
| `cardboard` | 1px   | 4px    | 8px     | 14px | (axis + 1 step — paper-corner soft)
| `textbook`  | 0     | 0      | 2px     | 4px  | (resists curves; only `rounded`/`pill` peek through)
| `glass`     | 2px   | 6px    | 14px    | 24px | (amplifies the axis — glass loves curves)
| `islands`   | 3px   | 6px    | 12px    | 20px | (amplifies modestly — objects in space)

Three styles (cardboard / glass / islands) honour the axis with
their own multipliers; two (terminal / textbook) keep the axis
present but compressed — the user can still feel the picker move,
but the style's character dominates.

## Per-style synthesis

### `terminal` — Bloomberg / phosphor CRT

Mono everywhere. Type, not chrome, carries the structure.

- **Typography**: `--font-heading: var(--font-mono)`. Headings drop
  to weight 500. All-caps eyebrows. Heading scale **compresses** —
  4xl → ~28px, 2xl → 18px. Body keeps Inter 16px.
- **Border**: hairline `1px solid --color-border-default` only.
  No shadow. No texture beyond optional faint scanline pattern.
- **Radius**: compressed progression `0 / 2 / 4 / 8` — axis still
  felt but capped well below today's `pill` (8px instead of 24px).
- **Container**: narrows to `--measure: 68ch`.
- **Palette**: untouched — this is the identity floor.
- **Token overrides**: `--font-heading`, `--radius-sm/md/lg`,
  `--shadow-panel: none`, `--surface-pattern: none`, `--measure`.

### `cardboard` — kraft folder with dashed seams

Today's warm-paper bias was the right direction; push to physical.

- **Typography**: `--font-heading: "Source Serif Pro", serif` at
  weight 700. Body stays Inter. Slight letter-spacing tighten on
  display sizes.
- **Border**: replaced with a **dashed inner stitch** in
  `--color-accent-amber` at 35% mix, plus a 1px hard outer cut.
  `border-style: dashed` consumed via a new `--border-style` token.
- **Radius**: **axis + 1 step** — paper doesn't have knife-edges
  or pill capsules.
- **Container**: narrows slightly to `--measure: 64ch`.
- **Palette**: deepen the warm tilt. Dark: `--color-bg-base
  #1a1410`, `--color-fg-primary #e8d9c2`. Light: kraft
  `--color-bg-base #e8dec7`, `--color-fg-primary #2a1f15`. Amber
  desaturates slightly.
- **Token overrides**: `--font-heading`, `--color-bg-base/panel/
  elevated`, `--color-fg-primary`, `--border-style: dashed`,
  `--shadow-panel` (dashed inset + 1px fold), `--surface-pattern`
  (keep existing stipple), `--radius-*` (axis + 1).

### `textbook` — Manutius octavo, serif everywhere

The strongest convergence. Real textbooks don't have rounded
paragraphs; they have a reading column, serif body, hanging amber
rule, parchment surface.

- **Typography**: **serif body too**, not just headings. New
  `--font-body: var(--font-serif)`. Body climbs to 17px /
  line-height 1.65. Heading scale **expands** — 4xl → 44px.
- **Border**: removed. Single 4px amber left-rule on Panels
  (existing `--shadow-panel: inset` shape). No box.
- **Radius**: heavy compression `0 / 0 / 2 / 4` — `sharp` and
  `normal` are identical (both 0); `rounded` and `pill` peek
  through with a hint of curve so the axis isn't a complete no-op
  but the textbook character dominates.
- **Container**: narrows to `--measure: 60ch` (the reading
  measure).
- **Palette**: parchment bias. Light: `--color-bg-base #faf6ef`,
  ink `--color-fg-primary #1a1a1a`. Dark: aged-paper
  `--color-bg-base #1a1612`, cream `--color-fg-primary #e8dcc4`.
  `--color-accent-amber` dims to `#c97e1a` (ink-y, not CRT).
- **Token overrides**: `--font-heading`, `--font-body`,
  `--color-bg-base`, `--color-fg-primary`, `--color-accent-amber`,
  `--radius-*: 0`, `--shadow-panel` (left-rule only),
  `--measure: 60ch`.

### `glass` — Rams T1000 / Aqua honest about its transparency

Strip borders, amplify radius, lean harder into the radial body
backdrop already shipped.

- **Typography**: sans throughout, `--font-heading` weight
  **300** — light type reads as glass. Letter-spacing opens
  slightly (`+0.01em`).
- **Border**: replaced with a **1px gradient hairline** via
  `border-image`. Top-edge highlight is the chrome.
- **Radius**: **amplified** — see table. Glass loves curves.
- **Container**: widens to `--measure: 80ch`. The blur needs
  page to chew on.
- **Palette**: panel transparency drops from 80% to 60% via
  `color-mix`. Body keeps the existing amber + TS radial gradient.
  `--color-border-default: transparent`. `--panel-backdrop-filter`
  bumps to `blur(20px) saturate(180%)`.
- **Token overrides**: `--color-bg-panel/elevated` (transparency
  mix), `--color-border-default: transparent`,
  `--panel-backdrop-filter`, `--shadow-panel` (gradient hairline +
  soft drop), `--radius-*` (amplified), `--font-heading`,
  `--heading-weight: 300`, `--measure: 80ch`.

### `islands` — App Store / brushed-aluminum tiles on felt

Push past "drop shadow on a card" into objects-on-a-desk.

- **Typography**: sans, `--font-heading` weight **700**,
  letter-spacing `-0.02em`. Confident headings carry the page;
  body unchanged.
- **Border**: removed (`--color-border-default: transparent`).
  Lift comes from shadow + tonal surface contrast.
- **Radius**: **amplified modestly** — see table.
- **Container**: default width. Panel `gap` increases so islands
  breathe vertically.
- **Palette**: **deepen the page vs panel delta**. Dark: page
  drops to `#050506`, panel keeps `#1a1a1d` (more contrast).
  Light: page shifts to neutral grey `#e8e8ea` (felt), panel
  stays near-white. Optional subtle felt-noise body pattern.
- **Token overrides**: `--color-bg-base` (deepen),
  `--color-bg-panel` (contrast brighten), `--color-border-default:
   transparent`, `--shadow-panel` (existing layered drop +
  inner-top highlight, keep), `--shadow-island`, `--radius-*`
  (amplified), `--font-heading`, `--heading-weight: 700`.

## New @theme tokens this needs

Locked after Paul's answers:

| token                     | default              | who uses |
|---------------------------|----------------------|----------|
| `--font-body`             | `var(--font-sans)`   | `body` element |
| `--heading-weight-base`   | `600`                | `.ds-heading-font` (per-level scaled) |
| `--heading-scale-h1`      | `1.0`                | h1 weight = base × scale, rounded to nearest 100 |
| `--heading-scale-h2`      | `0.85`               | h2 |
| `--heading-scale-h3`      | `0.7`                | h3 |
| `--heading-scale-h4`      | `0.55`               | h4 |
| `--measure`               | `none`               | `Container` max-width, consumed by `width="default"` |
| `--border-style`          | `solid`              | `.ds-panel` |
| `--panel-bg-mix`          | `100%`               | `.ds-panel` background |
| (existing) `--radius-*`   | per shape axis       | already wired |

Plus the per-style nested selectors that override `--radius-*`
based on the shape × style table (e.g.
`:root[data-style="terminal"][data-radius="pill"] { --radius-md: 8px; }`).

Heading weight derivation is done in CSS: each `.ds-heading-font`
rule reads `calc(var(--heading-weight-base) * var(--heading-scale-h1))`
and rounds to the nearest 100 (CSS `font-weight` legal values).
Per-level scalars are constants on `@theme`; the base is what
each style rebinds.

## Decisions (locked with Paul, 2026-05-20)

1. **Shape axis on terminal + textbook** — neither fully refuses;
   compressed progression instead. Terminal: `0 / 2 / 4 / 8`.
   Textbook: `0 / 0 / 2 / 4`. See table above.
2. **Palette as a first-class axis** — yes, but as a follow-up
   pass after this rebind ships. See "Follow-up: palette as a
   first-class axis" below.
3. **Heading weight** — style sets the **base weight** + per-level
   scalar. New tokens: `--heading-weight-base` (the style's
   default) + per-level scalars `--heading-scale-h1/h2/h3/h4`
   that multiply (or rather pick from a sparse map e.g.
   `{ h1: base, h2: base - 100, h3: base - 200, ... }`). One
   style-level knob, derived per-level weights. Default scalars
   are `1.0 / 0.85 / 0.7 / 0.55` of base, clamped to CSS
   `font-weight` valid range (100-900 in 100 steps after
   rounding).
4. **`Container` consume `--measure`** — let the existing
   `width="default"` consult `--measure` when the token is set;
   styles that don't override `--measure` get today's behaviour.
   No new prop. Less DS surface, same expressiveness.
5. **Drop-cap-lite in textbook** — adopted at half strength
   (Paul's compromise: skip the `float`). A traditional drop-cap
   wraps multiple lines around the giant first letter via
   `float: left`; that requires the containing element to be a
   clean paragraph stream, which Panels don't guarantee. The
   compromise: scale the first letter ~1.5×, bump weight, keep
   `line-height: 1`. The line containing the bigger letter
   grows vertically; subsequent lines flow normally. Worst case
   the selector matches no `<p>` and the rule is a no-op.
   Scoped to `[data-style="textbook"]` only.

   ```css
   :root[data-style="textbook"] .ds-panel > p:first-of-type::first-letter,
   :root[data-style="textbook"] .ds-prose > p:first-of-type::first-letter {
     font-size: 1.5em;
     font-weight: 600;
     line-height: 1;
   }
   ```

## Follow-up: palette as a first-class axis

Paul's ask: "After this I want us to first-class palettes so a
style comes with a default palette but the user can override the
palette with custom choices (or pick from a predefined set that
each style offers maybe)."

This is bigger than the style rebind itself. Recording the shape
here so the rebind doesn't pre-empt it; will land as its own RFC
(provisional `22-palette-axis-rebind`).

### Proposed shape

- New axis: `data-palette` on `<html>`, alongside the four
  existing axes (theme / density / radius / style).
- Each palette is a CSS-variable override block (the same
  mechanism the existing dark / light themes use).
- Each style declares a **default palette** + an **allowed
  list** of compatible palettes. E.g.:
  - `terminal` → default `phosphor-amber`, alternatives
    `phosphor-green`, `phosphor-white`, `ice-blue`.
  - `cardboard` → default `kraft-warm`, alternatives `manila`,
    `denim-grain`, `cardboard-print` (light).
  - `textbook` → default `parchment-ink`, alternatives
    `vellum`, `midnight-vellum`, `sepia`.
  - `glass` → default `aurora-amber` (today's radial), alts
    `glacier-blue`, `monochrome`.
  - `islands` → default `desk-felt`, alternatives `app-store`,
    `dark-wood`.
- Pinned via `localStorage["typeover:palette"]`; absent ⇒
  follow the active style's default.
- Settings page gets a fifth radio group "Palette" whose options
  are filtered by the currently-selected style (a palette
  ratified for the active style only).

### What this changes for the rebind

Stuff currently buried inside each style's `:root[data-style]`
block (the warm-cream `--color-bg-base`, the desaturated amber
for textbook, the kraft surfaces for cardboard, the deepened
page-vs-panel delta for islands) moves OUT of the style block
and INTO the palette block. The style block keeps the
*non-palette* moves (typography, radius rebind, border style,
shadow chrome, measure).

This is actually cleaner because today's `data-theme="light"`
overrides inside a `data-style="cardboard"` page have to fight
the style's own warm-tilt overrides (cascade ordering matters).
Splitting palette out makes the four axes truly orthogonal.

### What this means for the existing `data-theme` axis

Open question for the palette RFC: does `data-theme` (dark /
light) survive, or does it fold into palette? Options:
- **Survives as a meta-axis**: `data-theme` picks between two
  palettes within a style's allowed list (each style declares a
  dark-default + light-default pair).
- **Folds in**: drop `data-theme`; each palette is its own
  thing; "system" mode resolves to a per-style default-pair.

Recommend the first (lower-disruption); to be settled in the
palette RFC.

### Implementation order

1. Ship the style rebind in this RFC (typography, borders,
   radius bending, measure, heading weights).
2. Pause; let Paul live with the result.
3. THEN do the palette axis as its own RFC, refactoring colour
   overrides out of style blocks into palette blocks.

This ordering means the rebind ships with palette colours still
encoded per-style — duplicating some work — but avoids
blocking the rebind on the bigger palette design.

## Implementation plan (after Paul signs off)

1. Add the six new `@theme` tokens with conservative defaults.
2. Rewrite the five `:root[data-style="..."]` blocks in
   `global.css` with the per-style overrides above.
3. Update `Container.tsx` to consume `--measure` (one new prop
   value or conditional).
4. Update `.ds-panel` to read `--border-style` and
   `--panel-bg-mix` (small CSS-only change).
5. Update `Heading.tsx` or `.ds-heading-font` rule to read
   `--heading-weight` and `--font-heading`.
6. Capture five-corner screenshots per style for review.
7. axe-core a11y pass on each (existing harness in
   `src/a11y.test.tsx` extends naturally).

## Out of scope (for this rebind)

- High-contrast themes (`hc-dark`, `hc-light`) — separate doc.
- Per-style icon weights (proposal touched it, defer).
- Per-style animation differences (proposal stayed silent — keep
  the current minimal-animation contract).
- A new style. Five is plenty.

---

Lens transcripts (for reference, in iteration tmp): Bloomberg
terminal, editorial magazine, brutalist web, skeumorphic, Swiss
Bauhaus. Each is in the agent output files under
`/private/tmp/claude-501/.../tasks/`.
