# 08 — Accessibility and mobile

## Non-negotiables

- **WCAG 2.2 AA**, top to bottom.
- **Full mobile support**, including freeform code exercises.
- A11y and mobile correctness are **enforced at the design system
  layer**, so any new page built from design-system primitives is
  correct by default. Authors should not have to remember a11y rules
  while writing exercises.

## Design system contract

Every component in `src/components/ds/` ships with:

1. **Semantic HTML.** `<button>` not `<div onClick>`; `<nav>` for nav;
   headings in correct order; lists for lists.
2. **Visible focus.** A focus ring on every interactive element. Never
   `outline: none` without a replacement.
3. **Keyboard operability.** Every interactive element reachable and
   activatable via keyboard. No mouse-only affordances.
4. **ARIA only where needed.** Use ARIA to *enhance* semantics, never
   to replace them. `aria-label` for icon-only buttons; `aria-live` for
   feedback regions; `role` only when no native element fits.
5. **Contrast verified.** Text/background contrast measured at the
   token level. The two accent colours we use heavily (`accent-ts`,
   `accent-go`) must hit 4.5:1 against `bg-base` and `bg-panel` at
   ≥14px. If they fall short, we brighten them in the token, not
   anywhere else.
6. **No colour-only signal.** Correctness, language tags, and state
   are conveyed with text/iconography in addition to colour.
7. **Touch-friendly hit targets.** Minimum 44×44px for any
   interactive element on mobile (Apple HIG) or 48×48px (Material).
   The smaller value is the rule; the bigger is the aspiration.
8. **No hover-only behaviour.** Anything revealed on hover must also
   be reachable by tap/focus.
9. **Motion respects `prefers-reduced-motion`.** Quiz transitions and
   any animation we add must check this preference.

## Specific commitments per element

### Buttons

- `<button>` element, always.
- `aria-label` when content is icon-only.
- `aria-pressed` for toggle buttons.
- `disabled` attribute + visible disabled styling.

### Form inputs (the editor surface)

- Every input has an associated label (visible or `aria-labelledby`).
- Error messages programmatically associated via `aria-describedby`.
- Validation messages live in `aria-live="polite"` regions, not as
  toast popups the screen reader misses.

### Code blocks

- `<pre><code>` with `class="language-<lang>"` for syntax-highlight
  compatibility and screen-reader hinting.
- Language label is a real DOM element with text, not background-image
  or pseudo-content.

### Feedback regions (correctness, hints, diffs)

- `role="status"` or `aria-live="polite"` for non-critical updates.
- `role="alert"` only for hard errors that demand immediate attention.

### Navigation

- Skip-to-content link.
- Single visible h1 per page.
- Breadcrumb in nav landmark.

## Mobile support

### Layout

- **Adaptive breakpoint at 1024px.** Above: side-by-side TS/Go.
  Below: stacked TS over Go. The `Layout/Adaptive` component
  encapsulates this; pages don't write media queries.
- **Touch targets ≥ 44px** for every button and tile.
- **Bottom action bar** on small screens for primary actions
  (Submit / Hint / Show canonical), so the thumb reaches them.

### Code editor on mobile

This is the hardest mobile UX:

- **Current editor surface:** Freeform exercises ship today with a
  plain `<textarea>` driving `useYaegiRun`. CodeMirror 6 integration
  is task #23 — planned but not blocking launch. The mobile
  affordances below apply to the textarea surface today and will
  apply to CodeMirror when it lands.
- **Software keyboard quirks:** iOS Safari shrinks the viewport when
  the keyboard appears. The editor must reflow correctly.
- **Code-friendly virtual keyboard.** We don't fully solve this (no
  one has), but we suppress autocorrect, autocapitalise, and spell-
  check on the editor. (`autocapitalize="off"`, `autocorrect="off"`,
  `spellcheck="false"`.) *(Shipped on `<textarea>` already.)*
- **Provide a "common symbols" bar** above the keyboard for `{`, `}`,
  `(`, `)`, `[`, `]`, `:=`, `=`, `*`, `&`. This is the single most
  productive mobile-editor affordance — phones bury symbols two
  taps deep. *(Shipped 2026-05-19 on both Freeform and
  FillBlankLineInput — `MobileKeyBar` in `src/components/ds/`.
  iOS Safari visualViewport polish is the open follow-up; see
  design-docs/99.)*
- **Tabs** insert two spaces (no real tabs).
- **No** vim mode / advanced editor modes on mobile.

### Mobile-specific copy

If the learner is on mobile and we detect a tight viewport, a small
banner can offer "this exercise is easier on a bigger screen, but try
it if you want." Don't refuse to render; the user is the boss.

## Testing & verification

- **`axe-core` against the design-system layer** — *landed.*
  `src/a11y.test.tsx` (run via `pnpm test:a11y` or as part of
  `pnpm test`) renders every DS primitive into JSDOM and runs
  axe-core's WCAG-2.2-AA ruleset against it. 17 specs today
  (every primitive plus a "typical page chrome" composite); zero
  violations. Pinned to a fixed rule-tag list so an axe-core
  upgrade can't quietly add a category we haven't audited.
- **Manual VoiceOver pass** before launch and after any DS change.
- **Lighthouse a11y ≥ 95** on every page (still a launch-gate
  follow-up — design-docs/07).
- **Computed-colour-contrast in a real browser** — JSDOM can't
  compute the real background colour off CSS custom properties +
  Tailwind utilities, so axe's colour-contrast rule is disabled in
  the JSDOM run. A future Playwright pass on each theme (dark +
  light, eventually hc-\*) will run axe with colour-contrast enabled
  against the live DOM. Pairs with the FOUC test parked in
  design-docs/13.
- **Real-device test** (iPhone + Android) before launch.

## Why this is at design-system layer

If a11y lives in pages, it rots. Authors forget, pull-request reviewers
miss it, and the bar slips with every theme added. If a11y lives in the
design system:

- Primitives encode the rules once.
- A new exercise component that uses `<Button>`, `<Input>`, `<Feedback>`
  is correct without thinking about it.
- Audits become cheap because the surface is small and reused.
