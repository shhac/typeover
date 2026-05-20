# Proposer cycle — 2026-05-20

Record of a `/loop` step-4b proposer round. Four design goals → four
proposals → two picked → four validators. Both picked proposals took
credible damage in validation; this doc captures the gap that was
identified, the approaches considered, and why neither was shipped
now — so a future iteration doesn't re-run the same cycle from cold.

## Proposals considered (all four)

| Goal               | Proposal                                                  | Effort | Status      |
|--------------------|-----------------------------------------------------------|--------|-------------|
| Pedagogy           | `tsAside` opt-in "Coming from TS?" field per exercise     | Small  | Deferred    |
| Onboarding         | Inline taste-test MCQ on the homepage                     | Small  | **Killed**  |
| Authoring scale    | `pnpm exercise:preview <slot>` CLI for single-exercise dev| Small  | Not-yet-picked |
| Performance        | Service-worker precache for `/yaegi/yaegi.wasm`           | Small  | Not-yet-picked |

The two not-yet-picked are still credible — they didn't go through
validation this round. They're good candidates for the next proposer
cycle.

## Pedagogy — `tsAside` — DEFERRED

**Identified gap (real)**: `02-pedagogy.md` §"bilingual-phrasebook"
promises three halves — TS, Go, *and what changes and why*. Today
the third half lives in `notes:` (author-only metadata, never
rendered to learners) or buried inside layer-1 hints (cost-bearing).
A learner who picks the wrong MCQ in `foundations/variables/01`
never sees a learner-facing explanation of `:=`-vs-`let` semantics
unless they spend a hint on it.

**Proposal**: Add a new `tsAside: z.string().optional()` field;
render as an Astro-side `<Accordion>` disclosure on the exercise
route, defaultOpen for slot-1 of each theme, collapsed thereafter.

**Why deferred (not killed)**:
- The gap is real and aligned with foundational pedagogy docs.
- The "expanded once, collapsed thereafter" rule needs persisted
  state the `Progress` schema doesn't carry; the proposer disclaimed
  adding it but the rule isn't computable without it.
- DA suggested promoting `notes:` instead — but a quick read of
  `foundations/variables/01.yaml` shows `notes:` is currently
  AUTHOR-facing distractor rationale ("Distractors: 1. `var name =
  value;` — valid Go, but unidiomatic at function scope...") — not
  drop-in learner copy.
- Pre-launch we just closed 32 review tickets. The marginal
  ship-blocker isn't another conceptual scaffold; it's launch.

**Recommended future shape (when revisited)**: Either (a) hand-author
a learner-facing `whyItChanged: z.string().optional()` field that's
unambiguously post-answer (rendered under the right-phase Feedback,
not beside the TS panel), with no per-theme state rule; or (b) split
the existing `notes:` into `notes_author:` + `notes_learner:` so the
existing payload doesn't get conflated. Either path is a 1-day
content + schema PR; the harder question is "which exercises actually
benefit from the third half and which are already self-evident from
the TS/Go side-by-side."

**Trigger for revisit**: First piece of learner feedback that says
"I didn't understand WHY Go does X differently" within the first
month post-launch.

## Onboarding — Inline taste-test MCQ — KILLED

**Identified gap**: Homepage `<Compare>` wedge is read-only; a first
visitor can't taste the recognition→translation loop before
committing to navigate into `/go/foundations/variables/01`.

**Proposal**: A hardcoded one-question MCQ between the wedge and
TrackCard. Correct → `[Start Foundations →]` CTA.

**Why killed**:
- `07-release.md` is explicit: no marketing chrome, no funnel
  optimisation, no analytics. A homepage MCQ-with-CTA reads as
  conversion funnel — category drift from the launch posture.
- The proposer claimed "reuse `<Mcq>` shell logic", but `Mcq.tsx` is
  bound at the hip to `useExerciseInstance` (writes progress),
  `useExercisePhase`, `ExerciseShell` (hints/reveal/toolbar),
  `GeneratorSpec`, `McqOption`. "No progress write, no hints, no
  reveal, no generator, no shell" forks every collaborator —
  effectively a parallel MCQ surface. Two MCQ implementations drift.
- The wedge IS the taste. `15-docs-site-patterns.md` explicitly
  frames the homepage as a *track-overview*, not a sample-lesson.
- The first exercise itself (`/go/foundations/variables/01`) is the
  real taste; the homepage's job is to point at it, which the
  existing TrackCard CTA already does.
- The simplest equivalent win that DOESN'T drift: change the wedge's
  caption to "Take 30 seconds to try one →" pointing at the first
  exercise. That's zero code — just a copy tweak.

**Recommended future shape**: Don't revisit. If first-run engagement
is genuinely lower than expected post-launch, instrument it before
proposing a fix (which itself requires the no-tracking commitment to
loosen — a separate, larger decision).

## Round 2 — `exercise:preview` CLI + service-worker precache validated

The two un-picked proposals from round 1 were validated in the next
loop iteration. Both took damage; the validators surfaced lighter
alternatives that DID ship.

### Authoring — `pnpm exercise:preview` — REPLACED with `--filter`

- **Sanity**: ship-with-tweaks (needs `tsx` devDep, reuse
  `bootstrapYaegi()` + `verify-runnable.mjs`'s `buildProgram`).
- **DA**: kill — HMR + pinned tab is already the dev loop; the
  Yaegi-grading check is a 5-line `--filter <substring>` on the
  existing `runtime:verify` script; text-shaped CLI output lies
  about the visual things authors actually need to verify (MCQ
  option order, markdown rendering, mobile overflow); pre-launch
  there's no velocity wall to solve yet.
- **Shipped**: `pnpm runtime:verify --filter <substring>` (10 lines
  added to `runtime/yaegi-wasm/verify-runnable.mjs`). Closes the
  "verify-just-one-exercise" gap without a parallel renderer.

### Performance — service-worker precache — REPLACED with preload + HTTP cache

- **Sanity**: pause-and-rethink — proposed the lighter path of
  hashed filenames + `Cache-Control: immutable` + `<link
  rel="preload">`. No SW deployment-trap risk.
- **DA**: defer-until-launch+30d — we can't measure the problem
  (doc 07 forbids tracking), Vercel's static-asset defaults likely
  already cache effectively, SW rollback story has the dead-SW-
  intercepts-its-own-update deadlock, and pre-launch is uniquely
  bad timing (no traffic = no stress test, sticky SW from day one).
- **Shipped**:
  - `<link rel="preload" href="/yaegi/yaegi.wasm" as="fetch">`
    rendered conditionally on `/go/*` routes in `BaseLayout.astro`
    so the ~1.9 MB brotli download runs in parallel with HTML
    parsing instead of waiting for `getRunner()`.
  - `vercel.json` with `Cache-Control: public, max-age=86400,
    stale-while-revalidate=604800` for `/yaegi/(.*)` so a return
    visit within 24h skips the network and the next 7 days
    revalidate in background.
  - Skipped the SW entirely. Skipped the filename-hashing
    proposal — the unhashed path with a 1-day max-age is a smaller
    cut that survives a Yaegi upgrade gracefully (no stale-forever
    risk).

## Round 3 — /improve-code-structure pass (2026-05-20)

Ran the full 5-lens sweep. **Five small-to-medium structural wins
shipped**; three larger items deferred here as future-work.

### Shipped (5 commits)

1. **`@utility focus-ring`** (lens 4) — sweeps 17 hand-pasted
   `focus-visible:outline-2 focus-visible:outline-accent-amber
   rounded-sm` strings into one Tailwind 4 utility. Future ring
   widening / recolouring lives in one place.
2. **Toast timer-reset on re-emit** + **manual-dismiss
   double-fire guard** (lens 5) — Toast's `createEffect` now
   resets `remaining` + `startedAt` whenever `props.state` updates;
   rapid setting flips now show each toast for the full duration.
   Tests cover both contracts (11/11 Toast tests).
3. **ProgressChip reactivity fix** (lens 5 → surfaced a real bug,
   not just a coverage gap) — the IIFE children pattern in both
   chip islands was non-reactive (`{(() => {...})()}` ran once at
   render), so chips never updated post-mount even when the
   storage/custom-event listeners fired. Switched to function-child
   pattern. Also added `{...slot}` clone to defeat the in-place-
   mutation eq-skip in `ExerciseProgressChip` (since `bumpExercise`
   mutates `cachedProgress.exercises[id]` in place). 12 new tests
   across both chip files.
4. **`aggregateModuleProgress(themes)`** + **`findNextUnfinished
   ExerciseId(themes)`** extracted from `ModuleCompleteCard` to
   `progress.ts` (lens 1 + lens 3). Pure functions, testable
   without a Solid render harness. 6 new direct tests.
5. **Yaegi error-recovery contract pinned** + **`nextExerciseHref`
   ternary → guarded early returns** + **`tryJsonParse` helper in
   progress.ts** — three small lens-3/5 wins landed in one
   sequential pass.

Test count: 442 → 463 (+21). 0 typecheck errors, 0 lint warnings,
build green, working tree clean.

### Deferred to future-work — too big for this slot

The lenses flagged three structural refactors that didn't fit a
single iteration. Recording here so a future `/improve-code-structure`
or proposer cycle can pick them up cold.

**FW-1 — `defineAppearanceAxis<T>()` factory in `theme.ts`** — **SHIPPED 2026-05-20 (round 4)**
- Flagged by lens 1 (#4), lens 3 (#2), AND lens 4 (#1) — the
  highest-impact convergence in the sweep.
- Shipped as `defineAppearanceAxis<T>({ values, storageKey,
  datasetKey, default })` returning `{ isValue, current, set }`.
  The three OS-signal-free axes (density / radius / style) now
  collapse to one factory call apiece — ~5 lines each instead of
  ~12. The colour axis keeps its bespoke `currentTheme`/
  `currentChoice`/`setTheme` to handle the `system` choice, but
  shares the factory's typeguard for the `dark|light` validation.
- Every exported name is preserved (`THEMES`, `DENSITIES`, `RADII`,
  `STYLES`, `*_STORAGE_KEY`, `currentX`, `setX`, `isX` via the
  factory return) so `AppearancePicker.tsx` and
  `BaseLayout.bootstrap.test.ts` need no changes. All 463 tests
  pass; the bootstrap-enum-coverage gate still iterates the four
  enum exports as before.
- The bootstrap script in `BaseLayout.astro` deliberately stays
  inline (it runs pre-paint and can't import from theme.ts). The
  existing `bootstrap.test.ts` guards drift between the two.

**FW-2 — Split `generator.ts` into schema + runtime** — **SHIPPED 2026-05-20 (round 5)**
- Flagged by lens 2 (#1). Split at the in-source
  `/* ---------------- Runtime ---------------- */` divider into:
  - `src/lib/generator-schema.ts` — Zod schemas
    (`DistractorEntrySpec`, `TemplateSpec`, `VariantSpec`,
    `ProceduralSpec`, `GeneratorSchema`), their type infers
    (`GeneratorSpec`, `TemplateGenerator`, `VariantGenerator`,
    `DistractorEntry`), and the schema-shape-aware helpers
    (`extractTemplateVars`, `distractorMatchText`,
    `distractorExplain`).
  - `src/lib/generator-runtime.ts` — `ExerciseInstance`,
    `FillSegment`, `GenerateOptions`, `buildBlankSegments`,
    `substitute`, `buildShuffledOptions`, `resolveTemplateValues`,
    `generate`.
  - `src/lib/generator.ts` — collapsed to a 2-line barrel re-export
    so every existing consumer keeps working unchanged.
- Then walked the canonical consumers to import from the more
  specific file: `content-schema` + its test, `exercise-instance`,
  `fill-blank`, `wrong-pattern`, and the four exercise components
  + their tests. Generator's own three test files keep the barrel
  import (zero gain from moving them — tests don't ship to
  learners).
- All 463 tests pass; typecheck clean; lint clean; build green.
  No interface change visible to authors or learners.

**FW-3 — Shared `<Breadcrumb>` + `<ThemeCard.astro>` extractions** — **SHIPPED 2026-05-20 (round 4)**
- Flagged by lens 2 (#3) and lens 4 (#3). Three near-identical
  breadcrumbs across the `/go/*` routes, two near-identical
  theme-card grids across the /go index and the per-module page.
- Shipped as `src/components/curriculum/Breadcrumb.astro` (3
  route sites consolidated; takes a `crumbs: Crumb[]` array with
  optional `ariaLabel`s; last crumb without `href` renders as the
  active-leaf span) and `src/components/curriculum/ThemeCard.astro`
  (2 sites consolidated; takes `moduleOrder`, `theme`,
  `firstExercise?`, `exerciseCount`). Both anchor surfaces use the
  shipped `focus-ring` utility. Net diff: ~+180 lines (the two new
  components) / ~−165 lines (sweep removes the inline duplications)
  + 2 file imports tightened up.

## Round 6 — second proposer cycle (mobile / resilience / build-in-public / Module 2)

Four fresh design goals (distinct from round 1's pedagogy/onboarding/
authoring/perf):

| Goal              | Proposal                                                | Status      |
|-------------------|---------------------------------------------------------|-------------|
| Mobile UX         | Long-press repeat + slide-to-glide on MobileKeyBar      | **Killed**  |
| Error resilience  | Resilient progress writer + StorageHealthBanner         | Not-picked  |
| Build-in-public   | `/log` page rendered from `git log main`                | **Killed**  |
| Module 2 content  | Author `collections/arrays-and-slices` 10-slot theme    | Not-picked  |

### Picked for validation, then killed

**Mobile keybar long-press + slide-to-glide** — sanity said
ship-with-tweaks (drop slide; narrow repeat to Tab/space/newline only).
DA said defer-until-launch+30d:
- Contract break — the bar's 16 plain `<button>`s currently match every
  other DS button; layering hold-to-repeat + slide-to-glide turns it
  into a stateful input mode with three gestures on the same hit-rect.
  No DS precedent; modes are where bugs and a11y regressions live.
- Slide gesture fights the bar's existing `overflow-x-auto` — the bar
  was designed to be horizontally scrollable. Pointer-slide and
  scroll-to-find-symbol are ambiguous on the same hit-rects.
- jsdom has no PointerEvent constructor; the project has no Playwright.
  Load-bearing gesture logic would ship without automated coverage.
- Freeform is a minority slice of the Foundations curriculum; the
  per-key one-tap contract already solved doc 08's primary mobile
  complaint ("symbols 2-3 taps deep on stock keyboards"). Optimising
  speed-of-symbol-entry further is premature.
- doc 08 §"Mobile support" enshrines tap + 44×44; slide gestures
  appear nowhere. Shipping them would be a unilateral contract change.

**`/log` build-time changelog page** — sanity said ship-with-tweaks
(parser handle bare `type:` and `content[...]` prefixes, drop author
names, prebuild via npm script). DA said kill:
- Doc 07 explicitly forbids marketing chrome and active marketing. A
  curated on-site changelog is exactly that soft-sell posture even if
  it's introspective; "build-in-public" is already discharged by the
  github link in the footer.
- The recent 50 commits are dominated by `refactor[focus-ring]`,
  `refactor[ds-tokens]`, `docs[proposer-cycle]` — internal grooming
  a learner cannot parse and a recruiter will skim past. Grouping by
  week clusters the noise without making it a story.
- GitHub renders the log with better filters, blame, and diffs.
  Mirroring on-site is a duplicative surface with build-step + CI
  fetch-depth + styling + a11y + mobile maintenance cost.
- The footer is already 5 anchors; 6 is chrome bloat doc 07 resists.
- Pre-launch the named checklist (mobile, Lighthouse, README rewrite,
  domains) takes priority over post-launch artefacts.

### Not picked for validation

Two proposals were generated but not validated this round:

**Error resilience — resilient progress writer + StorageHealthBanner**.
Touches the load-bearing `write()` in `progress.ts` (every recorder
funnels through it). Real failure modes (QuotaExceededError, private-
browsing SecurityError) but a misfire could break working storage.
Defer to a future round with more design upfront. Could revisit when
a quota issue actually manifests post-launch.

**Module 2 authoring — `collections/arrays-and-slices` end-to-end**.
10 exercises × ~30 min each = real pedagogical-judgement work, not a
Claude task. Author distractors, calibrate difficulty across the
MCQ/fill-word/fill-line/freeform mix, write hints that scale from
conceptual to near-answer. Generating stubs is automatable; the
authoring quality bar isn't. Defer to Paul.

## Notes for the next proposer cycle

- Validation matters: across two rounds, every "small 1-2 days"
  proposal underestimated either coupling cost or the cleaner
  alternative the codebase already supported. Always run sanity +
  DA before committing implementation effort.
- "Reuse the existing X shell logic" was the load-bearing claim
  in multiple killed/replaced proposals. When a future proposer
  says that, read the X file before accepting the estimate.
- The lighter alternatives that DID ship (a `--filter` flag, a
  `<link rel="preload">`, a `vercel.json` cache header) are
  consistently 5-15 lines of code. Pre-launch, lean into the
  smallest cut the validators agree on rather than the proposer's
  named feature.
