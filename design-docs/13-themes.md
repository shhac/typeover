# 13 — Themes (colour)

How typeover handles **colour** themes (dark / light / future
variants), why the DS gives this almost for free, and what the
*contract* is for adding new themes without per-component code.

This doc covers one of three independent theme axes. The other two
— **density** (compact / normal / airy) and **shape** (sharp /
normal / rounded) — are proposed in
[14-stylistic-themes.md](14-stylistic-themes.md) and use the same
data-attribute + CSS-cascade mechanism.

## The contract (one sentence)

**Adding a new theme is one override block in `global.css` plus one
entry on the theme selector. No component change.**

If that ever stops being true, the DS has leaked — see "DS leaks to
prevent" below.

## How the DS makes themes nearly free

Per [05-design-system.md](05-design-system.md) the DS is built on
tokens — CSS custom properties under `@theme` in `src/styles/global.css`.
Tailwind 4 compiles utility classes against those vars:

```css
.bg-bg-base { background-color: var(--color-bg-base); }
.text-accent-amber { color: var(--color-accent-amber); }
.border-border-strong { border-color: var(--color-border-strong); }
```

A component writing `class="bg-bg-panel text-fg-primary"` doesn't bind
to a colour — it binds to a name. Changing the name's value at
runtime (via `:root[data-theme="…"] { … }`, `:root[data-palette="…"]`,
etc.) propagates to every component atomically. No reactive
subscription, no media-query sprinkling, no `dark:` / `light:`
Tailwind variants.

**Update 2026-05-20** — design-docs/22 first-classed the palette
axis. `data-theme` (dark/light/system) now selects between the
active palette's two variants; the *colour identity* lives in
`data-palette` (22 named palettes, defaults per style). This doc
remains accurate at the mechanism level — the cascade-via-data-attr
pattern is the same — but the colour-token override blocks are now
keyed by palette, not theme alone.

The current codebase audit (2026-05-19) found **zero** colour
references that bypass the token layer after the Kbd.tsx fix. That's
the precondition this doc commits to maintaining.

## Theme-swap mechanism

`data-theme="<id>"` on `<html>`. CSS variables cascade from there.

```css
@theme {
  /* "dark" is the default token set — the @theme block compiles
   * the utility classes against these values. */
  --color-bg-base: #0a0a0b;
  --color-fg-primary: #e8e8e8;
  /* …etc… */
}

:root[data-theme="light"] {
  --color-bg-base: #ffffff;
  --color-fg-primary: #14171f;
  /* …etc… */
}

:root[data-theme="hc-dark"] {
  /* high-contrast dark — same family, max contrast values */
}
```

The `@theme` block stays the dark values (so utilities have a sensible
default before JS runs); `data-theme="dark"` is a no-op redundant
override that exists for explicitness when a user has pinned dark.

### Bootstrapping (no flash-of-wrong-theme)

A tiny inline script in `BaseLayout.astro` runs before paint:

```html
<script is:inline>
  (() => {
    const stored = localStorage.getItem("typeover:theme");
    const prefersLight =
      window.matchMedia("(prefers-color-scheme: light)").matches;
    const theme = stored ?? (prefersLight ? "light" : "dark");
    document.documentElement.dataset.theme = theme;
  })();
</script>
```

Render order: the script runs synchronously in `<head>` before any
paint, sets `data-theme`, the cascade picks the right values on first
frame. No flash, no JS framework needed.

### Persistence

LocalStorage key `typeover:theme` (string id). Schema: just `dark` |
`light` | `hc-dark` | `hc-light` (or any future addition). Reads via
the bootstrap script above; writes via the selector UI (see below).

### Default

`prefers-color-scheme` for first-visit. Once the learner picks
explicitly, that pin survives prefers-color-scheme changes.

## Theme catalogue

Initial offering, in launch order:

### 1. `dark` (default, today)

The current Bloomberg-Terminal-meets-airy-Linear aesthetic. Near-black
surfaces, amber primary, TS-blue + Go-cyan accents. Mono-first.
Audited and AA-verified — values live in `@theme` and are the floor
all other themes inherit semantics from.

### 2. `light`

A proper light counterpart, *not* an inverted dark. Off-white
surfaces, same accent identity (amber/TS-blue/Go-cyan) but darkened
so they pass AA contrast against light backgrounds.

Provisional token values (placeholder — to be contrast-verified
before shipping):

```css
:root[data-theme="light"] {
  --color-bg-base:     #ffffff;
  --color-bg-panel:    #f5f6f8;
  --color-bg-elevated: #ebedf1;
  --color-bg-inset:    #f0f2f5;

  --color-border-default: #e1e4ea;
  --color-border-strong:  #c4c9d2;
  --color-border-accent:  #c97a0055;

  --color-fg-primary:   #14171f;  /* ~17:1 against #fff */
  --color-fg-secondary: #4a5060;  /* ~8.4:1 */
  --color-fg-muted:     #6b7280;  /* ~5.7:1 */
  --color-fg-faint:     #94989f;  /* ~3.2:1 — decorative only */

  --color-accent-amber:     #c97a00;  /* darker amber for AA on #fff */
  --color-accent-amber-dim: #8a5300;
  --color-accent-ts:        #2057b8;  /* darker TS blue */
  --color-accent-ts-dim:    #143a7e;
  --color-accent-go:        #006d8e;  /* darker Go cyan */
  --color-accent-go-dim:    #00485e;

  --color-success: #0e8443;
  --color-warning: #b25c00;
  --color-error:   #b91c1c;
}
```

Trade-off: the brand identity colours dim noticeably under light. The
DS authors-of-record (us) accept that; brand identity bends to a11y.

### 3. `hc-dark` (high-contrast dark)

WCAG AAA. Pure black surfaces, pure white text, amber pushed to a
fluorescent value, NO opacity-mixed colours (every state border is
fully saturated rather than `border-success/40`).

Useful for: low-vision learners using the dark theme; users with the
OS `prefers-contrast: more` setting.

### 4. `hc-light` (high-contrast light)

Same shape as `hc-dark` but on pure-white surfaces.

### Future candidates (parked, not v0)

- **`sepia`** — warm off-white surfaces, deep-brown text. Easier on
  eyes for long reading sessions. Brand accents would shift toward
  the warm side (amber stays, TS-blue lifts toward teal).
- **`bloomberg`** — pure terminal nostalgia. Tighter spacing
  override, smaller base font, more amber everywhere. This bends the
  "airy" decision in 05-design-system.md, so it's an explicit opt-in
  for the nostalgia crowd.
- **`solarized-dark` / `solarized-light`** — the Ethan-Schoonover
  palette dev-tools default. Strong recognition cue; less
  brand-aligned than `dark` / `light`.

## Theme selector UX

Minimal first cut: a footer link → `/settings` route with a radio
group. No header toggle (header chrome is precious).

```
Theme
  ○ System (follow OS)
  ● Dark
  ○ Light
  ○ Dark, high-contrast
  ○ Light, high-contrast
```

"System" means: clear the localStorage pin, let
`prefers-color-scheme` win on next load.

A header toggle is parked until user feedback says the footer is too
buried. The DS doesn't care — both consume the same set/clear API.

## DS leaks to prevent

The audit that proved this is feasible relied on the codebase having
zero theme-blind colours. To keep it that way, the design system's
"rules for adding components" (05-design-system.md) get one
addition:

- **Every colour goes through a token.** Never write `#hex`, `rgb(…)`,
  `text-white`, `bg-zinc-…`, or any literal in a class. If a colour
  doesn't exist as a token, add it to `@theme` first.

A future code-structure pass should grep for `#[0-9a-fA-F]{3,8}`
across `src/`, `outline-`, `ring-`, `shadow-` followed by a non-token
value, and any Tailwind built-in colour utility — all should fail.
This is a candidate for an oxlint rule once Tailwind 4 has one;
until then it's a review-time check documented here.

## Token additions needed before shipping

The audit surfaced one shadow that used `#000` literally (Kbd.tsx).
Fixed by routing through `var(--color-bg-inset)`. Going forward, any
new shadow goes through a token. If the catalogue grows to need
explicit shadow recipes, we add `--shadow-key`, `--shadow-panel`,
etc. as tokens of their own.

## Implementation plan

Steps 1-5 landed 2026-05-19. The DS-does-the-heavy-lifting bet held:
every component picked up the swap with zero code changes. End-to-end
verified in Chromium across the settings page, an MCQ exercise page,
and the curriculum index.

1. ~~Promote `@theme` values to default + add `:root[data-theme="dark"]`
   override block.~~ Skipped — `@theme` IS the dark default, and an
   explicit `[data-theme="dark"]` block would be redundant. The
   bootstrap script still writes `data-theme="dark"` to the DOM for
   selector-state reading, but it doesn't need a matching CSS block.
2. ~~Add `:root[data-theme="light"]` with the provisional values
   above.~~ `src/styles/global.css`.
3. ~~Add the bootstrap script to `BaseLayout.astro`.~~ Inline,
   pre-paint, FOUC-free.
4. ~~Add `src/lib/theme.ts`.~~ `currentTheme()` / `currentChoice()` /
   `setTheme("system" | "dark" | "light")`. 10 unit tests pin the
   contract.
5. ~~Add `src/pages/settings.astro` with the radio group.~~
   `src/components/settings/ThemePicker.tsx` is the Solid island;
   the route mounts it via `client:only`.

Open:

6. **Integration test** that the bootstrap script doesn't introduce a
   flash. Playwright check: navigate, read `getComputedStyle(html).backgroundColor`,
   confirm it's already the right colour on the very first frame
   (no transition through the default). Pending until #32 axe +
   Lighthouse CI lands; same Playwright harness.
7. **High-contrast pair** (`hc-dark`, `hc-light`) — same shape as
   step 2, plus a token review for opacity-mixed colours (every
   `border-success/40` in the codebase becomes a full-saturation
   variant in the HC themes). Add when an a11y reviewer asks or when
   `prefers-contrast: more` adoption is high enough to justify.
8. **Future themes** parked above (`sepia`, `bloomberg`, solarized
   pair) — same one-block recipe.
