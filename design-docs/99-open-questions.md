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

- **Targeted wrong-pattern feedback on fill-line** *(surfaced
  2026-05-19 design-goal pass, not built.)* The fill-line redesign
  retained `generator.distractors` as an authoring-driven
  "known-wrong-pattern bank" (see fill-line entry below). The UX
  surface that consumes it doesn't exist yet — today wrong fill-line
  submissions show a generic "Stdout doesn't match yet…" message
  regardless of *how* they're wrong. Proposal: promote
  `distractors: string[]` to a discriminated
  `Array<string | {match, explain}>` shape (back-compat for bare
  strings), normalise whitespace, and when a learner's submission
  matches a known wrong pattern, render the authored explanation
  inside the wrong-phase message slot — leaving the generic copy
  in place when nothing matches. Pickup criterion: when a Module 1
  learner reports an "I don't know why this is wrong" moment, or
  when shipping fill-line content for Module 2+ (the explanation
  authoring is then part of the new-content workflow rather than
  a back-port). Cost: ~3 commits (schema + lib + component;
  12-YAML upgrade; content-lint warning + tests).

- **MobileKeyBar — sticky Go-symbol bar above the mobile
  keyboard** *(surfaced 2026-05-19 design-goal pass, not built;
  named in design-docs/05's planned-components table since v0.)*
  The current Freeform / FillBlankLineInput on a mobile viewport
  is a plain `<textarea>` — every Go symbol (`{`, `}`, `:=`, `&`,
  `*`, `\t`) is 2–3 taps deep on stock iOS/Android keyboards,
  which silently invalidates the design-docs/08 commitment to
  *full* mobile freeform editing. Proposal: new
  `src/components/ds/MobileKeyBar.tsx` with a `role="toolbar"`
  pinned `position: fixed; bottom: 0` on `<1024px`, hidden via
  `lg:hidden` on desktop. Default key set: `{ } ( ) [ ] < > := =
  * & " ; Tab ⏎`. Two callers (Freeform, FillBlankLineInput) +
  a shared `insertAtSelection` helper in
  `src/lib/textarea-insert.ts`. Pickup criterion: real-device
  mobile QA from the launch checklist surfaces the freeform
  unusability (it will), OR before exposing freeform on a
  share-target link that lands a mobile-first audience. Risks:
  iOS Safari `visualViewport` overlay (need real-device, not
  simulator); Chrome Android `VirtualKeyboard API` is cleaner
  but Chromium-only; caret restoration after Solid re-renders.
  Cost: ~1 DS primitive + 1 helper + 2 caller wires + tests
  (1–3 commits).

- **`content:new theme <id>` — schema-aware scaffolder**
  *(surfaced 2026-05-19 design-goal pass; previously noted as
  parked in the content-lint entry below.)* The third of the
  three design-docs/09 authoring tools. Stamps
  `src/content/themes/<module>/<theme>.yaml` + nine prefilled
  exercise YAMLs across the canonical
  3×MCQ / 2×fill-word / 2×fill-line / 2×freeform progression.
  Node script alongside `content-lint.mjs`; no deps; interactive
  prompts for the four schema-required fields that can't be
  guessed (`title`, `order`, `intro` seed, optional
  `prerequisites`); `--yes` for non-interactive use. The
  stamper's value isn't reducing copy-paste — it's encoding the
  9-slot progression and the schema's `.refine()`s in
  *executable* form, so the template can't silently drift from
  what the schema accepts. Pickup criterion: either the
  maintainer authoring Module 2 reaches for it, OR the first
  community PR bounces off the manual scaffold. Cost: ~1
  focused afternoon; defer until one of those triggers actually
  fires.

- **Reveal-diff UX** *(landed 2026-05-19.)* Inline "Show canonical"
  toggle next to the input area on fill-line + freeform —
  `<InlineCanonicalReveal>` renders `<DiffView>` against the
  learner's current input. Word-level diff for fill-line (one line)
  and line-level for freeform (multi-line program). Submission-only
  tokens render with red strikethrough; canonical-only tokens with
  green underline. The shell-footer `<RevealButton>` is hidden for
  these types via `ownsReveal` (still mounted for MCQ where the
  options ARE the visible canonical). The wrong-phase "Reveal
  correct" button auto-opens the inline panel via a `forceOpen`
  accessor. Library: `diff@9.x` (well-established, MIT, ~17KB).
  Future enhancements: per-distractor explanations (pair with the
  known-wrong-pattern bank surfaced by the fill-line redesign).

  Also (same iteration): freeform no longer prefills the
  textarea with the canonical — starts with a generic `package main`
  scaffold. Per-exercise scaffolds remain a future schema field
  (`scaffold: |- ...`) once authors want exercise-specific starts.

- **Server-fallback runtime hosting** *(surfaced 2026-05-19 design-
  goal pass, not yet built; original entry below merged here for
  clarity).* design-docs/04 and 04a flag two Yaegi gaps that need a
  server path: `defer` arg-capture semantics, and generic-stdlib
  funcs like `slices.Sort` / `Min` / `Max` / `BinarySearch`. The
  exercise dispatcher already differentiates `runtime: "server"` but
  no endpoint exists. When picked up: simplest deployable shape is a
  Vercel serverless function POSTing to a Go process running
  `go run` in a tempdir under a small resource-limit wrapper (CPU,
  memory, time), returning the `{stdout, stderr, error, durationMs}`
  shape the existing client API expects. Sandboxing via a minimal
  Docker container is enough for v0; firejail/nsjail is overkill.
  Cost: at ~1500 invocations/day this is comfortably inside Vercel
  free tier. The client side: getRunner() returns one of two
  implementations based on the exercise's runtime tag. Module 1
  doesn't need this; Modules 6-7 likely will.

- **Authoring CLI — `content:lint`** *(landed 2026-05-19.)*
  `scripts/content-lint.mjs`, invoked via `pnpm content:lint`.
  Fills the graph layer (cross-file integrity) that the Zod schema
  in `~/lib/content-schema` (per-file) and `pnpm runtime:verify`
  (per-canonical) can't see. Checks today:
    - module orders unique
    - theme.moduleId → existing module
    - theme.prerequisites → existing themes
    - theme orders unique within their module
    - exercise.themeId matches path-derived parent + → existing theme
    - exercise orders unique + contiguous 1..N within a theme
    - half-authored theme warning (1 ≤ exercises < 9)
    - empty-theme summary line (pre-launch stubs)
  Output is markdown with file:line refs; exits 1 on errors, 0 on
  warnings-only. Today the repo passes 0 errors / 0 half-authored
  warnings (25 empty stubs for M2+ themes are summarised in one
  line).

  The third design-docs/09 tool — `content:new theme <id>` —
  remains unbuilt and lower priority; authors today copy an
  existing theme directory. Pickup criterion: when the first
  community contributor lands and bounces off the manual scaffold.

- **fill-line UX redesign: input + Yaegi grading.** *(Surfaced 2026-05-19
  via user feedback.)* fill-line currently renders as MCQ-with-tile-UX
  (pick the right line from 5 shuffled candidates). The intent is
  "**type** the code for this one line" — single-line text input, no
  candidate pool, graded by running the surrounding scaffold under
  Yaegi.
  Shape:
  1. The exercise's `canonical` becomes a runnable program with a
     `${line}` blank inside a scaffold function (typically
     `func main()` or a tested-function-with-return).
  2. The component renders a single `<input>` for the line.
  3. On Submit, substitute the user's input into the canonical at
     `${line}`, run via `getRunner().eval(...)`, compare stdout to
     a per-exercise `expectStdout` (same field freeform uses).
  4. Schema migration: `runtime: "yaegi"` becomes required;
     `expectStdout` becomes required (mirror freeform). The
     existing `generator.distractors` field is **kept** but
     repurposed — no longer the visible candidate pool. The
     distractors become an authoring-driven "known wrong-pattern"
     bank that can power targeted feedback: if the learner's
     submitted line matches a distractor (verbatim or AST-equivalent),
     surface a per-distractor hint instead of the generic "didn't
     match expected output" message. This re-uses the per-distractor
     thinking the author did when writing them; no work is thrown
     away from the recent migration.
  5. Content migration: all 12 fill-line YAMLs need a re-author —
     scaffold prose around `${line}` so the program runs, set
     `expectStdout`. vars.line[0] stays as the reference solution.
     Distractors stay too, now as the wrong-pattern bank.
  The current MCQ-as-tile implementation stays as the stopgap until
  this lands — the recent distractor-pool fix (commit cf75494)
  prevents the grading-by-luck bug while the redesign is pending.
  Pickup criterion: this is launch-blocking — the current UX
  misleads learners. Schedule alongside #23 (CodeMirror) since the
  textarea will eventually become a CodeMirror surface too.
  Same redesign argument applies to **fill-word**: currently a
  text input with string-match grading; the Yaegi-run grading model
  would let exercises grade by behaviour (e.g. typed expression
  yields the right value at runtime) rather than by literal string
  match. That's a smaller change — same Yaegi scaffold,
  per-blank-context expected output — but worth considering as
  part of the same rewrite.


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

- **Block-level markdown in content strings.** *(Landed.)*
  `src/lib/format-block.ts` walks the input line by line and emits
  `<p>` + `<ul>`. Handles the CommonMark cases that actually show up
  in shipped content: lists interrupting paragraphs without a blank
  line, indented continuation lines joining the previous list item,
  blank-line block separation. Tests in `format-block.test.ts`
  (16 cases). The two theme-intro render sites use it via
  `<Text as="div" class="ds-prose">`. Tailwind preflight zeros list
  styles by default; `.ds-prose` in `global.css` restores enough
  margin + `list-style-type: disc` to read as prose.
  Headings, numbered lists, code fences, and nested lists are still
  out of scope — when content demands them, escalate to a real
  markdown library rather than growing the regex pile.

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

- **Light theme.** *Resolved 2026-05-19.* Designed in
  [13-themes.md](13-themes.md). Mechanism is `data-theme` on `<html>`
  + CSS-variable cascade; the DS audit confirmed every colour already
  goes through a token (after fixing one shadow leak in Kbd.tsx), so
  adding a theme is one override block in `global.css` plus a
  selector entry. Initial catalogue: `dark` (default), `light`,
  `hc-dark`, `hc-light`. Implementation not started.
- **Mobile.** v0 is desktop-first because exercises involve typing code.
  Read-only mobile view eventually?
- **Animation.** Current bet: minimal. Quiz feedback transitions, nothing
  decorative. Revisit if user testing says it feels lifeless.

## Brand

- **Name.** typeover available (`.dev`, `.io`, `.app`, GitHub org, scoped
  npm). `.com` taken (parked). Snapshot, don't sit on these.
- **Logo.** None yet. Wordmark in mono should carry v0; commission later.
