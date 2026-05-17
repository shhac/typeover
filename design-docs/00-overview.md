# typeover — design docs

This directory captures *why* typeover is built the way it is. Each document
is short and answers one question; the goal is that someone landing on the
repo six months from now (including future-us) can rebuild the mental model
from these files alone.

## Foundations

| # | Doc | Question it answers |
|---|---|---|
| 01 | [vision.md](01-vision.md) | What is typeover, who is it for, why does it exist? |
| 02 | [pedagogy.md](02-pedagogy.md) | How does typeover actually teach? Theme vs lesson; exercise progression. |
| 03 | [stack.md](03-stack.md) | Why Astro + Solid + Tailwind + Vercel + pnpm? |
| 04 | [runtime-strategy.md](04-runtime-strategy.md) | How do we run Go in the browser? Yaegi tradeoff and fallback. |
| 05 | [design-system.md](05-design-system.md) | What does typeover look like, and what's the design-system contract? |
| 06 | [voice-and-feedback.md](06-voice-and-feedback.md) | How does typeover speak to learners? Failure UX, hints, reveals. |
| 07 | [release.md](07-release.md) | When does typeover go public? Maintenance shape, sharing posture. |
| 08 | [accessibility-and-mobile.md](08-accessibility-and-mobile.md) | A11y commitments + full mobile support, including for code exercises. |
| 09 | [authoring.md](09-authoring.md) | Community-friendly authoring: lesson template, schema, generator types. |

## Content & data

| # | Doc | Question it answers |
|---|---|---|
| 10 | [curriculum-go.md](10-curriculum-go.md) | Full Go curriculum, top-down outline with iterative validation. |
| 11 | [progress-tracking.md](11-progress-tracking.md) | What state we keep about each learner; gamification-ready schema. |
| 12 | [test-plan.md](12-test-plan.md) | Critical-path test checklist for when Vitest lands. |

## Open / parked

| # | Doc | Question it answers |
|---|---|---|
| 99 | [open-questions.md](99-open-questions.md) | Decided things (with date) + still-open things. |
