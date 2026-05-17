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

## Product

- **Accounts.** v0 is anonymous (localStorage). Do we ever add cloud sync,
  and at what user count does it become worth the maintenance?
- **Free vs paid.** Default plan is fully free, open-source content. Given
  the portfolio framing, monetisation is parked indefinitely.
- **Community contribution model.** Are exercises authored by maintainers
  only, or do we accept PRs? If PRs — what's the review bar?

## Content

- **Stdlib coverage.** Which stdlib packages do we drill on (`net/http`,
  `encoding/json`, `context`)? Which do we skip (`cgo`, `reflect`)?
- **Exercise authoring tooling.** MDX with Zod-validated frontmatter is
  the current bet; do we need a richer authoring UI for non-coders to
  contribute lessons?
- **Lesson shape.** Target exercise count per lesson, mix of exercise
  types per lesson, time budget. Still open.
- **Module structure.** Linear path vs branching tracks vs open buffet.
  Still open — depends on how the curriculum tree looks once drafted.

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
