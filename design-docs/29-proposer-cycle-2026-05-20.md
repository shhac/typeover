# 29 — Proposer cycle 6 (2026-05-20)

Sixth proposer cycle (after design-docs/20, /24, /25, /26, /27, /28).
First cycle to use the new "what makes this premature?" prompt
section (introduced as a process improvement in design-docs/27
after observing the consistent proposer-vs-validator asymmetry
across cycles 2-5).

## Result this cycle: ship nothing — and that's the point

All four proposals self-deferred in their own premature-check
section. The new prompt produced proposers who pre-stress-test
their own ideas at roughly the level a devil's advocate would.
No external validators needed; the gate happened in the proposer
brief itself.

This is a meta-pattern shift worth captaining: cycles 2-5 spent
heavy compute on validator sub-agents to surface timing concerns,
and the recurring outcome was "defer with a documented lighter
alternative". Cycle 6 spent the same compute on the proposer's
self-stress-test and got the same outcome at half the agent count.
Worth keeping for cycles 7+.

## Fresh lenses this cycle

Four NEW design-goal lenses (none used in prior cycles):

1. **Code-editor UX** — improvements to the textarea + MobileKeyBar
   experience for freeform / fill-line typing.
2. **Learner-facing documentation** — the supporting prose
   around exercises (FAQ, glossary, /about).
3. **Browser-level / visual regression testing** — the e2e gap
   below cycle 5's vitest lens.
4. **Author-facing diagnostics** — build-time + dev-time error
   feedback for the maintainer editing YAMLs.

## Proposals (all four)

### P17 — Visible-whitespace + line-number gutter overlay (code-editor UX)

**Shape.** A CSS-only `<pre>` overlay behind the existing textarea,
painting (1) a 3ch line-number gutter and (2) middle-dots for
spaces / right-arrows for tabs inside indentation runs. Scroll-sync
via one `onScroll` handler. Textarea remains source-of-truth.

**Proposer's premature-check (lightly summarised):**
1. **Textarea is on death row.** `Freeform.tsx` already comments
   "CodeMirror integration replaces the textarea later". Building
   an overlay is throwaway work the eventual editor swap subsumes.
2. **F-19 isn't the top open paper-cut.** design-docs/16 lists
   F-3 / F-6 / F-14 / F-21 as "major"; whitespace dots is polish
   on a v0 surface.
3. **Scroll-sync overlays are a well-known bug farm** — iOS
   Safari textarea scroll quirks, line-height drift under font
   scaling, IME composition with auto-indent. The "2-4h"
   estimate is the happy-path median, not the realistic one.
4. **No learner has asked for this.** Moves a developer's
   aesthetic sense; doesn't move learner outcomes.

**Verdict:** Defer. Wait for CodeMirror integration (issue #23
referenced in code).

### P18 — `/about` page (learner-facing documentation)

**Shape.** Static prose page mirroring `/privacy`'s layout. Six
short sections: who it's for, who it isn't for, how it teaches,
the runtime briefly, what's done / what isn't (build-time counts),
how to read the site.

**Proposer's premature-check:**
1. **No traffic, no questions.** Writing answers to questions
   nobody has asked. The honest version is "I don't know yet
   what learners stumble on".
2. **The landing already does most of this work.** Hero +
   Compare + the TrackCards already disclose audience, approach,
   scope. An /about risks being a longer restatement.
3. **Curriculum is one module deep.** "What's done / what isn't"
   is a one-bullet table today.
4. **Authoring tax on every future change.** Landing + /about +
   design-docs makes three mirrors that will drift.

**Verdict:** Defer. Revisit after the first ~10 real learners
file issues, then write the page from their actual questions.

### P19 — `pnpm preview:check` undici-based post-build smoke (browser-level testing)

**Shape.** A no-deps Node script that boots `astro preview`, hits
6-8 routes, asserts HTTP 200 + sentinel strings + Yaegi WASM size
budget. Single new script; ~5s after `pnpm build`.

**Proposer's premature-check:**
1. **No CI means it won't run unless I remember to.** Local-only
   checks behind `pnpm preview:check` rot the moment of
   context-switching. The whole pitch is "catches regressions";
   without a CI gate, it's theatre.
2. **`astro check` + vitest already cover most static
   regressions.** Marginal value is narrow — basically
   `client:only` hydration shells and asset-pipeline bugs.
3. **The actually-painful uncovered gaps (F-3, F-11, F-12, F-2)
   are interaction-state bugs** that need a real browser or a
   focused vitest integration test — not a 200-status smoke.
4. **`astro preview --port 0` parsing is brittle.** A version
   bump that changes stdout format silently breaks the script.

**Verdict:** Defer until either CI is on the table OR a specific
asset-pipeline regression motivates the smoke layer.

### P20 — `pnpm content:check` single-command authoring loop (author diagnostics)

**Shape.** Orchestrator script running schema validation + lint +
runtime verify in sequence. Schema phase formats Zod errors as
human-readable per-file paths instead of the raw `ZodError`
stringification.

**Proposer's premature-check:**
1. **N=1 author.** Only the maintainer authors today. Solving
   community-PR ergonomics before community PRs exist is
   speculative.
2. **Watch mode is a trap.** Cross-platform `fs.watch` behaviour
   is its own rabbit hole. If watch slips, the script reduces
   to "run three things sequentially" — a 30-second shell alias.
3. **Astro build IS the schema validator.** Phase 1 reimplements
   what `astro build` already does. If `astro check` were fast
   enough, this becomes redundant.
4. **The error-prettifier is the only novel piece.** Phases 2
   and 3 are wrappers. Shipping the prettifier inside
   `content-lint` would deliver 80% of the value at 30% of the
   cost.

**Implementation friction surfaced this cycle:** The "shipping
inside content-lint" micro-alternative requires importing
`content-schema.ts` from a plain-Node `.mjs` script, which needs
either schema duplication or a TS runtime loader (no `tsx` /
`jiti` in deps). That JS↔TS boundary cost the proposer didn't
account for makes the "30% cost" claim doubtful in practice.

**Verdict:** Defer until either (a) the schema-loading infra
lands for a different reason, or (b) a concrete authoring
incident makes the cryptic Zod-error pain acute.

## Meta-pattern observations

1. **The premature-check prompt addition is working as
   intended.** All four proposers surfaced timing concerns
   that, in cycles 2-5, would have surfaced only after spawning
   validators. That's a ~50% compute reduction on the proposer
   round.

2. **Proposers are correctly self-conservative.** None of the
   four self-deferred proposals look like over-criticism on
   re-read; the timing concerns are real. This isn't proposers
   being shy; it's proposers being honest.

3. **"Ship nothing this cycle" is a valid outcome** when the
   proposers' own gates fire. Cycles 2-5 had a structural bias
   toward "produce something" because validators surfaced
   alternatives. Cycle 6 has no validator stage; the absence
   of pressure to produce a deliverable produces honest
   no-ship outcomes.

4. **For cycle 7+, consider:** keep the premature-check section;
   add an explicit "if you'd defer this, what tiny win would
   you ship instead?" follow-up so the cycles still produce
   concrete artifacts when the proposer's verdict is defer.

## What's next

Cycle 7's lenses should be different from cycles 2-6's used set:
pedagogy, design-system, voice, a11y, performance, onboarding,
persistence, curriculum-coverage, content-DX, release-readiness,
mobile-UX, recovery-error, observability, discoverability,
test-coverage, UX-polish, code-editor UX, learner-docs,
browser-testing, author-diagnostics. Candidates not yet used:

- Animation / motion (currently minimal — micro-interactions on
  state changes)
- Internationalisation (English-only today; could the bilingual-
  phrasebook frame extend?)
- Theming-edge-cases (print stylesheet, high-contrast deferral
  from /22)
- Time-of-day surfaces (e.g. a "you've been at this for 45 min,
  consider a break" affordance)
- Branding / wordmark / OG-card depth
- Author-facing curriculum-planning surfaces (a "what should
  Module 3 contain" workshop view)

Worth picking 4 fresh ones when cycle 7 opens.
