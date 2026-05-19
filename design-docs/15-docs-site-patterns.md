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

### 1. Numbered eyebrows instead of section headers

**Today**: each home-page section announces itself with an `<h4>`
that the reader doesn't need ("Exercise preview", "Design system"
on `/`). Theme overview and exercise pages do similar.

**Pattern (Tailwind, Stripe)**: a big low-contrast mono `01` /
`02` / `03` to the left of the section's first heading. The number
*is* the structural cue; the heading text becomes content, not
chrome. When the number is enough, the heading can be deleted
entirely.

**DS primitive**: `<Eyebrow number="01">` or — cleaner — a CSS
counter on a parent container so authors don't have to number by
hand. Adds one token: `--type-step-num` (mono, ~2× body,
`color-mix(in oklab, var(--color-fg-primary), transparent 60%)`).

**Replaces**: the `<h4>` block-label rhythm on home + curriculum
+ theme overview pages.

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

### 4. `<Compare>` for TS↔Go side-by-side

**Today**: home page hand-rolls a 2-column grid of two
`<CodeBlock>` elements. Exercise pages do similar via
`<Adaptive>`. Both stack at narrow widths; both work; neither has
a shared caption or a hairline between.

**Pattern (novel, closest analog: Stripe's multi-language tabs —
but we want both visible)**: a primitive that takes two
`<CodeBlock>` children, lays them side-by-side with a thin
divider between, and renders one shared caption beneath. Collapses
to stacked at <1024px.

**DS primitive**: `<Compare>{ts}{go}{caption?}</Compare>` —
extension of the existing `<Adaptive>` with a caption slot and
the language wrapper from pattern 3 already applied.

**Replaces**: the duplicated grid + caption pattern on home,
theme intros, and the exercise hero region. This is the killer
move for a TS→Go learning site and the one that most signals
"this is a translation tool, not a generic course."

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

### 8. Hairline-only dividers

**Today**: `<Divider />` is a 1px line in `border-default`. Good.
Adjacent problem: too many regions are *also* getting boxed by
panels (`<Panel label="Buttons">` on home page is the textbook
example). The DS already supports hairlines; we just need to lean
on them harder and demote `<Panel label="…">` to where it earns
its keep (actual code-block frames, callouts).

**Pattern (Linear, Stripe Press)**: one hairline, one weight,
between page sections. No bordered cards for "groups of related
controls" — let the type + whitespace do the work.

**DS primitive**: no new primitive. Audit pass on existing pages:
replace `<Panel>` with `<Stack>` + `<Divider>` where the panel
exists purely to group, not to frame. The four panels on the
home-page DS inventory are the canonical example.

**Replaces**: the wiki feel on the home page directly.

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

- **Pattern 1** (numbered eyebrows) — when a third page lands with
  more than two `<h4>` block labels.
- **Pattern 2** (filename caption) — same sweep as #23 (CodeMirror
  integration). The two changes share `<CodeBlock>` surgery and
  should go together.
- **Pattern 3** (inline `code` by language) — first time a learner
  reports confusion about which language an inline mention refers
  to. Until then it's a polish lever.
- **Pattern 4** (`<Compare>`) — next time a page wants TS↔Go side
  by side with a shared caption. Hot candidate: the curriculum
  index intro, where we should be showing the wedge in a clear
  before/after.
- **Pattern 5** (marginalia) — first time a lesson wants a tip
  that doesn't fit the hint system. Build the primitive then; not
  before.
- **Pattern 6** (page rail) — when the first lesson lands with
  more than four prose sections. Today's lessons are short enough
  not to need it.
- **Pattern 7** (mono for data) — sweep alongside the
  module-completion screen polish, because that page is half data
  by area and is the natural place to set the precedent.
- **Pattern 8** (hairline dividers) — the cheapest. Do this in the
  same commit as patterns 1 or 7; the home-page DS inventory is
  the worst offender and is one file.

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
