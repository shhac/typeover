# 25 — Proposer cycle 3 (2026-05-20)

Third proposer cycle (after design-docs/20 and design-docs/24).
Both cycle-2 ship-able candidates landed in commits `5735ed5` and
`b3d924f`; running cycle 3 with four NEW design-goal lenses
(performance, onboarding, persistence, curriculum coverage) to
surface what's next.

## Process

1. Four proposer agents launched in parallel, one per lens.
2. Top two picks (persistence-export + Module 3 brief) validated
   with sanity-check + devil's-advocate sub-agents (4 validators).
3. Both top picks landed with strong devil's-advocate AGAINST
   verdicts on **strategic timing**, not implementability. Neither
   ships in this cycle; the alternative actions surfaced by the
   validators landed in their place.

## Proposals (all four)

### P5 — Hover/focus warm-prefetch of Yaegi WASM (performance lens) ✅ SHIPPED 2026-05-20 (`aa5241b`)

**Shape.** A tiny `prefetchYaegi()` helper that injects a
`<link rel="prefetch" as="fetch" href="/yaegi/yaegi.wasm">` on
first intent signal (hover / focusin / touchstart) over any
`/go/*` link, gated by `saveData` and `effectiveType !== "slow-2g"`.
Smallest first cut: ~30 lines + global listener in BaseLayout.
Per-card `data-needs-yaegi` gating (skip the prefetch on MCQ-only
themes) is a follow-up.

**No validation run** in this cycle (resources spent on P7+P8).
Concrete, measurable in DevTools, no strategic-timing risk.

**Recommendation:** **Strong candidate for next cycle.** Tight
scope, real performance win on mobile/3G time-to-first-Run, no
schema or backend surface. Should validate + ship.

### P6 — First-time learner banner on `foundations/variables/01` (onboarding lens)

**Shape.** A dismissible 3-line banner that surfaces ABOVE the
`<Panel>` on the very first exercise, explaining the pedagogy
escalation (MCQ → fill → freeform). Gated to the exact route and
to learners with no prior progress. Smallest first cut: prose-only
banner with no JS, gated to the literal route.

**No validation run** in this cycle.

**Recommendation:** **Worth landing**, but lower confidence than
P5. Until we have first-time-user behavioral data the banner is
guessing at the friction point. Safe to ship the prose-only first
cut without the dismiss / localStorage gating — minimal commitment,
easy to revert.

### P7 — Export progress as JSON (persistence lens)

**Shape (as proposed).** A `<DataPortabilityCard>` island on
settings with an Export button. Builds a `PortableSchema` envelope
(kind / exportedAt / appVersion / progress / appearance) and
triggers a Blob download. Smallest first cut: export-only, no
import.

**Validation result:**

- *Sanity:* PASS-WITH-CAVEATS. 4 concrete fixes — export
  `ProgressSchema` from `progress.ts` (currently module-local), use
  choice-variant appearance reads so `"system"` / `"default"`
  round-trip, drop or wire `appVersion` (`package.json` is
  `"0.0.0"` placeholder and no vite `define` exposes it), call
  `URL.revokeObjectURL` to avoid the leak. All implementable.
- *Devil's advocate:* AGAINST (numerical confidence inverted but
  argument is clearly AGAINST). Four objections — (1) audience is
  thin: niche site, few users get far enough to feel the loss;
  (2) the privacy page's "no copy, per-device only" framing is a
  selling point that export quietly undermines; (3) **the
  half-feature trap is the killer**: a one-way-door button with a
  JSON file that has no consumer until import lands is a placebo;
  (4) shipping pins `ProgressSchema` v1 as a public contract that
  every future tweak has to migrate. Real ask is sync, not export.

**Stronger alternative surfaced:** Punt. Add a one-line note to
`privacy.astro` saying "Want a backup of your progress, or to move
it between devices? Open an issue and we'll prioritise it." Costs
nothing, validates demand before commitment.

**Action this cycle:** Privacy-page note shipped (see commit log
below). Export proposal parked until a real user asks for it.

### P8 — Write `design-docs/25-module-3-authoring-brief` (curriculum-coverage lens)

NB: The proposer named this "design-docs/25"; this very document
took that slot. Module 3 brief would be design-docs/26 if it lands.

**Shape (as proposed).** Mirror design-docs/23 exactly. Four
themes: 3.1 structs (~10), 3.2 methods (~10), 3.3 pointers (~8),
3.4 nil-and-zero-values (~6). Authoring order 3.1 → 3.3 → 3.2 → 3.4
(pointers before methods for the receiver discussion). Smallest
first cut: just the 3.1 slot table + module preamble.

**Validation result:**

- *Sanity:* PASS-WITH-CAVEATS. Three concrete folds-in:
  1. Update `methods.yaml` prereqs to include `types/pointers` to
     match the authoring order.
  2. Pre-flag two Yaegi divergences in a "Runtime notes" section:
     pointer-receiver-on-non-addressable-literal (Yaegi accepts
     what real `go` rejects), and nil-pointer-deref produces an
     opaque `reflect: ...` message instead of Go's canonical
     `runtime error: invalid memory address or nil pointer
     dereference`. (Interface-wraps-nil-pointer works correctly —
     headline 3.4 gotcha is teachable.)
  3. Pre-commit a phrasebook framing for 3.2 (value vs pointer
     receivers has no clean TS analog) and 3.3 (TS-references-
     aren't-one-rule).
- *Devil's advocate:* AGAINST (numerical confidence inverted again
  but substance clearly AGAINST). Strongest objection: **Module 2
  has zero learner signal yet**. The doc-23 template was itself
  v2 informed by Module 1 feedback; doc-26 (for Module 3) should
  be v3 informed by Module 2. Locking a brief now ships the
  blind spots forward. Plus: Module 3 is the "structural shift"
  (receivers, method sets, embedding) — the MCQ → fill → freeform
  escalation might need an additional "concept reveal" beat the
  doc-23 template doesn't have. Plus: Yaegi gaps in method-sets
  are unmodeled at brief-time.

**Stronger alternative surfaced:** Defer the brief 1-2 weeks.
Build infra that pays back across Modules 3-7 (content-coverage
meter, `pnpm content:report`). Ship a preview launch on Module
1+2 as the cheapest learner-feedback channel. Then write the brief
informed by real signal.

**Action this cycle:** Brief deferred. Two infra follow-ups
queued (see "Next steps" below).

## Synthesis & next steps

- ✅ **Privacy-page backup note** shipped this cycle as the export
  proposal's punt outcome — one paragraph on `privacy.astro`
  inviting learners to open a GitHub issue if they want a backup.
- ✅ **P5 Yaegi prefetch** shipped 2026-05-20 in commit `aa5241b`.
  Smallest-first-cut: inline document-level listener on off-route
  pages, gated by saveData + slow-2g + idempotence. 5 drift-guard
  tests pin the load-bearing predicates.
- ✅ **`pnpm content:report` infra** shipped 2026-05-20 in commit
  `3099e14`. Per-module Markdown table + summary line; smoke test
  pins output shape (counts intentionally NOT asserted). Current
  snapshot: 90 exercises, 9/31 themes covered, 29% launch.
- **Next ship-able candidate:**
  1. **Content-coverage meter on the curriculum page.** A live
     visual derived from the same content-report data — surfaces
     pre-launch theme stubs visually rather than only in the lint
     / report output. Could be a small Solid island on `/go` that
     reads the same content collection Astro builds against and
     paints a progress chip per module.
- **Deferred (need more signal first):**
  - **P6 onboarding banner.** Worth landing in prose-only form
    eventually, but a re-look once real visitors have arrived
    will inform the copy better than guessing.
  - **P7 export progress** — punt confirmed; revisit when an
    issue is filed asking for it.
  - **P8 Module 3 brief** — defer until Module 2 has 2-4 weeks of
    learner exposure. Yaegi runtime caveats from the sanity check
    captured here so the eventual brief can fold them in
    immediately.

The pattern across cycles 2 and 3 is that devil's-advocate
reviewers consistently surface strategic-timing concerns the
proposers don't model. Worth thinking about whether the proposer
brief should explicitly require "what would have to be true for
this to be premature?" as a section, so each proposal arrives
pre-stress-tested.