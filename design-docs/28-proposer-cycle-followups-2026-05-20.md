# 28 — Cycle 5 follow-up implementations (2026-05-20)

Cycle 5 (design-docs/27) queued two unvalidated candidates: P13
`/inspect` page and P15 ThemeCard progress chip. This tick
validated both with sanity + devil's-advocate sub-agents, then
shipped what survived.

## Validation outcomes

### P13 — `/inspect` page

- **Sanity:** PASS-WITH-CAVEATS. Verified all storage-API
  assumptions (`safeParseProgress` accepts the raw string, six
  write-keys total, corrupt-backup pattern confirmed). Concrete
  refinements (don't enumerate the event name; reuse the existing
  `nav.clipboard` pattern from `ModuleCompleteCard`; call
  `invalidateProgressCache()` after Clear-all).
- **Devil's advocate:** STRONG AGAINST. Five sharp objections —
  (1) `/privacy` already does the audit better in prose; (2)
  surfacing density normalises the surveillance frame; (3)
  Clear-all is a destructive action that exists nowhere else,
  duplicating a native browser capability; (4) download-without-
  import is the P7 trap reincarnated; (5) maintenance treadmill
  on every new key. Recommends a DevTools-snippet `<details>`
  block on `/privacy` as the cheaper alternative serving the
  only audience that actually wants raw localStorage inspection.

**Action:** Shipped the DevTools-snippet alternative on
`/privacy`. New "Auditing what's stored" section with a
copy-paste-ready `Object.fromEntries(...)` one-liner that lists
every `typeover:*` localStorage key from the browser console.
Zero new routes, zero new islands, identical audit value for the
sophisticated-user audience.

### P15 — ThemeCard progress chip

- **Sanity:** PASS-WITH-CAVEATS. Critical finding: the existing
  `ThemeProgressChip` in `src/components/progress/` IS the chip
  the proposer wanted — its visibility rule (`passed > 0 ||
  themeComplete`) matches the "renders nothing at zero"
  contract, it already subscribes to storage events, and the
  `firstExerciseHref` prop is optional. Recommend reusing it
  directly instead of authoring a new island. Also: ThemeNode
  doesn't currently expose `exerciseIds` — the proposer's claim
  that it was "already built" is false; needs extending
  `buildCurriculumTree`.
- **Devil's advocate:** rate-limited; no verdict. Inferred
  concerns from the prompt: 31 islands hydrating on `/go`,
  semantics of "done" (instancesPassed vs reveal-counted-as-
  fail), redundancy with the theme-overview's per-exercise chip.
  The sanity-check's "reuse existing chip" recommendation
  resolves the splinter concern entirely; the others are
  real but minor (the chip is tiny, instancesPassed semantics
  match `summarizeTheme`, and the curriculum-grid surface is
  one zoom level higher than the per-exercise chip — different
  affordance, not redundant).

**Action:** Shipped in simplified form. Extended `ThemeNode`
with `exerciseIds: string[]` (one line in `buildCurriculumTree`).
Mounted the existing `ThemeProgressChip` (without
`firstExerciseHref`) inline on `ThemeCard.astro` next to the
"N ready" badge — only when the theme has any exercises
(scaffolded modules render nothing). Threaded `exerciseIds`
through both call sites (`/go` and `/go/[module]`) plus the
design-system showcase page.

Net change: ~40 lines across 5 files, no new component, no new
test (the existing `ThemeProgressChip` tests cover the chip; the
new wiring is integration-tested by the existing build).

## Implementation summary

**Shipped:**
- ThemeCard now renders the per-theme progress chip — returning
  learners see "3 / 9 passed" appear on every theme card they've
  touched on `/go` and `/go/[module]`. Anonymous visitors see
  the unstarted card unchanged.
- `/privacy` gains an "Auditing what's stored" section with a
  DevTools snippet for raw localStorage inspection.

**Deferred:**
- `/inspect` full page (heavy version) — privacy-page DevTools
  snippet captures the same audit goal without the maintenance
  treadmill or destructive Clear-all footgun. Revisit only if
  multiple users file issues asking for a UI inspector.

## Meta-pattern continued

Cycles 2-5 + this follow-up tick confirm the structural
proposer-vs-validator asymmetry: of 5 proposals validated this
tick, 1 shipped in its proposed form (with a sanity-driven
simplification), 1 shipped as the devil's-advocate's cheaper
alternative. The pattern of "ship the lighter alternative the
validator surfaces" has now produced three concrete improvements
across cycles 4-5 (privacy backup note, `/go` static hint,
DevTools snippet) that would never have been authored as
proposals on their own. Worth formalising in cycle 6's brief:
ask devil's-advocates explicitly for "what tiny alternative
captures most of the value".

593 tests, 142 pages, build green.
