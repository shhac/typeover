# 26 — Proposer cycle 4 (2026-05-20)

Fourth proposer cycle (after design-docs/20, /24, /25). Cycle 3
shipped three candidates (P5 Yaegi prefetch, content:report,
curriculum coverage chip) and one user-asked round (textbook
palette consolidation, fill-word + fill-line UX, radio dots).
Cycle 4 opens four fresh lenses per the /25 suggestion:
content-authoring DX, release readiness, mobile UX, recovery /
error states.

## Process

1. Four proposer agents launched in parallel, one per lens.
2. Top two picks selected for validation (`--types` flag for
   `content:new`, and sitemap + robots + canonical link).
3. Four validators (sanity-check + devil's-advocate per pick)
   spawned in parallel; three returned by ship time. The fourth
   (sitemap devil's advocate) had not landed; the sanity-check
   was strong enough on its own to greenlight given the modest
   surface and the official-integration swap.

## Proposals (all four)

### P9 — `--types=mcq:6,fill-word:2,...` flag on `pnpm content:new theme`

**Shape (as proposed).** Replace the hard-coded 3/2/2/2
`SLOT_BUILDERS` array in `scripts/content-new-theme.mjs` with a
parsed `--types` value. Fall back to 3/2/2/2 when absent. Cap 20.
Smallest first cut: parser + dynamic builder list + a vitest
asserting the parser's contract.

**Validation result:**

- *Sanity:* PASS-WITH-CAVEATS. All file/line claims verified; the
  existing flag convention (`--prereqs` already comma-splits) fits
  idiomatically. Minor cleanup needed: the final report message
  hard-codes `{01..09}.yaml` (must reflect actual count) and the
  stub `notes:` mention specific slot positions that go stale on
  reorder.
- *Devil's advocate:* CONFIDENCE 2/5. Strong objections — the
  follow-up has been twice-deferred (design-docs/23 → /25), so
  the pain isn't actually fresh; the stubs differ in
  `generator.vars` / `runtime` / `expectStdout` / `distractors`
  (not just `type:`), so a `--types` flag actually swaps whole
  stub bodies; the author can hand-edit faster than learning
  a flag's invocation; and the Module 3 brief is itself
  deferred, so we'd be building `--types` ahead of knowing the
  slot mix it'd serve.

**Action this cycle:** Defer (same pattern as cycle 2 + 3 — the
devil's advocate consistently surfaces strategic-timing concerns
proposers don't model). Revisit if a real Module 3 authoring
session surfaces the pain with fresh evidence.

### P10 — Sitemap + robots.txt + canonical link (✅ SHIPPED 2026-05-20)

**Shape (shipped, simplified per sanity-check):** Use the official
`@astrojs/sitemap` integration instead of a hand-rolled script.
One `pnpm add @astrojs/sitemap` + integration config in
`astro.config.mjs`, with a `filter` that excludes the two
internal dev tools (`/design-system` + `/runtime-smoke`). Static
`public/robots.txt` matching. One-line `<link rel="canonical">`
added in `BaseLayout.astro` next to the OG meta block.

**Validation result:**

- *Sanity:* PASS-WITH-CAVEATS. Two material findings — (1) drop
  the hand-rolled `scripts/build-sitemap.mjs` proposal in favour
  of the official `@astrojs/sitemap` integration (one config
  line vs. content-collection walking + git mtime + priority
  tiering as maintenance burden), and (2) the proposed static
  exclude list omitted `/runtime-smoke` which is also an internal
  dev probe.
- *Devil's advocate:* did not return by ship time. Decision
  proceeded on the strength of the sanity-check + the modest
  surface area (one config line + 6-line robots.txt + 1-line
  BaseLayout edit). If a critical concern arrives, the change is
  trivially revertible.

**Action this cycle:** SHIPPED in commit `[hash pending]`. The
build emits `dist/sitemap-index.xml` + `dist/sitemap-0.xml`
(135 URLs covering home, curriculum, all 7 module overviews, all
31 theme overviews, all 90 exercises, privacy, settings) and
serves `dist/robots.txt`. A new smoke test
(`scripts/sitemap-shape.test.ts`) pins the contract: index +
chunk + robots emitted, canonical origin, dev tools excluded,
high-priority routes present. Skips when `dist/` is absent so
the suite doesn't break for developers running `pnpm test`
without a recent build.

### P11 — `scrollIntoView` the RunResultPanel above the soft keyboard (mobile UX) ✅ SHIPPED 2026-05-20 (`872b107`)

**Shape.** Extend `useRunResultFocus` (used by Freeform +
FillBlankLineInput) to detect when the freshly-focused
`RunResultPanel` is occluded by the iOS Safari soft keyboard
(via `visualViewport`), and `scrollIntoView({ block: "end" })`
the panel into the visible slice. Extract `useKeyboardInset()`
from `MobileKeyBar` into `src/lib/use-keyboard-inset.ts` to avoid
a circular import.

**No validation run** in this cycle.

**Recommendation:** Strong candidate for the next implementation
tick. Concrete iOS Safari pain point, clean addition to an
existing hook, no new deps, axe matrix untouched. 2-5h.

### P12 — Boot-stall escalation when Yaegi WASM cold-start exceeds 5s (recovery)

**Shape.** Add a `bootStalled` signal to `useYaegiRun` that flips
true if `status === "booting"` for >5s. `RunResetToolbar`
escalates the badge to "Still downloading runtime — slow
network?" and renders a "Retry runtime" ghost button that calls
the existing `reset` path. Generation-guard reuses the existing
`bumpGen` mechanism.

**No validation run** in this cycle.

**Recommendation:** Good quality-of-life win for flaky-network
learners. 2-3h, clean test path with fake-timers + a
never-resolving runner mock. Worth landing after P11 if cycle 5
opens.

## Synthesis & next steps

- ✅ **P10 Sitemap + robots + canonical** shipped this cycle.
- ✅ **P11 Mobile scrollIntoView** shipped 2026-05-20 in commit
  `872b107`. `useKeyboardInset` lifted from MobileKeyBar into
  `src/lib/use-keyboard-inset.ts`; `useRunResultFocus` reads it
  to scroll the panel above the iOS soft keyboard slice with
  `prefers-reduced-motion` respected. 5 jsdom-mocked tests pin
  the visualViewport-driven scroll path.
- **Next ship-able candidate:**
  1. **P12 Yaegi boot-stall escalation** — concrete stuck-state
     fix for flaky networks. ~2-3h.
- **Deferred:**
  - **P9 `--types` flag** — twice-deferred follow-up; revisit
    with fresh Module 3 pain.

## Meta observation across cycles

The pattern is now consistent across cycles 2-4: when devil's-
advocate validators are run, they surface STRATEGIC-TIMING
concerns the proposers don't model. The proposers tend to
optimise for "this is a real gap, here's a clean fix"; the
devil's advocates ask "is the gap acute enough RIGHT NOW to
justify the schema/contract/footgun cost?". The proposer brief
might benefit from an explicit "what would have to be true for
this to be premature?" section so each proposal arrives
pre-stress-tested. Captured here as a process improvement;
applies to whatever runs cycle 5.
