# 17 — Visual / theme review (2026-05-20)

> Reviewer: theme designer, bad mood. Persona note: optimised
> for spotting what the DS contract was supposed to prevent.

## Headline

The token layer is *almost* clean — no rogue hex literals, no
`text-zinc-500`, the four axes wire up. But the moment you leave
`global.css` the discipline collapses. Pages systematically override
the Heading primitive's sizes with `!`-prefixed Tailwind classes,
two callers re-implement the primary button class string by hand
(soon to be three), every chip-shaped thing has been quietly
promoted to a pill (badges, breadcrumbs, MCQ options, radio rows,
exercise cards, code-block lang strips), the same micro-mono shows
up at three different arbitrary pixel sizes (`text-[10px]`,
`text-[11px]`, `text-[13px]`) across the DS itself, and the
`filename` slot on `CodeBlock` is routinely used to hold a
language name or a prose instruction. The Style axis ships five
options and at least two of them (Cardboard, Islands on dark) are
visually identical to Terminal — they pass acceptance because the
tokens flip; they fail design because the effect doesn't read.
The primary CTA has a 4.3:1 contrast failure in light mode. None
of this would have shipped if anyone had cycled the four axes on
one screen and asked "do these feel like one site."

## Findings

### F-1. The primary button class string lives in three places
**Where**: `src/components/ds/Button.tsx:16`, `src/components/exercise/ExerciseShell.tsx:17-20`, `src/components/completion/ModuleCompleteCard.tsx:209`
**What you see**: `Button` exposes a `variant="primary"`. Both `ExerciseShell` ("Next exercise →") and `ModuleCompleteCard` ("Share") need an anchor or a hand-rolled button styled to match it, so they copy-paste the class string verbatim: `"inline-flex … h-11 px-4 … rounded-sm … bg-accent-amber text-bg-base hover:bg-accent-amber/90 border border-accent-amber"`. The ExerciseShell file even comments "if a third site needs an anchor-button, extract a ButtonLink." That third site has existed for months.
**Why it's bad**: The DS has lost its single source of truth for the primary CTA. If anyone touches `Button` (radius, padding, hover ramp), the two anchor copies drift silently and the site grows three subtly-different orange rectangles.
**Suggested fix**: Ship `ButtonLink` (or polymorphic `as="a"` on Button) today and delete the two hand-rolls.
**Severity**: blocker

### F-2. Primary CTA contrast fails AA in light theme
**Where**: `Button` variant="primary" under `:root[data-theme="light"]`; tokens in `src/styles/global.css:206`
**What you see**: In light mode, `--color-accent-amber: #c97a00` plus `--color-bg-base: #ffffff` (which is what `text-bg-base` resolves to). That's `#c97a00` background with `#ffffff` text. Contrast ratio is ~4.32:1 — under the 4.5:1 WCAG AA floor for normal-weight body text. The button at `font-medium text-sm` is normal-text by WCAG sizing rules. Visually it reads as dim-mustard with vanishing white text. Confirmed in DOM at `/go/foundations/variables/01` after switching to light.
**Why it's bad**: This is the most clicked element on the site failing the contract the colour-theme doc promises ("Contrast-verified … 4.5:1 AA"). The dark theme passes because `text-bg-base` resolves to `#0a0a0b` against bright amber — fine. Light theme inverted the bg but kept the same `text-bg-base` mapping without checking the resulting contrast.
**Suggested fix**: Either deepen `--color-accent-amber` further in light (to ~`#a06400` for ~5.2:1) OR override `text-bg-base` to a darker token on the primary button in light mode. Option A keeps the DS clean.
**Severity**: blocker

### F-3. Heading primitive's sizes are routinely overridden with `!`-classes
**Where**: `src/pages/index.astro:90, 123` (`!text-2xl`); `src/pages/settings.astro:28` (`!text-xl`); `src/pages/go/index.astro:95, 119` (`!text-2xl`, `!text-lg`).
**What you see**: Pages use `<Heading level={2} class="!text-2xl">` to set semantic h2 then force-override its 24px default to… 24px (and one place shrinks h2 to h3 sizing while keeping h2 semantics). The `!` prefix is reaching past the DS lookup table to win the cascade.
**Why it's bad**: The Heading component's size ramp is now decorative. The page is the source of truth for size; the level prop only delivers the tag. Cross-page hierarchy drifts because each page picks its own size for h2/h3. And if the DS ramp ever changes, the `!` overrides keep the old values.
**Suggested fix**: Either widen Heading's API (add a `size` prop independent of `level` if pages genuinely need rank ≠ visual size) or audit every `!text-*` and accept the DS ramp. The second is cheaper and forces a real conversation about whether the ramp is wrong.
**Severity**: major

### F-4. Type ramp has no breathing room between H3 and H4 (and H4 is unused)
**Where**: `src/components/ds/Heading.tsx:14-19`
**What you see**: h1 = `text-4xl` (36px); h2 = `text-2xl` (24px); h3 = `text-lg` (18px); h4 = `text-base` (16px) uppercase-tracked. h3→h4 is 2px and a uppercase shift; meanwhile h1→h2 drops 12px. The ramp is back-loaded — three small sizes crammed into 16–24px, one giant size at 36.
**Why it's bad**: Pages can't tell h3 and h4 apart at a glance unless they read the case. The only used distinctions on real pages are h1 vs. h2 vs. body — the rest of the ramp is theoretical. The 36px h1 then forces pages to claw back with `!text-2xl` (F-3) because 36px is too loud for any title that isn't the homepage hero.
**Suggested fix**: Either re-tune the ramp to 30/22/18/15 (smaller h1, more linear stepping) OR fold h4 into Eyebrow (which is the same shape: small mono uppercase tracked) and drop level=4 entirely.
**Severity**: major

### F-5. Eyebrow and outlined Badge are visually the same primitive
**Where**: `src/components/ds/Eyebrow.tsx` vs. `src/components/ds/Badge.tsx`; `/design-system` row shows them side by side
**What you see**: Eyebrow = `font-mono text-xs uppercase tracking-widest` plus a tone colour. Outline Badge = `font-mono text-[10px] uppercase tracking-widest` plus a tinted border. On the rendered page the only difference is a 1px hairline around the badge and a 2px size delta. With `tone="amber"` they're indistinguishable at a glance. The DS inventory page literally shows AMBER / TYPESCRIPT / GOLANG as eyebrows directly beside the same words as badges.
**Why it's bad**: Two primitives competing for the same visual job means authors flip a coin per page. On the exercise card, "01" is rendered as Text-mono, "MULTIPLE CHOICE" is rendered as outlined Badge, "EXERCISES 10 ready" is rendered as Eyebrow + Text-mono — three treatments for what's really the same metadata strip rhythm.
**Suggested fix**: Either pull Badge.outline into Eyebrow (one primitive, optional border) or commit to: Eyebrow = naked text label, Badge = bordered tag for content lookups (lang, exercise type), and audit every caller against that split.
**Severity**: major

### F-6. Five hardcoded micro-mono sizes inside the DS
**Where**: `Badge.tsx:38` (`text-[10px]`), `CodeBlock.tsx:49` (`text-[11px]`), `CodeBlock.tsx:53` (`text-[10px]`), `CodeBlock.tsx:64` (`text-[13px]`), `Panel.tsx:56` (`text-[11px]`), `Kbd.tsx:18` (`text-[11px]`), `BlankInput.tsx:97` (`text-[13px]`)
**What you see**: The DS contract says "every colour goes through a token … reviewers grep for hex literals at every code-structure pass." It says nothing about *type sizes* — and the result is that micro-mono lives at 10/11/13 px scattered across the primitives. Tailwind has `text-xs` (12px) and `text-sm` (14px). The DS goes around them.
**Why it's bad**: Badge text is 10px, Kbd text is 11px, CodeBlock body is 13px. A learner reading code with a Kbd hint embedded gets three different sizes in one sentence. The 10px size in particular is below the practical readable floor on dense displays.
**Suggested fix**: Add `--text-micro: 11px` and `--text-code: 13px` (or just standardise on Tailwind's `text-xs` everywhere) and replace every `text-[Npx]` arbitrary value. Same enforcement rule as colours.
**Severity**: major

### F-7. `rounded-md` shows up in two places; everything else is `rounded-sm`
**Where**: `src/components/ds/TrackCard.astro:38`; `src/pages/go/[module]/[theme]/index.astro:108`
**What you see**: Every other surface — Panel, Button, Badge, CodeBlock, Feedback, MCQ option, freeform editor, settings radio row — uses `rounded-sm`. TrackCard (homepage track cards) uses `rounded-md`. The focus-ring wrapper for exercise cards uses `rounded-md`. So on the curriculum theme page, exercise cards have a 3px-radius Panel inside a 3px-radius focus container — but they don't match: the focus ring is a different radius than the card it's framing.
**Why it's bad**: Under default shape (normal) the difference is 1px and invisible. Under "rounded" preset (`--radius-md: 8px` vs. `--radius-sm: 4px`) the focus ring is twice the radius of its content. Visual hierarchy of containment breaks because the *outline* is more rounded than the *thing it's outlining*.
**Suggested fix**: Both files → `rounded-sm`. The shape axis is the *only* knob that should rebind radii; component picks should be uniform.
**Severity**: major

### F-8. Pillification — every chip-shaped thing is bordered, with text at the same scale
**Where**: site-wide; cf. `Badge`, `Panel` label strip, `CodeBlock` lang chip, `Kbd`, MCQ option, `AppearancePicker` radio row, exercise card panels, breadcrumb badges, freeform "Run/Reset" toolbar
**What you see**: Bordered mono uppercase chips at: language flags, exercise-type tags, focus-state markers, lang labels on code blocks, Kbd keys, breadcrumb segments, radio options, exercise type labels in cards. The settings preview panel alone stacks `TYPESCRIPT GOLANG FOCUS` plus filename-strip `preview.go [GO]` and below all of it three pill-shaped radio rows. The user has flagged this twice. It is worse now than at last flagging because Pill axis added a fourth radius preset that turns these into actual capsule shapes.
**Why it's bad**: When every metadata token is the same form factor, hierarchy collapses to colour alone — and colour is already a strained channel (amber/TS/Go are *brand* identity, not state). The breadcrumb pill `FOUNDATIONS` reads identically to the badge `MULTIPLE CHOICE` reads identically to the radio option `Dark` — three different semantic roles, one chrome.
**Suggested fix**: Demote at least two: (a) breadcrumb "module" + "theme" should be plain text + glyph, not Badge; (b) MCQ options should be inline-text rows with the radio circle as the only chrome, not bordered cards. Reserve Badge for *content* tagging (TS / GO / MCQ-type) and nothing else.
**Severity**: blocker

### F-9. Breadcrumb mixes filled-amber, outlined, dot-separator, and arrow-separator on one line
**Where**: `/go/foundations/variables/01` top strip; built in `src/pages/go/[module]/[theme]/[index].astro`
**What you see**: `[FOUNDATIONS]` (amber filled pill) `→` (arrow) `[VARIABLES AND DECLARATIONS]` (default outlined pill) `·` (middle dot) `exercise 1` (mono text) `·` (middle dot) `mcq` (mono text). Five separator/chrome treatments in one strip: filled badge, outlined badge, arrow, mid-dot, plain text. The same strip on `/go` (LangCrumbs) uses just two outlined badges + arrow. The same strip on `/go/foundations/variables` uses filled badge + outline badge + arrow. Three breadcrumb dialects across three adjacent pages.
**Why it's bad**: A user navigating from `/go` → theme → exercise sees the breadcrumb chrome morph at every step. The mental model of "the navigator looks like this" never sets.
**Suggested fix**: One breadcrumb component, one chrome rule. Suggest: each segment is a plain text link (not a badge), separator is `›` (single chevron). Reserve coloured pills for the page-title row, not the breadcrumb above it.
**Severity**: major

### F-10. `CodeBlock` filename slot is repurposed as a language label or prose instruction
**Where**: `src/components/exercise/ExerciseShell.tsx:97` (`filename="typescript"`); `src/components/exercise/Freeform.tsx` etc. (`filename="your turn — type the line"`); design-system page is the only correct usage (`filename="users.ts"`)
**What you see**: `<CodeBlock lang="ts" filename="typescript">` — left side shows "typescript", right side shows `[TS]` chip. Two labels for the same thing. Worse, in freeform exercises the filename slot holds prose: "your turn — type the line". The strip is a UI hint, not a filename.
**Why it's bad**: The slot's name encodes its intended meaning. Now any tooling that reads filenames (copy-to-clipboard with filename, future "open in playground" link) breaks because the value is not a filename. Visually the strip then has TWO competing label kinds across the site — real filenames (`users.ts`) and made-up label strings — but with identical chrome.
**Suggested fix**: Add a separate `label` prop to CodeBlock for the left-of-strip annotation; reserve `filename` for actual filenames. Migrate the call sites.
**Severity**: major

### F-11. Style axis "cardboard" and "islands" don't read on dark theme
**Where**: `:root[data-style="cardboard"]` + `[data-style="islands"]` in `src/styles/global.css:143-178`
**What you see**: Cardboard adds a `radial-gradient` stipple at ~18% opacity of `--color-fg-faint` (which on dark is `#6b6b70`) — i.e. a barely-visible peppering of tiny dots on a near-black background. At normal viewing distance the texture vanishes. Islands adds a drop shadow that's `0 10px 24px -12px color-mix(in oklab, #000 55%, transparent)` — black-on-near-black, also vanishes. I cycled both with the page open; the only style that visually registered on dark was Textbook (because the amber left-rule appears), and even that's only on Panel surfaces.
**Why it's bad**: The Style axis ships five options; on the default colour (dark), three of them are no-ops. A learner who picks "Cardboard" because they want warmer/softer gets terminal back. The axis advertises a choice it can't deliver. Per the contract in 14-stylistic-themes.md "each style adds at most three token overrides + one optional texture URL" — the constraint is right, the recipes are too timid.
**Suggested fix**: Cardboard needs an actual warm-tilt on the surface tokens (not just a texture), e.g. shift bg-panel toward `#1a1612` (warm dark). Islands needs a lighter halo above the shadow so the lift reads on dark too. Or scope these styles to light theme only and gate them in the picker.
**Severity**: major

### F-12. "Glass" style has no glass to look through
**Where**: `:root[data-style="glass"]` in `src/styles/global.css:161-169`
**What you see**: Glass sets `--panel-backdrop-filter: blur(10px) saturate(140%)` on the `.ds-panel` class. But the application doesn't have a layered background — there's no hero gradient behind panels, no image, no parallax surface. The page background is flat `#0a0a0b`. A backdrop blur over a flat colour produces… the same flat colour. The Glass effect requires *something to blur*.
**Why it's bad**: This is the most "designerly" of the styles and the one most likely to attract a learner who wants the site to feel modern. They get nothing because the application's background is structurally incapable of demonstrating the effect.
**Suggested fix**: Either drop Glass from the picker until there's a layered background to blur, OR add a subtle radial-gradient page background under `:root[data-style="glass"]` so the blur has gradient hue to soften. Quick win: amber-tinted very-low-saturation gradient at the top-right that the panels then sit on top of.
**Severity**: major

### F-13. "Pill" radius on small UI breaks the visual hierarchy of containment
**Where**: Globally under `:root[data-radius="pill"]`; visible in exercise MCQ + radio settings
**What you see**: Under pill preset, `--radius-sm: 8px`, `--radius-md: 16px`, `--radius-lg: 24px`. Every Panel uses `rounded-sm` (so 8px) and the radio options inside use `rounded-sm` too (8px). They're the same radius — but one is *inside* the other. Container and contained share a corner shape, so the eye reads the contained element as adhering to the container wall.
**Why it's bad**: Containment hierarchy is signalled in part by *progressive radius reduction* — outer surfaces curve more, inner surfaces curve less. Pill flattens that.
**Suggested fix**: Apply a 0.5x scaling rule across radii within a single component nesting (Panel: `rounded-lg`, content cards: `rounded-md`, chips inside cards: `rounded-sm`) and let the shape axis preserve the ratio. Today everything is `rounded-sm` for "stay sharp" reasons — that needs to become a real hierarchy now that pill is on the menu.
**Severity**: major

### F-14. Site brand wordmark gets the same colour treatment at hero scale and at chrome scale
**Where**: `src/layouts/BaseLayout.astro:118` (header anchor) vs. `src/pages/index.astro:44` (h1 hero)
**What you see**: Header: `<span class="text-accent-ts">type</span><span class="text-accent-amber">over</span>` at `text-xs font-mono`. Homepage hero: same DOM shape inside an h1 at `text-4xl font-semibold tracking-tight`. Two-colour wordmark, identical hand-roll, no shared primitive.
**Why it's bad**: (a) Identity is duplicated in two places that can drift. (b) The hero treatment IS the chrome treatment scaled up — there's no design distinction between "this is the site name in the header" and "this is the site name as the headline of the homepage." A proper logotype gets one lockup, not two.
**Suggested fix**: Extract a `<Wordmark size="hero|chrome" />` primitive, lock the colour mix in one place, and let the hero have its OWN headline that isn't the wordmark (e.g. tagline-first, wordmark in chrome only).
**Severity**: minor

### F-15. Submit / Run / inline-canonical buttons fan out across three button vocabularies
**Where**: `Button` (DS), `RunResetToolbar.tsx`, `InlineCanonicalReveal.tsx`, `Freeform.tsx`
**What you see**: Primary buttons go through `Button variant="primary"` (good). But `RunResultPanel.tsx:30-46` hand-rolls pre-formatted output blocks with their own borders (`rounded-sm border whitespace-pre-wrap`) — that's three different `<pre>` blocks with three slightly-different border treatments inline. And `Freeform.tsx:114` hand-rolls the editor with `font-mono text-sm bg-bg-inset … rounded-sm border` — exactly what `CodeBlock` would render but as an editor, with the lang strip missing. So the same colour/shape decisions for code surfaces are re-made per file.
**Why it's bad**: The Freeform editor reads as "almost-but-not-quite a CodeBlock," different border on hover/focus, no filename strip. The cognitive load of "is this the same surface family as the previous code I read?" is non-zero — at scale, learners feel the inconsistency without naming it.
**Suggested fix**: Extract `CodeEditor` primitive that pairs with `CodeBlock` (same chrome, editable body, optional filename strip). RunResultPanel's three pre-blocks fold into a single `CodeBlock` with a status variant.
**Severity**: major

### F-16. Three accents in one strip on the Settings preview
**Where**: `src/components/settings/AppearancePicker.tsx:220-224`
**What you see**: The preview Panel includes a Badge row: `TYPESCRIPT` (blue tint), `GOLANG` (cyan tint), `FOCUS` (amber tint), then a ProgressChip in muted grey. Three brand accents, three different chromatic tints, sitting side-by-side in a 4-element row.
**Why it's bad**: The point of the preview is to show how the learner's *appearance choices* affect the site. Showing three competing accents in the same row turns the preview into a colour-test sample. The learner can't see "what will my Foundations page look like" because the preview is busier than any real page.
**Suggested fix**: Drop the FOCUS badge. The preview should show ONE accent (whichever the active page would emphasise — GO for the curriculum, amber for CTA pages) and let the brand identity breathe.
**Severity**: minor

### F-17. AppearancePicker hand-rolls Eyebrow four times
**Where**: `src/components/settings/AppearancePicker.tsx:242, 253, 264, 275`
**What you see**: `<div class="font-mono text-xs uppercase tracking-widest text-fg-muted">Theme</div>` repeated four times for Theme / Density / Corners / Style headings. The class string is exactly what `<Eyebrow tone="muted">` produces, and `Eyebrow` is imported at the top of the file.
**Why it's bad**: Cosmetic DS-bypass. If Eyebrow's treatment ever changes (a future "all eyebrows shift to sentence case") the picker won't follow.
**Suggested fix**: Replace four divs with `<Eyebrow tone="muted">`.
**Severity**: nit

### F-18. Mobile breadcrumb wraps and leaves an orphaned `·`
**Where**: `/go/foundations/variables/01` at 390px viewport
**What you see**: At narrow width the breadcrumb wraps to two lines: line 1 ends with `[VARIABLES AND DECLARATIONS] ·` (the mid-dot becomes the last glyph on the line, no `exercise 1` to attach to); line 2 starts `exercise 7 · fill-line`. The orphan dot reads as a typo.
**Why it's bad**: A breadcrumb's job is wayfinding; orphaned separators undermine the readability that's the whole point.
**Suggested fix**: Render the per-exercise tail (`exercise N · type`) as a separate row beneath the badge breadcrumb at narrow widths, OR move it into the page-title row. Either fixes the wrap.
**Severity**: minor

### F-19. MobileKeyBar overflows horizontally on a 390px viewport
**Where**: `src/components/ds/MobileKeyBar.tsx:125` (`overflow-x-auto`)
**What you see**: 16 keys + optional Run button at min-width 44px each = 704px minimum. iPhone-class viewport is 390px. The bar scrolls, but the right edge (`<`, `>`, `⏎`) is cut off mid-glyph in the static layout, no visible affordance that it scrolls.
**Why it's bad**: A learner doesn't know there are more keys to the right. The most useful Go glyphs (`<`, `>`, `&`, `*`) live in the cut-off region. The bar's *purpose* is "one-tap inserts" — half the inserts are off-screen.
**Suggested fix**: Either drop keys (Tab + braces + parens + `:=` + `*` + `&` + `⏎` are the real-use minimum), OR add an inset shadow on the right edge to signal scrollability, OR scroll-snap to keys so swipes reveal sets cleanly.
**Severity**: minor (severity bumps to major once you ship a mobile-Go learner)

### F-20. Icon and glyph weights are inconsistent
**Where**: site-wide. Survey: `→` (Text mono in LangCrumbs); `→` (mono in inline copy on homepage dek); `↑` (none — never used); `⌘` (Kbd); `↵` (Kbd in settings preview); `▸` (`·` in `/go` Accordion summary as `text-fg-faint font-mono mr-3`); `·` (mid-dot in breadcrumb); `—` (em-dash in body); `✓` (success tick in ModuleCompleteCard line 165)
**What you see**: The arrow glyph `→` is used for both *language pair* (TS → GO) and *sequence step* ("recognition → fill-in → freeform shape" in homepage dek) and *next-action* ("Next exercise →", "start →") — three meanings, one glyph. The success tick `✓` shows up once (in ModuleCompleteCard) but never elsewhere in correctness UI (Feedback uses a text label "Correct"). The Accordion summary uses a left-side numeric prefix (`1.`) but no triangle/chevron disclosure — even though `<details>` exists in the DOM with native disclosure.
**Why it's bad**: Glyph reuse without semantic distinction means learners can't pre-attentively parse a strip. Mixing `→` for both "language pair" and "next exercise" is the worst offender — both appear on the exercise page header.
**Suggested fix**: Pick one arrow per meaning: `↔` for pair (the languages relate bidirectionally), `→` only for forward navigation, `›` for breadcrumb separator. Document in design-docs/05.
**Severity**: minor

### F-21. Two passes at "the wedge" on homepage vs. /go using different DS primitives
**Where**: `src/pages/index.astro:60-79` (uses `<Compare caption=...>`) vs. `src/pages/go/index.astro:60-75` (uses `<Compare caption=...>`)
**What you see**: Both pages use `<Compare>`, so this is actually OK after a closer look — earlier draft of this review thought one used Compare and one used a raw grid; it doesn't. Striking through as a non-finding. *(Kept for reviewer-trail transparency; ignore in fix queue.)*
**Why it's bad**: n/a
**Suggested fix**: n/a
**Severity**: nit

### F-22. ModuleCompleteCard hand-rolls Heading, Eyebrow, big-stat presentation, and a Loading state
**Where**: `src/components/completion/ModuleCompleteCard.tsx:140-203`
**What you see**: Eyebrow string `"Module — Almost there"` rendered as `<div class="font-mono text-xs uppercase tracking-widest text-fg-muted">` (manual). Module title rendered as `<div class="text-fg-primary text-2xl font-semibold tracking-tight">` (manual; bypasses Heading). Stats rendered as triple `<div class="text-accent-amber text-3xl font-mono">{n}</div>` — a heading-class size that doesn't exist anywhere else on the site. The whole card runs at its own type ramp (text-3xl), not the DS's (text-4xl/text-2xl/text-lg).
**Why it's bad**: This is the celebration screen — the moment that determines whether a learner shares the site. It's also the most DS-bypassed component in the codebase. Drift here is most visible to the most engaged learners.
**Suggested fix**: Eyebrow → `<Eyebrow tone="muted">`. Title → `<Heading level={2}>`. Stats → extract a `<StatBlock value label>` primitive (number + Eyebrow label) and use it three times. Loading message → at minimum use `<Text tone="faint">`, not a hand-rolled inline div.
**Severity**: major

## DS contract violations the devs should pick up

These are *patterns*, not one-offs. Fix the pattern, find every instance.

1. **`!`-prefixed Tailwind utilities on DS primitives** — currently the dominant way pages override DS sizes. Today: five `!text-*` overrides on `Heading`. Tomorrow: someone will `!bg-*` over Panel. Either widen the DS API to accept the override or strip the `!` and live with the ramp.

2. **Arbitrary `text-[Npx]` values inside `src/components/ds/`** — at least seven instances at 10/11/13px. The DS forbids arbitrary *colours*; it should also forbid arbitrary *type sizes*. Add `--text-micro` and `--text-code` tokens; route everything through them.

3. **Hand-rolled primary-CTA class strings outside `Button.tsx`** — currently two (ExerciseShell, ModuleCompleteCard). Ship `ButtonLink`/polymorphic `as` and grep for `bg-accent-amber text-bg-base` outside the Button file as a review-time check.

4. **`<CodeBlock filename="…">` carrying non-filenames** — three call sites use it for a language name or prose. Either rename the slot (`label`) or split into two slots (`filename` + `caption`).

5. **Pill-shaped chips for everything that's a token** — Badge, breadcrumb, MCQ option, settings radio row, exercise card, code-block lang chip, Kbd, Eyebrow-with-border. Demote at least breadcrumb and MCQ-option to non-bordered. The user has flagged twice; the count is now north of seven distinct primitives in the pill family.

6. **Style axis presets that don't read on dark** — Cardboard's texture, Islands' shadow, Glass's blur all fail on dark because the recipes assume a light surface to texture/shadow against. The contract "each style adds at most three token overrides" is right; the recipes need *colour-axis-aware* values or per-axis-pair guards.

7. **Heading semantics decoupled from heading size** — pages set `level` for SR and `!text-*` for visual. Add a `size` prop independent of level, OR accept the ramp. Today the ramp lies.

8. **Glyph semantics doubled up** — `→` for language pair AND forward action; `·` as separator in two unrelated rhythms; `✓` used once and forgotten. Document a glyph table in design-docs/05.

9. **Contrast verification only done on dark** — F-2 proves the light-theme audit didn't catch the AA failure on the primary CTA. Re-run the audit on every contrast pair in light, OR write the Playwright check (referenced as open in 13-themes.md step 6) before adding more themes.

10. **Live preview on /settings shows the busiest possible composition, not the calmest** — three accent badges in one row is anti-promotional. Let the preview show what a *typical* page looks like, not every primitive at once.
