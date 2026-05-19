# 07 — Release

## Posture

typeover is a **portfolio / learning project** built to a real production
quality bar. The product is genuinely useful; the marketing is not.

## Open source from day one

- Repo public from the first commit (it already is).
- License: **MIT** unless a reason emerges otherwise.
- Commit hygiene matters because the repo *is* part of the portfolio:
  - Conventional commit prefixes (`feat`, `fix`, `docs`, `refactor`,
    `chore`, `test`).
  - Subject ≤ 72 chars, body explains the why.
  - No "wip" or "fix typo" commits in the main history (squash before
    merge).
- README explains what typeover is, how to run locally, and where to
  find the design docs.
- LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md present from before
  launch.

## Launch gate

typeover goes on the open web at `typeover.dev` when **Module 1
(Foundations) is complete and polished**:

- All 5 themes have full 9-exercise progressions.
- Every exercise has a working parameterised generator with at least 3
  validated instances.
- All exercises have canonical answers + 3-layer hints.
- Yaegi runtime is wired up for the freeform exercises (Module 1's
  variables/primitives/strings/conditionals/functions don't stress
  Yaegi's generics limits — server fallback can be deferred).
- Progress tracking works end-to-end (drop-in / drop-out / replay).
- Mobile layout works on a real phone, not just emulated.
- WCAG AA verified with axe + manual VoiceOver pass.
- One CONTRIBUTING.md walk-through has been dry-run.

"Polished" means: a friend with no context could open it on a phone,
do the first lesson, and not hit a UX surprise. That's the bar.

## Maintenance shape

Burst-mode is fine:

- Long building sessions, then idle stretches.
- No weekly cadence commitment.
- **The quality bar does not change with momentum.** A commit during a
  burst is the same quality as a commit after a slow month. We don't
  ship rough work to "catch up."

## Sharing posture

After the launch gate is met:

- Add the link to portfolio (paulsomers.com or equivalent).
- Add it to GitHub bio / pinned repo.
- **No** launch posts on Hacker News / Lobsters / Bluesky.
- **No** active marketing.

The single growth mechanic baked into the product is a **social share
prompt at the end of each module**. A learner who completed Module 1
gets a one-tap share with a pre-composed message like "I just finished
Module 1 of typeover, the Go course for TS devs. <link>".

Word-of-mouth from learners is the only growth channel we build.

## Pre-launch checklist (lives here so we don't forget)

- [ ] Domain claimed: `typeover.dev`, `typeover.io`, `typeover.app`,
      `typeover.co` (defensive; primary is `.dev`).
- [ ] GitHub org `typeover` claimed.
- [ ] npm scope `@typeover` reserved (in case of future packaging).
- [ ] LICENSE (MIT).
- [ ] CONTRIBUTING.md.
- [ ] CODE_OF_CONDUCT.md.
- [ ] README rewrite (public-facing).
- [ ] OG image (dark, mono, wordmark).
- [ ] Favicon.
- [x] Privacy note (we use localStorage, no servers, no tracking). Lives
      at `/privacy`, linked from the site footer.
- [ ] Module 1 content complete.
- [ ] Mobile sanity pass on real iPhone + Android.
- [ ] axe a11y clean.
- [ ] Lighthouse Performance ≥ 95 on a real phone.
