# 14 — Stylistic themes (density + shape)

Three theme **axes**, each independently set by the learner:

1. **Colour** — `dark` / `light` (today) + `hc-*`, `sepia`, etc. (parked).
   See [13-themes.md](13-themes.md).
2. **Density** — `compact` / `normal` / `airy`. How much whitespace
   the site uses. *This doc.*
3. **Shape** — `sharp` / `normal` / `rounded`. How rounded the
   corners are. *This doc.*

The three axes compose: a learner can run `dark` + `compact` +
`rounded` if that's what reads best to them. The DS holds the
contract that any combination just works.

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
```

The component layer doesn't change — every `rounded-sm` /
`rounded-md` / `rounded-lg` already reads through these.

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

Two new localStorage keys:

- `typeover:density` — `"compact"` / `"normal"` / `"airy"`
- `typeover:radius` — `"sharp"` / `"normal"` / `"rounded"`

Same shape as `typeover:theme`. The existing bootstrap script in
`BaseLayout.astro` extends to read all three keys synchronously
before paint — adding two `getItem` reads is cheap and keeps
the no-FOUC contract.

## Selector UX

Settings page grows from one radio group to three. The colour
group stays at the top (most impactful); density and shape are
below. Stacked, not tabbed — they're related concerns and the
page is short.

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
```

A live preview region under each group helps the learner see what
the choice does. The DS gives this for free: render a Panel +
Button + Badge + CodeBlock inside the `<html>`-attribute-aware
cascade and they reflect the picker instantly.

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

This doc is the proposal. Implementation order, when picked up:

1. **Tokens** — add `--spacing` (already implicit in Tailwind 4)
   to the `@theme` block explicitly; verify the radius tokens
   already exist (they do).
2. **Override blocks** — `:root[data-density="…"]` (2 blocks) and
   `:root[data-radius="…"]` (2 blocks) in `global.css`.
3. **Bootstrap script** — extend `BaseLayout.astro`'s inline
   script to read + apply `typeover:density` and `typeover:radius`
   alongside `typeover:theme`.
4. **`src/lib/theme.ts`** — extend to expose `currentDensity()` /
   `setDensity()` and `currentRadius()` / `setRadius()` with the
   same shape as the colour API.
5. **`ThemePicker.tsx`** → rename to `AppearancePicker.tsx`, grow
   from one radio group to three, add the live preview region.
6. **Tests** — unit tests for `setDensity` / `setRadius` (same as
   `setTheme`), plus an axe-core a11y test running through the
   four corner combinations.

The DS-does-the-heavy-lifting bet for colour themes (zero
component changes) held. The same bet here is *stronger* — the
two new axes are even more atomic, because there's literally one
variable (`--spacing`) doing all the density work.

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
