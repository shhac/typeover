# 24 — Proposer cycle 2026-05-20

Second proposer cycle after design-docs/20. Four feature proposals
across four design-goal lenses, each validated by sanity-check +
devil's-advocate sub-agents. Captured here for future authoring
cycles to pick up; nothing was implemented from this round — both
top-2 proposals scored 2/5 with the devil's advocate, with stronger
alternative framings emerging from the validation.

## Process

1. Four proposer agents launched in parallel, one per design lens:
   pedagogy, design-system, voice-and-feedback, a11y-mobile.
2. Top two proposals (highest impact + concrete file-level
   recommendation) selected: shaky-spots review chip + SR
   narration of Run results.
3. Each top pick validated with two parallel sub-agents: a
   sanity-checker reading the codebase to verify implementability,
   and a devil's advocate stress-testing the framing.

## Proposals (all four)

### P1 — "Shaky spots" review chip (pedagogy lens)

**Source:** Closes the loop between progress signals
(`instancesFailed`, `hintsUsedTotal`) and learner steering. Today
those counters are write-only.

**Shape (as proposed):** On the theme overview, surface a callout
listing exercises the learner passed-with-friction (failed first,
or used ≥2 hints). Deep-link to the wobbliest. Clear the shaky
state on a fresh clean pass.

**Validation result:**

- *Sanity check:* PASS-WITH-CAVEATS. All assumed fields exist;
  PROGRESS_CHANGED_EVENT pattern mirrors `ThemeProgressChip`.
  Architectural caveat: `recordCleanPass` belongs in
  `src/lib/exercise-phase.ts` alongside `recordInstancePassed`,
  not in `ExerciseShell.tsx`. 7-day-window semantics need
  clarification.
- *Devil's advocate:* CONFIDENCE 2/5. Three sharp objections —
  (1) lifetime aggregates structurally noisy (no per-instance
  hint flag), (2) negative framing contradicts 02-pedagogy's
  "Don't fail them; teach them" tone, (3) `ExerciseProgressChip`
  already exists on the same page and the proposal stacks a
  second negative signal.

**Stronger alternative surfaced:** Flip the framing. A positive
"drilled cleanly" affordance based on `instancesPassed >= 2` (or
similar) that celebrates re-engagement and clean passes.
Zero-punishment vector, no decay logic, no telemetry-dependent
threshold to tune. Same pedagogical leverage — strong spots
glow, weak spots stay grey — without importing Duolingo's
"cracked skill" anti-pattern.

**Recommendation:** Don't ship the negative version. Consider the
positive "drilled cleanly" variant in a future cycle — pair it
with a concrete UX mockup before authoring code.

### P2 — PaletteChip primitive + swatch grid (design-system lens) ✅ SHIPPED 2026-05-20 (`5735ed5`)

**Source:** The palette picker hides 22 named palettes behind
text-only radio labels. The picker is the one place where palette
identity matters as a visual fact; it's the one place where we
don't show the visuals.

**Shape:** New DS primitive `<PaletteChip palette="kraft" />`
(Solid) that renders a small swatch via scoped `data-palette` +
`data-theme` attributes — same cascade mechanism the page uses
globally, applied locally. Composes ~4 token reads
(`--color-bg-base`, `--color-bg-panel`, `--color-accent-primary`,
`--color-fg-primary`) into a 64×40 chip; glass-home palettes add
`--body-gradient`. Wire into `RadioGroup` via an optional `swatch`
slot.

**No validation run** in this cycle (resources spent on P1+P4).
Proposal is implementable as written; reuses existing cascade
without new token vocabulary.

**Implementation deviation:** The original proposal relied on the
existing `:root[data-palette="..."]` CSS cascade resolving at
nested scopes. It doesn't — the 46 palette selectors are
root-scoped only, and expanding them would touch every palette
block. Shipped version uses inline styles driven by a small JS
table (`PALETTE_CHIP_COLORS` in `src/components/ds/PaletteChip.tsx`)
that duplicates 2 colours per palette per theme (88 hex literals
total). A drift-guard vitest parses `global.css` and asserts every
table entry agrees with the live CSS — drift fails the suite. The
chip is therefore smaller in surface (background + accent dot, not
the proposed 4-tile composition) but ships the "honest visual
identity" win the proposal targeted.

### P3 — Modern Go shelf (voice & feedback lens)

**Source:** `successNote` + `alternateCanonicals` (shipped commit
`d2084ac`) surface honesty about Yaegi limitations only at the
right-phase of the exercise where they fire. Information dies
there — learners who skip ahead never see the heads-up.

**Shape:** A "Modern Go shelf" rendered on theme overviews (and
collapsed on module overviews) listing exercises whose canonical
is intentionally a step behind modern idiom. New schema field
`modernNote: { headline, reason }` distinct from `successNote`
(post-submit prose vs overview summary). Backfill 3 existing
exercises. `content:lint` warns on `alternateCanonicals` without
`modernNote`.

**No validation run** in this cycle.

**Recommendation:** Real gap but **diminishing returns until we
have more Yaegi-limited slots**. Currently 3 across the whole site
(arrays-and-slices/11, iteration/06, iteration/10). Revisit when
Module 3+ authoring surfaces another 2-3 limitations, or when the
Yaegi build is upgraded and the existing 3 retire (which would
also empty the shelf — the contract is self-retiring, so the
feature retires with it).

### P4 — SR narration of Run results (a11y lens) ✅ SHIPPED 2026-05-20 (`b3d924f`, lighter variant)

**Source:** `RunResultPanel` renders fresh stdout/stderr/error
with no `role` / `aria-live`. VoiceOver users hear silence when
Yaegi finishes; they have to manually tab to discover the result.
Half of design-docs/08's "live region validation messages"
contract is missing for Run (Submit's Feedback panel is already
correctly live).

**Shape (as proposed):** Wrap `RunResultPanel` in `role="status"
aria-live="polite" aria-atomic="true"`. Add `sr-only`
`<span>` summary built from a pure `summarise(result,
expectStdout)` helper. Add a "Running Go program…" companion
announcer to `RunResetToolbar`. Add `RunResultPanel` to the axe
matrix.

**Validation result:**

- *Sanity check:* PASS-WITH-CAVEATS. All path/shape claims verify;
  pattern already in house style (`Feedback.tsx`). Caveats:
  double-announce risk when Submit's Feedback also fires; re-render
  over-announcement if `expectStdout` ever becomes reactive
  mid-mount; "Running…" announcer chattiness on rapid Run/Reset.
- *Devil's advocate:* CONFIDENCE 2/5. Four objections —
  (1) audience is hypothetical (no SR user has filed an issue),
  (2) polite + atomic re-announce on rapid Runs would interrupt a
  debug loop with five verbose announcements, (3) "Press Submit
  to continue" copy is paternalistic (sighted users don't get
  that hint), (4) axe matrix bloat across 5 styles is real CI
  cost.

**Stronger alternative surfaced:** A LIGHTER variant — focus
management on Run-complete + a minimal `role="region"` with an
accessible name on `RunResultPanel`. Let SR users read the panel
on their own terms. Same WCAG 2.2 AA outcome, no announcement
fatigue, no copy debate, no matrix bloat. design-docs/08 also
permits this approach.

**Recommendation:** Ship the lighter variant when next a11y
attention surfaces. Concrete tasks:
- Move focus to `RunResultPanel`'s root on result-mount (mirror
  `Feedback`'s existing focus mechanism — `ExerciseShell.tsx`
  line ~103).
- Add `role="region" aria-label="Run result"` to the panel.
- Defer the verbose narration + matrix bloat until a real user
  asks for it.

## Synthesis & next steps

- ✅ **P2 PaletteChip:** shipped 2026-05-20 in commit `5735ed5`.
- ✅ **P4 SR narration (lighter variant):** shipped 2026-05-20 in
  commit `b3d924f`. Region landmark + focus-on-result-mount; no
  verbose narration string (deferred per devil's-advocate notes).
- **Defer:** P1 (shaky-spots, needs reframe as positive "drilled
  cleanly" with a UX mockup first) and P3 (Modern Go shelf, needs
  ≥2 more Yaegi-limited slots to earn its cost).

This cycle's two ship-able candidates are now both landed. The
next /loop tick should drop back to step 4 (improve-code-structure
on the new surface, or a fresh proposer round if the structure is
clean).

## Follow-up surfaced during P2 implementation

**Nested-scope palette cascade.** The PaletteChip implementation
duplicates two palette colours per theme in JS because the existing
`:root[data-palette="..."]` rules don't resolve at nested scopes.
A future cycle could expand all 46 palette selectors to also match
nested `[data-palette]:not(:root)`, which would let PaletteChip
(and any future scoped-palette surface) read the full token set
from the cascade without duplication. Estimated scope: ~1 hour
mechanical CSS edit + delete the JS table + delete the drift-guard
test. Worth doing if a second consumer ever wants a scoped palette;
not worth doing for just the chip.

When picking back up, see also design-docs/23 §"Follow-ups" for
the multi-input freeform grading roadmap item — that's a separate
infra investment from these four proposals but lives in the same
"after Module 2" backlog.
