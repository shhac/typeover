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
**bias** that each style interprets through its own multiplier.
Concretely:

| style       | sharp | normal | rounded | pill |
|-------------|-------|--------|---------|------|
| `terminal`  | 0     | 0      | 0       | 0    | (style refuses the axis)
| `cardboard` | 1px   | 4px    | 8px     | 14px | (axis + 1 step)
| `textbook`  | 0     | 0      | 0       | 0    | (refuses, like terminal)
| `glass`     | 2px   | 6px    | 14px    | 24px | (amplifies the axis)
| `islands`   | 3px   | 6px    | 12px    | 20px | (amplifies modestly)

Document the contract: "shape axis applies under glass / islands /
cardboard. Under terminal / textbook it's a no-op." Either accept
the refusal or grey out the radius radio when those styles are
active — small UI follow-up.

## Per-style synthesis

### `terminal` — Bloomberg / phosphor CRT

Mono everywhere. Type, not chrome, carries the structure.

- **Typography**: `--font-heading: var(--font-mono)`. Headings drop
  to weight 500. All-caps eyebrows. Heading scale **compresses** —
  4xl → ~28px, 2xl → 18px. Body keeps Inter 16px.
- **Border**: hairline `1px solid --color-border-default` only.
  No shadow. No texture beyond optional faint scanline pattern.
- **Radius**: **forced to 0** regardless of axis (see table above).
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
- **Radius**: **forced to 0** regardless of axis. Books don't
  curve.
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

Six additions to make the rebind work without touching components:

| token | default | who uses |
|---|---|---|
| `--font-body`           | `var(--font-sans)`     | `body` element |
| `--heading-weight`      | `600`                   | `.ds-heading-font` |
| `--measure`             | `none`                  | `Container` max-width |
| `--border-style`        | `solid`                 | `.ds-panel` |
| `--panel-bg-mix`        | `100%`                  | `.ds-panel` background |
| (existing) `--radius-*` | per shape axis          | already wired |

Plus the per-style nested selectors that override `--radius-*`
when shape + style combine — small SCSS-style cascade rule:
`:root[data-style="textbook"] { --radius-sm/md/lg: 0; }` etc.

## Open questions for Paul

1. **Shape axis on terminal + textbook** — fully refuse (force 0)
   or merely cap (e.g. terminal allows up to 2px, textbook up to
   1px)? The lens majority said refuse.
2. **Light theme for cardboard + textbook** — both want strong
   palette shifts (kraft / parchment). Are those colour swaps
   in-scope for the rebind, or do they belong as separate
   sub-theme variants (`light-cardboard-kraft`, etc.)?
3. **Heading weight token** — adopt `--heading-weight` per style
   or split per heading level (h1 / h2 / h3)?
4. **`Container` becomes style-aware** via the `--measure` token.
   Currently `Container width="default|wide"` is the only knob.
   Add `width="measure"` consuming the new token, or have
   `width="default"` consult `--measure` if set?
5. **Drop-caps in textbook** — proposal mentions
   `::first-letter` rules on Panel children. Worth it, or
   over-clever?

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
