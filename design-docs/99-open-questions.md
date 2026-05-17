# 99 — Open questions

Captured here so they don't sit only in conversation history.

## Product

- **Accounts.** v0 is anonymous (localStorage). Do we ever add cloud sync,
  and at what user count does it become worth the maintenance?
- **Free vs paid.** Default plan is fully free, open-source content. Is
  there ever a tier (mentorship? advanced tracks? team licenses?)
- **Community contribution model.** Are exercises authored by maintainers
  only, or do we accept PRs? If PRs — what's the review bar?

## Content

- **Curriculum scope.** Hard ceiling: at what point does typeover stop
  being a translation course and start being "just a Go course"? Goroutines
  and channels feel like the natural boundary.
- **Stdlib coverage.** Which stdlib packages do we drill on (`net/http`,
  `encoding/json`, `context`)? Which do we skip (`cgo`, `reflect`)?
- **Exercise authoring tooling.** MDX with Zod-validated frontmatter is
  the current bet; do we need a richer authoring UI for non-coders to
  contribute lessons?

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
