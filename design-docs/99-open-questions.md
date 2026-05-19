# 99 — Open questions

Captured here so they don't sit only in conversation history.

## Resolved

- **Scope.** Full Go intro, TS-translation as the wedge. Beyond the
  bilingual core, the course continues into Go-only concepts as
  straight Go content. (Decided 2026-05-18.)
- **Audience split.** Don't differentiate backend vs frontend TS devs.
  Add specialised tracks only on demand. (Decided 2026-05-18.)
- **Ambition.** Portfolio / learning project — craft over launch speed.
  (Decided 2026-05-18.)
- **First lesson concept.** Variables, primitives, `:=` vs `let`.
  (Decided 2026-05-18.)
- **Lesson shape.** Short & dense — 3-4 exercises per lesson (~3 min),
  chainable. A *theme* is the pedagogical unit (~9 exercises across the
  MCQ → fill-blank-word → fill-blank-line → freeform progression). All
  exercises are parameterised generators, not static instances —
  replayability built in. Progress tracked at topic/theme/exercise
  levels with drop-in/drop-out support. (Decided 2026-05-18.)
- **Navigation.** Recommended path with progress tracking, plus a
  free-browse escape hatch. (Decided 2026-05-18.)
- **Curriculum design process.** Recursive validation:
  Pass 1 = top-level topics, validate ordering for a TS dev; Pass 2 =
  break each topic into sub-topics, validate; Pass 3+ = continue until
  exercise-level. (Decided 2026-05-18.)

## Resolved (cont.)

- **Visual direction.** Airy (Stripe/Linear-style), liberal language
  colour-coding, adaptive split/stack layout, selective chrome.
  (Decided 2026-05-18.)
- **Voice.** Warm + dry-witty, peer-level technical, no patronising.
  (Decided 2026-05-18.)
- **Failure UX.** Three-button choice on wrong: try-again / try-different
  / reveal-diff. Layered hints; on-demand canonical reveal.
  (Decided 2026-05-18.)
- **Open source.** Public + MIT from day one. Repo quality is part of
  the portfolio. (Decided 2026-05-18.)
- **Launch gate.** Module 1 (Foundations, 5 themes) complete and
  polished. (Decided 2026-05-18.)
- **Maintenance.** Burst-mode acceptable; quality bar constant.
  (Decided 2026-05-18.)
- **Sharing.** Quiet — portfolio link, no marketing. Social share at
  module completion is the only growth mechanism. (Decided 2026-05-18.)
- **Mobile support.** Full, including freeform code editing. Adaptive
  breakpoint at 1024px. (Decided 2026-05-18.)
- **Accessibility.** WCAG 2.2 AA, enforced at design-system layer.
  (Decided 2026-05-18.)
- **Authoring model.** Community-friendly from day one. CONTRIBUTING +
  lesson template + schema docs. (Decided 2026-05-18.)
- **Gamification posture.** Minimal stats now; data tracking complete
  enough to add gamification later. Social share at module completion
  is the v0 growth lever. (Decided 2026-05-18.)
- **Accounts.** None in v0. Anonymous local-only. (Decided 2026-05-18.)
- **Monetisation.** Parked indefinitely. (Decided 2026-05-18.)

## Still open

- **Stdlib coverage.** Which stdlib packages do we drill on (`net/http`,
  `encoding/json`, `context`)? Which do we skip (`cgo`, `reflect`)?
- **Pass 2 curriculum.** Themes per module + prerequisite chain.
- **Pass 3+ curriculum.** Exercise-level breakdowns.
- **Server-fallback runtime hosting** for hard exercises that Yaegi
  can't handle (Vercel function vs always-on container).
- **Module 3 weighting.** Currently bundles 6 themes — may split into
  "Types & methods" + "Interfaces & generics."
- **Generics positioning.** Should they jump earlier given TS-dev
  familiarity?
- **Logo / wordmark** — currently just the wordmark in mono.
- **Domain claim timing** — `typeover.dev / .io / .app / .co` all free;
  grab before public launch.

## Engineering follow-ups (preventive)

Flagged for "do later when triggered", not now.

- **`src/components/exercise/cells/` subfolder.** When Freeform
  (task #17) lands, the exercise/ directory will hold 8-10 files
  mixing three concerns: shared chrome (ExerciseShell), exercise
  type hosts (Mcq, FillBlankWord, FillBlankLine, Freeform…), and
  cell-state leaves (McqOption, BlankInput, CandidateTile, …).
  Move the leaves into `exercise/cells/` once the file count
  passes ~10. No reorganisation needed before then.
  (Iter-7 lens-2 finding, deferred.)

- **Template-placeholder grammar collides with TS template literals.**
  Generators use `${name}` for substitution placeholders. The `#38`
  refinement rejects undeclared `${ref}` in `ts` / `canonical` /
  `distractors`. But TypeScript template literals also use
  `${...}` — so a freeform exercise that wants to show TS like
  `` `hello ${name}` `` in its `ts` field gets rejected. Today's
  workaround is to rewrite the TS without template literals
  (concatenation works). The cleaner fix is to switch placeholder
  grammar to something with no Go/TS collision — `{{name}}` (Mustache)
  is the natural choice. Migration touches every existing exercise's
  template — ~30 files. Pickup criterion: when an author hits this
  for a *second* time, or when an exercise genuinely needs to show
  TS template-literal syntax.

- **Block-level markdown in content strings.** `formatInline()` covers
  `` `code` `` and `**bold**` but theme intros (e.g.
  `themes/foundations/variables.yaml`) author bulleted lists with
  leading `-` markers that currently render as literal hyphens.
  Pickup when a content reviewer asks for a list to render as a
  list, or when intros adopt headings/links. Likely answer is to
  reach for a small markdown library (e.g. `marked`) for these
  block-context fields rather than extending `formatInline` to a
  full parser.

- **Hint placeholder substitution.** *(Landed.)* `ExerciseInstance`
  now carries an optional `values: Record<string, string>` populated
  by template generators. The three exercise components pass
  `instance().values` to `ExerciseShell` as `hintValues`, which
  forwards to `HintButton`. HintButton applies lenient substitution
  (`${name}` → `values[name]`, unknown placeholders pass through)
  before `formatInline`. Hint 3 on `foundations/variables/01` now
  renders the chosen `score := -1` (or `count := 5`, etc.) instead
  of the literal placeholders.

## Engineering follow-ups

Surfaced by the first code-structure review pass (2026-05-17). Each is
a should-definitely-do that was parked because the immediate iteration
was already big enough.

- **Add Vitest + critical-path unit tests.** No test infrastructure
  exists yet. Cover at minimum:
  - PRNG determinism in `src/lib/seed.ts` (snapshot a known seed → known
    sequence; re-seeding produces same sequence).
  - `generate()` in `src/lib/generator.ts` (snapshot a fixed exercise +
    seed → known instance; the dedupe-distractor path drops collisions
    cleanly; substitute() throws on unknown vars).
  - `progress.ts` `bumpExercise` (idempotency of slot creation, counter
    mutations, lastSeenAt always advances).
  - `optionCellState` in `McqOption.tsx` (truth table across all
    boolean combinations).
  - Mcq.tsx happy-path + wrong-path + reveal via
    `@solidjs/testing-library`.

- **Zod-validate the localStorage progress blob.** *(Landed — task #37.)*
  `safeParseProgress` is now a Zod-typed `ProgressSchema.safeParse`;
  `read()` backs up any non-null payload that fails validation to
  `typeover:progress:corrupt-<iso>` before returning `empty()`. Tests
  cover invalid-JSON and schema-mismatch backup paths plus
  no-backup-on-SSR and no-backup-when-empty. `ExerciseProgress` and
  `Progress` are now `z.infer`'d from the schema.

- **Content-schema `.refine()` cross-field checks.** *(Landed — task #38.)*
  Schemas extracted from `content.config.ts` into `~/lib/content-schema`
  (plain Zod, testable from vitest without an `astro:content` shim).
  Refinements now reject:
  - `vars` pool of length 0 (would crash `pickFrom`).
  - `${name}` reference in `ts` / `canonical` / `distractors[i]` that
    isn't declared in `vars`.
  - Empty `variants: []` and duplicate variant IDs.
  - `fill-word` / `fill-line` without (or with empty) `blanks`.
  - `fill-word` / `fill-line` with a non-template generator.
  - `blanks` entries that don't name a declared template var.
  - MCQ with empty `distractors` (template kind) or any MCQ-variant
    without distractors (variant kind).
  - Stray `blanks` set on non-fill exercise types.
  Each issue carries a path pointing at the offending field.

- **`progress.write()` should dispatch a same-tab storage event.**
  Browsers only fire `storage` in *other* tabs, so any future Solid
  signal subscribed to localStorage won't refresh in the current tab.
  Fix: `window.dispatchEvent(new StorageEvent("storage", { key: ... }))`
  inside `write()`. Pair with restoring a `useExerciseProgress` hook
  with proper `onCleanup` listener removal — both were dropped in the
  refactor pass because nothing currently consumes them.

## Unvalidated assumptions

- CodeMirror 6 on mobile touch keyboards works well enough for freeform
  code editing.
- Yaegi handles 80%+ of intended Module 1–4 exercises.
- TS blue and Go cyan have enough contrast against `bg-base` for WCAG
  AA at ≥14px.
- 9-exercise theme template is right for most themes; outliers can
  deviate.
- Burst-mode maintenance with constant quality bar is sustainable.
- Current design system can be retuned toward airy without rewriting.

## Architecture (future-proofing for multi-target)

typeover is positioned as a TS→X bridge where X starts as Go but may
later include Rust, Zig, Python, etc. (Decided 2026-05-18.) Implications
for v0 that we should bake in cheaply:

- **Exercise schema:** `target: "go"` field on every exercise, not
  implicit. URL structure `/<target>/<module>/<lesson>` (initially just
  `/go/...`).
- **Design tokens:** the `accent-go` colour is fine to stay hardcoded
  while Go is the only target. When a second target arrives we
  generalise to `accent-target` with per-target overrides.
- **Runtime:** Yaegi is Go-specific; that's correct. The worker
  abstraction (`runtime/<target>/worker.ts`) is where target swap-out
  will happen if/when a second language joins.
- **Content collections:** `src/content/lessons/<target>/...` rather
  than `src/content/lessons/...` flat.

None of this is built yet — just keeping the room for it.

## Runtime

- **Yaegi POC results.** Until we run the 20-snippet matrix (see
  04-runtime-strategy.md), we don't know how often we'll fall back to the
  server path. Decide after.
- **Server fallback hosting.** Vercel function (cold-start cost) vs a tiny
  always-on VPS vs Fly.io? Decision depends on traffic shape.
- **Grading depth.** Start with gofmt-normalised string compare. When
  does it become worth doing AST equivalence or running hidden tests?

## Design

- **Light theme.** Out of scope for v0. Worth doing later for accessibility
  / preference reasons?
- **Mobile.** v0 is desktop-first because exercises involve typing code.
  Read-only mobile view eventually?
- **Animation.** Current bet: minimal. Quiz feedback transitions, nothing
  decorative. Revisit if user testing says it feels lifeless.

## Brand

- **Name.** typeover available (`.dev`, `.io`, `.app`, GitHub org, scoped
  npm). `.com` taken (parked). Snapshot, don't sit on these.
- **Logo.** None yet. Wordmark in mono should carry v0; commission later.
