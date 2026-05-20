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
