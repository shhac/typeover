# 15 — Docs-site patterns we should borrow

User feedback (2026-05-19): the site reads "label-blocky" — every
section announces itself with a header pill or panel chrome, every
example sits inside a bordered box, every meta is a badge. Reads
like Confluence, not like reading.

This doc captures the patterns from the docs sites most consistently
named as best-in-class in 2025–2026 (Stripe, Tailwind, Astro
Starlight, Linear, Stripe Press), filtered down to what makes sense
for typeover. Every pattern is mapped to **what it replaces** today
and to a token / DS primitive we'd add.

This is a proposal, not an implementation order. The current ship
works; this is the polish lever we pull when the launch checklist
is otherwise green.

## The one-line frame

> **Wiki uses containers** (boxes, pills, badges, full-bordered
> cards) **to communicate structure. Magazine uses typography and
> whitespace.** Every box we remove and replace with a type-scale
> jump or a whitespace gap moves us one step toward the feel we
> want.

That's the lens for every pattern below.

## Sites we're borrowing from

| Site | Why | What we steal |
|---|---|---|
| **Stripe Docs** | Consensus gold standard. | Prose-leads-code rhythm; inline `code` references coloured by language; right-rail "On this page"; marginalia-style callouts (no alert boxes). |
| **Tailwind Docs** | Best example of "no boxes, just whitespace + type." | Big mono numbered eyebrows (`01`, `02`) instead of `<h3>Step 1</h3>` pills; filename caption above code blocks, no rounded tab. |
| **Astro Docs (Starlight)** | Closest stack sibling. | Right-rail TOC pattern done with minimal JS; tabbed audience segmentation done in *one* shell. |
| **Linear Docs** | Restraint. | Hairline-only dividers; card subtitles in place of taxonomy headers; monochrome-plus-one-accent discipline. |
| **Stripe Press** | Editorial reference. | Single-column generous-whitespace opening for the lesson intro — feels like an essay, not a syllabus. |

## Patterns to consider

### 1. Numbered eyebrows instead of section headers — landed 2026-05-19 (no numbers yet)

**Today**: home page uses the `<Eyebrow>` DS primitive in place of
`<h4>` block labels. Each section reads as a small mono uppercase
caption (`EXAMPLE`, `DESIGN SYSTEM`) plus content. Per-group
sub-eyebrows inside the DS inventory pick up the language accent
(amber/ts/go/muted) so the showcase still signals identity without
panel chrome.

The proposal also included **numbered** anchors (`01`, `02`) — those
are deferred until a longer-form page needs the structural cue.
The Eyebrow primitive is shape-only today; a future `<Eyebrow
number="01">` is one optional prop away.

**DS primitive**: `<Eyebrow tone>` shipping in `src/components/ds/`.
Five tones (default / muted / amber / ts / go), one render shape
(`<span>` with `font-mono text-xs uppercase tracking-widest`).
Component tests pin the structural classes so a refactor that drops
uppercase or mono is caught.

**Replaced**: every `<Heading level={4}>` block label on the home
page (`Exercise preview`, `Design system`) plus the four
`<Panel label="…">` group containers inside the DS inventory.

### 2. Filename caption above code, not language pill

**Today**: `<CodeBlock lang="ts" filename="users.ts">` renders a
language pill + filename strip with a coloured background per
language. Reads as "tab UI."

**Pattern (Tailwind, Astro)**: the filename is a small mono caption
in `fg-muted`, thin underline or hairline above the code block.
No rounded tab. No language pill — the *colour* of the code
syntax-highlight already tells you it's TS or Go.

**DS primitive**: extend `<CodeBlock>` to render
`<figcaption class="font-mono text-xs text-fg-muted">` above the
`<pre>`. No new tokens.

**Replaces**: the current `lang` pill + filename strip. The
language pill can stay reachable as a screen-reader-only label
(`<span class="sr-only">TypeScript example</span>`) so a11y
doesn't regress.

### 3. Inline `code` references coloured by language

**Today**: prose mentions like "use `fmt.Println` to print" render
in the inline-code style (subtle inset background, mono) — all
the same colour regardless of language.

**Pattern (Stripe)**: inline `code` inside prose adopts the
language's accent colour (TS-blue, Go-cyan) when the surrounding
context declares a language. Hovering a name *could* highlight
its appearance in a nearby block; skip for v1.

**DS implementation**: a `[data-lang="ts"]` / `[data-lang="go"]`
wrapper colours `:not(pre) > code` via the cascade. The lesson
component owns the wrapper; authors don't repeat themselves.

**Replaces**: undifferentiated grey inline code. Reinforces the
language identity the colour theme already commits to.

### 4. `<Compare>` for TS↔Go side-by-side — landed 2026-05-19

**Today**: `<Compare caption?>` wraps the existing `<Adaptive>` in
a `<figure>` + `<figcaption>`. The home-page TS↔Go example is the
first caller; pickup criterion now is "next time a page wants the
same shape" — the primitive is ready.

The pattern-3 "language wrapper" hadn't landed yet when Compare
shipped, so the language identity comes from the CodeBlock's `lang`
prop (its filename strip + syntax-highlight colour) rather than a
surrounding `[data-lang]` parent. When pattern 3 lands it slots in
underneath Compare cleanly because Compare doesn't own the
per-column colour decision.

**DS primitive**: `<Compare>` in `src/components/ds/`, semantic
`<figure>` + `<figcaption>` with a 12px gap. Component tests pin
the figure/figcaption structure so the magazine semantics can't
silently regress to "two divs next to each other."

**Replaced so far**: the hand-rolled `<div class="grid grid-cols-1
md:grid-cols-2 gap-4">` + separate `<Text size="sm">` caption on
the home page. Exercise pages still use `<Adaptive>` directly
since they don't have a shared caption — that's the right call;
not every two-column layout is a comparison.

### 5. Marginalia callouts, not alert boxes

**Today**: nothing exists yet; when we add tips/warnings the
default reach is for a coloured panel with an icon.

**Pattern (Stripe Press, Linear)**: an italicised block with a
2px left rule in `accent-amber-dim`. No icon. No coloured fill.
Pulled into the page rhythm rather than interrupting it. The
*coloured* callout is reserved for genuine warnings (max one per
lesson).

**DS primitive**: `<Marginalia>` and `<Warning>` — two distinct
shapes with their own intentions, not one `<Callout type="…">`.
Adds one token: `--marginalia-rule: 2px solid var(--color-accent-amber-dim)`.

**Replaces**: the temptation to ship a Docusaurus-style rainbow
of info/tip/note/warning cards. We pick two shapes and stay
disciplined.

### 6. Right-rail "On this page" with scroll-spy

**Today**: no in-page TOC. Lessons are short enough that one
hasn't been needed, but the theme overview and module overview
pages already have enough sections to benefit, and longer
freeform exercise prompts will too.

**Pattern (Stripe, Tailwind, Vercel)**: a thin right-rail TOC,
~30 lines of vanilla JS using IntersectionObserver, hydrate
on-idle. Active link gets `fg-primary`; inactive ones `fg-muted`.
No background, no chrome — pure typography.

**DS primitive**: `<PageRail>` — a layout slot in
`<BaseLayout>` that lessons + overview pages opt into. Solid
island for the scroll-spy logic. Adds one token:
`--rail-fg-muted: color-mix(in oklab, var(--color-fg-primary), transparent 60%)`.

**Replaces**: zero — purely additive. The reason to add it
*before* needing it is to set the expectation that long content
gets a rail; otherwise we'll be tempted to break long lessons into
shorter ones for the wrong reason.

### 7. Numeric/data lockups in mono, prose in sans

**Today**: this rule is *partially* honoured — code uses mono,
prose uses sans — but counters and metadata are inconsistent.
Progress counters in the curriculum tree, exercise-difficulty
badges, etc. drift between mono and sans.

**Pattern (Bloomberg-terminal half of our identity)**: any
"data-like" thing is mono. Counters ("3 / 12"), exercise numbers
("#04"), times ("~3 min"), version strings ("v0.0.0"). Reserve
sans for prose.

**DS primitive**: a `<Data>` text variant (or a tone="data" on
`<Text>`) that locks the family + size + tracking. Authors stop
remembering which fields are mono.

**Replaces**: the inconsistent badge-vs-text usage on the
home + curriculum + completion screen. Reinforces the
terminal half of the identity without crowding the reading half.

### 8. Hairline-only dividers — landed 2026-05-19 (home page)

**Today**: home page no longer wraps DS-inventory groups in
`<Panel label="…">` chrome. Each group is a `<Stack>` + small
mono `<Eyebrow>`. The four hairline `<Divider />` instances still
mark major rhythm changes between hero, example, DS inventory,
footer — that's where they earn their keep.

The audit pass to do this everywhere else hasn't run; other pages
(curriculum, theme overview, exercise) didn't have the
panel-as-group anti-pattern so they didn't need touching.
Marginalia panels (pattern 5) still use `<Panel>` properly —
that's framing, not grouping.

**DS primitive**: no new primitive. Component-level audit + page
rewrite per pickup.

**Replaced**: the wiki feel on the home page directly. New
authoring guidance below.

### 9. Persistent "back to home" — global brand anchor

*Surfaced 2026-05-20 from user feedback: "no way to get back to
the homepage from Curriculum / Settings / etc."*

**Today**: the only return-home path on most pages is the footer
`typeover` link. The page's *header* region has no
always-present link to `/`; learners on `/go` need to know to
scroll to the footer or use browser back. Same problem on
`/settings`, `/privacy`, the completion screen, and exercise
routes.

**Pattern (Stripe, Linear, Astro Docs)**: the **brand wordmark
in the top-left is always linked to home**. Doesn't compete with
a breadcrumb because the wordmark is *identity*, not navigation.
Page-specific breadcrumbs live underneath it.

**DS primitive**: extend `BaseLayout.astro` with a tiny
sticky-or-static header strip containing a single `<a href="/"
class="font-mono">typeover</a>` left, and (optionally) a
quiet right-edge link to `/go`. No avatar, no menu — just the
identity anchor. The footer wordmark stays as redundancy.

**Replaces**: silent dead-ends. Cross-references the "pick two"
anti-pattern below: brand-anchor + breadcrumbs + rail is still
two-anchor types (identity + crumbs), not three different
navigation languages.

### 10. Curriculum index — TOC sidebar OR accordion

*Surfaced 2026-05-20: "Curriculum should either have a contents
section, or should be an accordion, or both (currently it is a
wall)."*

**Today**: `/go` renders every module as a long flat section,
with all themes shown inline as a grid of cards. With 7 modules
× ~4-6 themes each, the page is ~10 screens tall and hard to
navigate.

**Pattern (Stripe Docs, Astro Docs, MDN)**: a sticky left-rail
TOC listing modules; clicking jumps to the anchor; the rail
highlights the in-view section via the same IntersectionObserver
pattern as Pattern 6. *Plus or instead*: each module's theme
grid collapses to an accordion that defaults open for Module 1
(launch-gate) and collapsed for Modules 2-7 (scaffolded /
empty).

**DS primitives**: `<Accordion>` (new) with `defaultOpen` prop;
reuse `<PageRail>` from Pattern 6 for the TOC. Both can ship
independently — left-rail first (mechanically smaller), then
accordion (changes the read flow).

**Replaces**: the "wall of curriculum" UX. A returning learner
who completed Module 1 can collapse it; a fresh learner sees
Foundations expanded.

### 11. Homepage as track-overview; DS moves to `/design-system`

*Surfaced 2026-05-20: "The design system should be shown on
`/design-system`, not on the homepage. The homepage can have a
bit more content dedicated to offering the Go course, a pattern
where a future language would slot in alongside/below the Go
one."*

**Today**: the home page (`/`) shows the hero, one TS↔Go
example, the DS inventory grid (Buttons / Badges / Keys /
Tones), and a footer. The DS grid is dev-facing and crowds out
what the site IS to a new visitor.

**Pattern (Stripe, Vercel)**: home is a **track overview**.
Today that means a single track ("Go for TypeScript devs") laid
out as: hero → wedge example → Module-1 overview card with a
"start here" CTA → a "more languages" slot below ("Rust for TS
devs — proposed; not authored"). The DS inventory moves to a
dedicated `/design-system` route that the DS contributor opens
intentionally; learners never see it.

The future-language slot is the structural commitment: the
homepage layout treats Go as the first of many, even when it's
the only one. A second language only requires *content* — no
homepage restructure.

**DS primitive**: a new `<TrackCard>` for the per-language
"course offering" block (title + dek + module list + CTA).
First caller: Go. Second caller (whenever): Rust/Zig/Python/etc.

**Replaces**: the DS-inventory-on-homepage anti-pattern. Adds a
multi-language-ready layout without committing to multi-language
content.

### 12. Less pills — alternatives to box-pill identity

*Surfaced 2026-05-20: "I don't like how many visual components
we have are pills/box-pills, is there a different style we can
use?"*

**Today**: Badge, Button, ProgressChip, Eyebrow's container all
use the same `border + rounded-sm + padding` pill shape, with
colour the only differentiator. The result is repetitive at any
density: a row of three "pills in slightly different colours"
even when they're meant to be visually distinct concepts.

**Alternatives**: rather than every-tag-is-a-pill, layer the
visual language across at least three shapes:

- **Underline-as-accent.** A language identifier renders as
  `TS` with a 2px bottom border in the language colour, no fill,
  no border-box. Mono. Smaller footprint, clearer hierarchy.
  Lands as a `<Tag>` primitive (vs the existing `<Badge>` pill).
- **Bracket-glyphs.** Text wrapped in mono brackets — `‹TS›`,
  `[focus]`, `«passed»`. Type-only emphasis; no border at all.
  Carries the terminal-text identity without the chrome.
- **Inline-marker.** A leading single-character glyph (▸, ◆, ▪)
  in the language colour, then text. Works inside flowing prose
  in a way pills can't.

Pillhood stays appropriate for *actionable* things (Button), but
for *informational* things (Badge today), bracket-glyphs or
underline-accents read lighter. Pickup criterion: when adding the
next informational label that "wants to be a Badge", build the
alternative shape instead and re-evaluate Badge's role.

This pattern is also a natural test surface for the **Style
axis** in [14-stylistic-themes.md](14-stylistic-themes.md) — a
Terminal-style learner gets brackets, a Glass-style learner
might get filled translucent badges, etc.

## Anti-patterns we explicitly skip

These came up in the research and we're naming them so they
don't sneak in:

- **Heavy hydration for prettiness.** No Framer-Motion-style
  page transitions, no animated section reveals on scroll. Astro's
  strength is shipping zero JS on static pages — honour it. The
  whole site gets two islands max for this layer (scroll-spy +
  code-copy).
- **Tab components for things that should be two columns.** Tabs
  hide the comparison. typeover's whole pitch is *seeing both
  languages*. `<Compare>` (pattern 4) is the answer; tabbed
  language switchers are the antipattern.
- **Coloured fill on every callout type.** Pattern 5 says: amber
  for emphasis (one shape), filled card for real warnings (one
  shape). Skip the info/tip/note/danger/success rainbow.
- **Breadcrumbs *and* sidebar *and* in-page anchors.** Pick two.
  Today we have breadcrumbs only. When the rail (pattern 6) lands,
  we have rail + breadcrumbs — that's enough; resist the sidebar.
- **Hero illustrations on lesson pages.** Reserve hero treatment
  for `/go` (curriculum index) and module-overview pages. Lesson
  pages open with prompt + immediate work.
- **`<h3>Examples</h3>` / `<h3>Notes</h3>` blocky labels.** Most
  of those headings are scaffolding the author wrote for
  themselves; the reader infers structure from rhythm. If you
  can't delete it, demote it to a small-caps mono eyebrow.

## What this doc doesn't decide

- **Implementation order.** Patterns are independent; pick the
  one that's bothering you most when you sit down.
- **Tokens before authoring.** Some patterns (3, 5, 6) introduce
  new tokens. Add them in the same commit that lands the pattern;
  don't pre-populate the token catalogue with unused names.
- **Migration cost.** Patterns 1, 2, 4, 8 require touching
  shipped pages (`/`, `/go`, theme overview, exercise route). The
  cost is small per page; do it in a sweep when one of them is
  the next-best lever, not now.

## Pickup criteria

Per pattern, the trigger for actually doing it:

- **Pattern 1** (eyebrows, no numbers yet) — *landed 2026-05-19*
  on the home page. Numbered variant (`01`, `02`) deferred until
  a longer-form page wants the structural cue.
- **Pattern 2** (filename caption) — same sweep as #23 (CodeMirror
  integration). The two changes share `<CodeBlock>` surgery and
  should go together.
- **Pattern 3** (inline `code` by language) — first time a learner
  reports confusion about which language an inline mention refers
  to. Until then it's a polish lever.
- **Pattern 4** (`<Compare>`) — *landed 2026-05-19* on the home
  page **and** the curriculum index intro (the "hot candidate"
  case study). Next caller will be a theme intro when one wants
  the side-by-side shape.
- **Pattern 5** (marginalia) — first time a lesson wants a tip
  that doesn't fit the hint system. Build the primitive then; not
  before.
- **Pattern 6** (page rail) — when the first lesson lands with
  more than four prose sections. Today's lessons are short enough
  not to need it.
- **Pattern 7** (mono for data) — sweep alongside the
  module-completion screen polish, because that page is half data
  by area and is the natural place to set the precedent.
- **Pattern 8** (hairline dividers) — *landed 2026-05-19* on the
  home page. Audit not run on other pages because they didn't
  exhibit the panel-as-group anti-pattern.
- **Pattern 9** (persistent back-to-home) — *next pickup,
  surfaced 2026-05-20.* Cheap (one header strip in
  BaseLayout); blocks no other work; immediately fixes the
  dead-end UX on /go, /settings, /privacy.
- **Pattern 10** (curriculum TOC / accordion) — pickup
  alongside Module 2+ content, since the wall-of-curriculum
  problem gets worse with more content.
- **Pattern 11** (track-overview homepage + `/design-system`
  route) — pickup before launch; the DS-inventory-on-home is
  the worst remaining "this looks like a dev's repo" cue.
- **Pattern 12** (less pills) — explore alongside the **Style**
  axis from design-docs/14 so the new shapes have a thematic
  home rather than landing as one-off primitives.

## Cross-references

- DS contract — [05-design-system.md](05-design-system.md). Every
  pattern here lands as a DS primitive or token, not as a
  one-off.
- Colour themes — [13-themes.md](13-themes.md). The patterns here
  are colour-agnostic by design.
- Density + shape themes —
  [14-stylistic-themes.md](14-stylistic-themes.md). Patterns
  compose with the stylistic axes; a `compact` + `sharp` reader
  and an `airy` + `rounded` reader get the same magazine rhythm,
  just at different scales.

## Source notes

Research pass 2026-05-19 — synthesised from listicles, Stripe/
Tailwind/Astro/Linear/Stripe Press direct fetches, and 2025–2026
docs-design roundups. Search results were thinner than expected
on community opinion; the heavy lifting is direct-fetch
characterisation of canonical sites. Reflect that uncertainty:
treat this as a strong-prior proposal, not a citable consensus.
