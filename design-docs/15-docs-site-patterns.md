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
