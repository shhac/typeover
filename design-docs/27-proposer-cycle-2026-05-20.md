# 27 — Proposer cycle 5 (2026-05-20)

Fifth proposer cycle (after design-docs/20, /24, /25, /26). Cycle 4
landed three ships (P10 sitemap, P11 mobile scrollIntoView, P12
boot-stall escalation); cycle 5 opens with four NEW design-goal
lenses: local observability, in-site discoverability, test
coverage, UX polish.

## ICS first (post-cycle-4 audit)

Centralised the boot-stall timer invariant in `useYaegiRun` via a
new `setStatus(next)` wrapper. The "any transition out of
`booting` clears the stall timer" rule was previously enforced by
three hand-placed `clearStallTimer()` calls; after P12 added the
second piece of `booting`-coupled state, the analyst flagged that
a future status transition (e.g. a cancel state) was one call
away from leaking the timer. One file changed, behaviour
preserved. Commit `0980190`.

## Process

1. Four proposer agents launched in parallel on the lenses above.
2. Top two picks (P14 Resume CTA, P16 verify-runnable self-test)
   validated with sanity + devil's-advocate sub-agents — both
   landed at devil's-advocate CONFIDENCE 2/5.
3. The Resume CTA devil's advocate surfaced a tiny shipping
   alternative (static prose hint on `/go`) that captures the
   affordance-awareness without the JS-island cost; shipped this
   cycle.

## Proposals (all four)

### P13 — `/inspect` page (local observability)

**Shape.** New static page at `src/pages/inspect.astro` that
renders the live contents of typeover's localStorage keys in
human-readable form. Mounted as one `client:only="solid-js"`
island. Shows: progress (with per-exercise rows + bytes used),
appearance pins, corrupt-progress backups. Actions: Copy as JSON,
Download `.json`, Clear all typeover data (with confirm dialog).
Privacy page links to it.

**No validation run** in this cycle. Concrete, ~3-4h, reinforces
the privacy-first framing.

**Recommendation:** Strong candidate for the next cycle. Validate
first.

### P14 — Resume-where-you-left-off CTA (discoverability)

**Shape (as proposed).** A `client:idle` Solid island on `/` and
`/go` that reads `progress.lastSeenAt`, builds a "Resume:
<module> · <theme> · ex N" link, renders nothing when no progress
exists.

**Validation result:**

- *Sanity:* PASS-WITH-CAVEATS. Three concrete fixes: (1)
  `client:idle` is wrong — the codebase has standardised on
  `client:only="solid-js"` for localStorage-reading islands; (2)
  `read()` is module-private and needs a public accessor; (3)
  this would be the first JS island on `/`, a notable hydration-
  cost regression on the anonymous landing.
- *Devil's advocate:* CONFIDENCE 2/5. Sharper objections —
  `lastSeenAt` ticks on `recordInstanceSeen` (every mount,
  including 3-second bounces) so there's no clean "resume"
  semantics; hydration tax on the first JS island for `/` is
  paid by EVERY anonymous landing, the dominant cohort; `/go`
  already has per-theme ProgressChips that ARE the resume
  affordance; dead-end risk on stub-module routes (Modules 3-7
  have empty themes whose URLs would resolve but offer nothing).
  Recommends a one-line static prose hint instead.

**Action this cycle:** Static-hint alternative SHIPPED in commit
`[hash pending]`. One sentence on `/go` next to the coverage chip
("Progress saves per exercise — re-open any one to continue where
you left off. Nothing leaves your browser.") — teaches the
affordance + reinforces the privacy framing in 24 words. JS
island deferred.

### P15 — Per-theme progress chip on ThemeCard (UX polish)

**Shape.** A new `<ThemeProgressChip>` (note: would collide with
the existing component of that name on the theme-overview page;
needs rename — `<ThemeCardProgressChip>` or extension of the
existing one to accept a card-vs-overview mode). Renders "3 / 5
done" on each curriculum-grid card. Renders nothing when done=0
to preserve the unstarted-theme empty state.

**No validation run** in this cycle.

**Recommendation:** Worth validating in the next cycle.
Potentially the highest "returning-learner first-impression"
win, but the naming collision is real friction.

### P16 — `verify-runnable` self-test (test coverage)

**Shape (as proposed).** Refactor `verify-runnable.mjs` to export
`runVerifier({ rootDir, filter, yaegiEval })`. Add 7 vitest cases
against tiny fixture YAMLs under `runtime/yaegi-wasm/__fixtures__/`
covering all-pass / broken-stdout / Yaegi-error / missing-canonical
/ substitution semantics / filter / CLI exit-code smoke.

**Validation result:**

- *Sanity:* PASS-WITH-CAVEATS. Concrete refactor adjustments:
  move CLI parsing + `process.exit` out of `runVerifier` into
  the shell; parameterise the currently-hardcoded
  `src/content/exercises/**/*.yaml` glob; optionally inject a
  logger.
- *Devil's advocate:* CONFIDENCE 2/5. The script is 117 lines
  with 3 commits ever; stable since iter-4. A silent-exit
  regression would be loud in the existing console output. The
  verifier bypasses Zod entirely, so fixtures can diverge from
  real schema silently — meaning the meta-test gives *false
  reassurance* while costing maintenance. Test-the-test doubles
  the diff on every script refactor. No CI to enforce the
  meta-test even if it ran. Recommends a much lighter
  alternative: `runtime/yaegi-wasm/__broken__/*.yaml` + an
  `--expect-fail` flag (~15 lines, real coverage, no exported
  function, no fixture-as-API contract).

**Action this cycle:** Defer the heavy refactor. The lighter
`--expect-fail` alternative is worth considering for a future
cycle but requires touching the hardcoded glob path; not a
trivial 15-line change in practice. Capture both versions here
for future-Paul to decide.

## Synthesis & next steps

- ✅ **Static "progress saves" hint on `/go`** shipped this cycle
  as the Resume-CTA punt outcome.
- **Best ship-able candidates for the NEXT cycle (in priority
  order):**
  1. **P13 `/inspect` page** — strong privacy-first framing, no
     timing concerns, ~3-4h. Validate first.
  2. **P15 ThemeCard progress chip** — strong returning-learner
     value; needs naming-collision resolution with the existing
     `ThemeProgressChip`. Validate first.
- **Deferred (with documented alternatives):**
  - **P14 Resume CTA** — semantics swamp + first-island-on-`/`
    hydration regression. Static hint shipped as the lighter
    win.
  - **P16 verify-runnable self-test** — test-the-test fallacy +
    fixture treadmill + Zod-bypass false reassurance. Lighter
    `__broken__/` + `--expect-fail` alternative captured for
    later consideration.

## Meta-observation refreshed

The pattern is now consistent across cycles 2-5: top-2 picks
selected from a proposer round routinely come back at devil's
advocate 2/5 with strategic-timing or surface-cost concerns the
proposer didn't model. The proposer brief explicitly asks for
"a real gap and a clean fix"; the devil's advocate asks "is the
gap acute enough RIGHT NOW to justify the cost?". The asymmetry
is structural — proposers are optimising for "what's worth
building"; advocates are optimising for "what's worth NOT
building".

A process change captured for cycle 6: ask proposers to include
a "what makes this premature?" section in their brief. Forces
them to pre-stress-test before sub-agents have to. Might raise
the proposer-to-ship ratio above its current ~40% (8 of 19
proposals shipped across cycles 2-5).
