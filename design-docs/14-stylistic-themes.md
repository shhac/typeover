# 14 — Stylistic themes (density + shape + style)

Four theme **axes**, each independently set by the learner:

1. **Colour** — `dark` / `light` (today) + `hc-*`, `sepia`, etc. (parked).
   See [13-themes.md](13-themes.md).
2. **Density** — `compact` / `normal` / `airy`. How much whitespace
   the site uses. *This doc.*
3. **Shape** — `sharp` / `normal` / `rounded` / `pill`. How rounded
   the corners are. *This doc.*
4. **Style** — `terminal` (default) / `cardboard` / `textbook` /
   `glass` / `islands`. The aesthetic "feel" of surfaces and
   chrome, composed on top of the other three axes. *This doc;
   proposed 2026-05-20, not yet implemented.*

The four axes compose: a learner can run `dark` + `compact` +
`rounded` + `glass` if that's what reads best to them. The DS holds
the contract that any combination just works.

## Why two new axes

The colour theme handles "does the site look like a terminal or a
notebook?". It doesn't handle two adjacent questions that keep
coming up in feedback:

- **"How much information per screen?"** Bloomberg-tight terminal
  users want denser; Stripe-Press readers want airier. Today the
  site is "airy Linear-style" only.
- **"How sharp is too sharp?"** The current 2–3px radius is sharp
  on purpose. For some learners that reads as cold; rounded edges
  read as friendlier. We don't want to force one answer.

Both questions are stylistic, not semantic — neither changes
what colour means "wrong" or "focused." So they belong on their
own axes, not shoehorned into the colour theme catalogue.

## The contract (one sentence)

**Adding a new density or shape preset is one override block in
`global.css` plus one entry on the picker. No component change.**

Same contract as colour themes. Same enforcement: every component
reads from the tokens; no literal spacing/radius values inside
component files.

## Mechanism

Two `data-*` attributes on `<html>`:

```html
<html data-theme="dark" data-density="normal" data-radius="normal">
```

CSS custom properties cascade. Tailwind 4 utilities compile against
the same vars, so the swap is atomic.

### Density — one knob, many utilities

Tailwind 4 expresses every spacing utility as a multiple of the
`--spacing` custom property:

```css
.p-4   { padding: calc(var(--spacing) * 4); }
.gap-6 { gap:     calc(var(--spacing) * 6); }
```

So changing `--spacing` at the `:root[data-density="…"]` level
scales every margin, padding, and gap in the codebase at once.
That's the same one-knob bet the colour theme makes against
`--color-*`.

```css
@theme {
  /* normal — current default */
  --spacing: 0.25rem;     /* 1 unit = 4px */
}

:root[data-density="compact"] {
  --spacing: 0.2rem;      /* 1 unit = ~3.2px (-20%) */
}
:root[data-density="airy"] {
  --spacing: 0.32rem;     /* 1 unit = ~5.1px (+28%) */
}
```

The percentages are tuned so:

- **compact** stops *just* before WCAG 2.2 SC 1.4.12 "Text Spacing"
  becomes a worry. Touch-target floor (44×44px) is enforced at the
  *component* level with explicit `min-h-11`, so density can't
  shrink interactives below the a11y floor — only the spacing
  around them.
- **airy** widens the air without making the site feel like a
  brochure. ~+28% gives noticeable breathing room without
  doubling page height.

No tokens get specific names per density — there's one knob.
That's the point.

### Shape — three radii rebound at once

The DS already names three radius tokens:

```css
@theme {
  --radius-sm: 2px;
  --radius-md: 3px;
  --radius-lg: 4px;
}
```

The shape theme rebinds the three at once:

```css
:root[data-radius="sharp"] {
  --radius-sm: 0px;
  --radius-md: 1px;
  --radius-lg: 2px;
}
:root[data-radius="rounded"] {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
:root[data-radius="pill"] {
  /* Even rounder than "rounded" — proposed 2026-05-20. Small
   * UI lands as pills; large surfaces approach half-height
   * curvature, but the tokens stay finite (no 9999px) so
   * touch-target visuals don't explode unexpectedly. */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
}
```

The component layer doesn't change — every `rounded-sm` /
`rounded-md` / `rounded-lg` already reads through these.

### Style — surface aesthetic, composed on top

*Proposed 2026-05-20, not yet implemented.*

The previous axes change measurements (spacing, radii); the
**Style** axis changes the *aesthetic vocabulary* of surfaces and
chrome — borders, shadows, textures, accent shapes — without
changing what anything means. A "Glass" learner and a "Cardboard"
learner read the same content under different visual feels.

Catalogue (in launch order):

#### `terminal` (default, today)

The current Bloomberg-meets-airy-Linear aesthetic. Hairline
borders only; flat surfaces; no shadows except focus rings; mono
accents (filename strips, eyebrow labels). This is what every
shipped page is right now. It becomes the default of the Style
axis, named explicitly so other styles know what they're
diverging from.

#### `cardboard`

Warm off-white-on-brown surfaces with very subtle paper-grain
cues (low-noise `background-image` pattern). Borders soften
into recessed `inset` shadows that read as folded-paper edges.
Tokens (proposed):

```css
:root[data-style="cardboard"] {
  --surface-pattern: url("/textures/paper-grain.svg");
  --shadow-panel: inset 0 0 0 1px var(--color-bg-inset),
                  0 1px 0 var(--color-bg-elevated);
  /* warm-tilt overrides for the colour tokens go here, but the
   * dark/light axis still provides the floor — cardboard's
   * "warm tilt" is in addition to whichever colour is active */
}
```

#### `textbook`

Cleaner, almost-academic feel. Single hairline left-rule on
section blocks (margin-only emphasis); restored serif on prose
headings (`--font-serif: "Source Serif Pro"`); code blocks
inherit a subtle yellow-tape gutter to read like an annotated
textbook page.

#### `glass`

Translucent panels (`background: color-mix(in oklab,
var(--color-bg-panel) 80%, transparent)`); subtle
`backdrop-filter: blur(8px)`; soft drop shadows. The brand
mono-amber stays but panels feel layered above the page rather
than welded to it. Hard requirement: `backdrop-filter` is
optional polish — non-supporting browsers fall back to opaque
panels via `@supports` guard.

#### `islands`

Distinct floating cards with stronger drop shadows
(`--shadow-island: 0 8px 24px -8px var(--color-shadow-key)`).
Panels physically separate from the page background, breathing
on all sides. Reads modern-app rather than terminal.

### Style contract

**Each style adds at most three token overrides + one optional
texture URL.** No JS, no component-level conditionals, no
per-style component code. If a style needs the DS to know what
style is active (e.g. to swap a Tailwind class), the DS has
leaked — styles are a token-layer concern only.

The component layer reads `--shadow-panel`, `--shadow-island`,
`--surface-pattern`, `--border-style` etc. as it already reads
`--color-bg-panel`. New tokens introduced by the style axis go
in `@theme` first with the `terminal` default values; each
`:root[data-style="…"]` block re-binds them.

### What Style does *not* do

- **Doesn't introduce new component variants** beyond what the
  token set provides. A "card" looks different under glass and
  cardboard because the *shadow token* changed, not because the
  Card component branches on style.
- **Doesn't fight the colour axis.** Cardboard isn't an
  alternative to "light" — it's "light + warm-paper" or
  "dark + warm-paper" depending on the colour axis. The same
  amber stays amber; the same Go cyan stays Go cyan.
- **Doesn't replace the visual identity.** Mono-amber-on-near-
  black is typeover's identity floor; styles are surface-level
  variations, not rebrands.

### What density / shape do *not* touch

- **Colours.** Tokens stay where they are; density doesn't dim
  amber, shape doesn't round colour identity.
- **Type scale.** Font sizes don't scale with density. The
  reasoning: shrinking type to compress space goes wrong fast
  (a11y, mobile). Compact compresses *air around the type*, not
  the type itself.
- **Touch targets.** A11y floor (44×44px) is enforced at the
  component level via explicit `min-h-11`; compact density can
  not pull interactives below that.
- **Focus ring radius.** Pinned to `--radius-sm`, so it follows
  the shape axis naturally — sharp ring on `sharp`, pill ring on
  `rounded`. No special-case code.

## Defaults

- `data-density="normal"`.
- `data-radius="normal"`.

First-visit behaviour: no detection from OS-level preference
(unlike colour theme which respects `prefers-color-scheme`).
There's no platform signal for "I like airy" or "I like rounded"
— so the safe default is the current ship, and the picker exists
for opt-in.

## Persistence

Three new localStorage keys:

- `typeover:density` — `"compact"` / `"normal"` / `"airy"`
- `typeover:radius` — `"sharp"` / `"normal"` / `"rounded"` / `"pill"`
- `typeover:style` — `"terminal"` / `"cardboard"` / `"textbook"` /
  `"glass"` / `"islands"` *(reserved; not yet read)*

Same shape as `typeover:theme`. The existing bootstrap script in
`BaseLayout.astro` extends to read each key synchronously before
paint — adding `getItem` reads is cheap and keeps the no-FOUC
contract.

## Selector UX

Settings page hosts four radio groups, stacked, ordered by
impact (colour most impactful, style last):

```
Theme
  ○ System (follow OS)
  ● Dark
  ○ Light

Density
  ○ Compact
  ● Normal
  ○ Airy

Corners
  ○ Sharp
  ● Normal
  ○ Rounded
  ○ Pill

Style
  ● Terminal
  ○ Cardboard
  ○ Textbook
  ○ Glass
  ○ Islands
```

A live preview region above the radios reflects the chosen
combination. The DS gives this for free: render a Panel +
Button + Badge + CodeBlock inside the `<html>`-attribute-aware
cascade and they reflect the picker instantly. *Live preview
landed 2026-05-19.*

## DS leaks to prevent (new)

The same audit rule that protects colour themes covers shape too:
**every radius goes through a token.** No inline `rounded-[6px]`,
no `border-radius: 8px` in component CSS. If a component needs a
radius the token set doesn't offer, add the token first.

For density: **no inline pixel paddings/margins.** Tailwind
utilities (`p-4`, `gap-6`) automatically read `--spacing`. Inline
`style="padding: 12px"` bypasses the cascade and is the bug.

A future code-structure pass should grep for:
- `rounded-\[` (Tailwind arbitrary radius)
- `border-radius:\s*\d+px` (raw radius in CSS)
- `padding:\s*\d+px` (raw padding in CSS)
- `style="[^"]*(padding|margin|gap|border-radius)` (inline styles)

All three should fail. Same review-time rule as the colour audit
in 13.

## Combinations to verify before shipping

The matrix is 2 (colours, today) × 3 (densities) × 3 (radii) = 18
combinations. We don't visually QA all of them — but we do
sanity-check the corners + one middle:

- `dark` + `compact` + `sharp` — Bloomberg-terminal extreme.
- `dark` + `airy` + `rounded` — friendliest extreme.
- `light` + `compact` + `sharp` — paper-printout extreme.
- `light` + `airy` + `rounded` — Stripe-Press extreme.
- `dark` + `normal` + `normal` — the default everyone gets first.

Each corner gets one screenshot through the settings page, an
MCQ exercise, and the curriculum index. axe-core runs through the
existing harness against the default; the four corners get a
manual VoiceOver/keyboard sanity pass before exposing the picker.

## Implementation plan

Steps 1–5 landed 2026-05-19. The DS-does-the-heavy-lifting bet
held again — zero component changes, every spacing utility and
every rounded-* class picked up the swap atomically. End-to-end
verified in Chromium: clicking the picker on `/settings` flips
the `<html data-density="airy" data-radius="rounded">` attributes,
`getComputedStyle(html).getPropertyValue('--spacing')` returns
`0.32rem`, `--radius-sm` returns `4px`, and a freshly-loaded
exercise page reads the persisted pins from localStorage and
renders the cascaded `py-20` as `102.4px` (= 20 × 0.32rem).

1. ~~**Tokens** — add `--spacing` to the `@theme` block explicitly
   so a reader sees it next to the colour/radius tokens; verify
   the radius tokens already exist (they do).~~ `global.css`.
2. ~~**Override blocks** — `:root[data-density="…"]` (compact +
   airy) and `:root[data-radius="…"]` (sharp + rounded) in
   `global.css`. `normal` is the @theme default; no override block
   needed.~~ `global.css`.
3. ~~**Bootstrap script** — extend `BaseLayout.astro`'s inline
   script to read + apply `typeover:density` and `typeover:radius`
   alongside `typeover:theme`. Three pinned values resolved
   pre-paint; no FOUC on any axis.~~ `BaseLayout.astro`.
4. ~~**`src/lib/theme.ts`** — extend to expose `currentDensity()` /
   `setDensity()` and `currentRadius()` / `setRadius()` with the
   same shape as the colour API. No `system` choice for density
   or radius (no OS-level signal exists for them).~~
5. ~~**`ThemePicker.tsx` → `AppearancePicker.tsx`** — generalised
   into a `<RadioGroup>` parameterised over option list +
   getter/setter pair, then composed three times. Single picker
   surface, three axes.~~ `src/components/settings/AppearancePicker.tsx`.

Open:

6. ~~**Live-preview region** under each picker — show a Panel +
   Button + Badge + CodeBlock so the learner sees what the
   choice does without scrolling away.~~ *Landed 2026-05-19.* A
   `<PreviewSample>` block sits at the top of
   `AppearancePicker.tsx` showing a focused mini-canvas (Panel
   eyebrow + caption, Button row, Badge row + ProgressChip,
   CodeBlock). Pure DS composition — no localStorage reads, no
   Solid signals; the CSS cascade fans every picker mutation
   through every primitive at once. Lands above the radios
   rather than under each axis (proposal said "under each
   picker") because all three axes affect the same primitives —
   one canvas reads better than three repeats.
7. **axe-core a11y test across the corner combinations** — the
   four corners (compact+sharp, airy+rounded, light+sharp,
   light+airy+rounded) get a Playwright pass driven through the
   `setDensity` / `setRadius` API. Pending the same harness #32
   Lighthouse CI uses.
8. **High-contrast pair** (`hc-dark`, `hc-light`) — landed
   separately when an a11y reviewer asks; see 13-themes.md step 7.

The DS-does-the-heavy-lifting bet for colour themes (zero
component changes) held. The same bet here is *stronger* — the
two new axes are even more atomic, because there's literally one
variable (`--spacing`) doing all the density work and three
radius variables doing all the shape work.

## Future axes (parked)

If two more axes feel useful later, the same mechanism extends
without component change:

- **Type scale** — `default` / `larger`. For learners who want
  bigger reading text without zoom-blurring code blocks. Bind
  `--text-base`. Mind that this *does* interact with touch
  targets if buttons size with type — keep `min-h-11` explicit.
- **Motion** — `default` / `reduced` / `none`. Today
  `prefers-reduced-motion` is honoured at the CSS level; a
  picker is the opt-in version for users whose OS preference
  doesn't reflect what they want on *this* site.

Both are deferred until a learner asks. They cost nothing to add
when the moment comes because the contract is the same.
