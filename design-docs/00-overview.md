# typeover — design docs

This directory captures *why* typeover is built the way it is. Each document is
short and answers one question; the goal is that someone landing on the repo
six months from now (including future-us) can rebuild the mental model from
these files alone.

| # | Doc | Question it answers |
|---|---|---|
| 01 | [vision.md](01-vision.md) | What is typeover, who is it for, why does it exist? |
| 02 | [pedagogy.md](02-pedagogy.md) | How does typeover actually teach? What's the exercise vocabulary? |
| 03 | [stack.md](03-stack.md) | Why Astro + Solid + Tailwind + Vercel + pnpm? |
| 04 | [runtime-strategy.md](04-runtime-strategy.md) | How do we run Go in the browser? What's the Yaegi tradeoff? |
| 05 | [design-system.md](05-design-system.md) | What does typeover look like, and why? |

Things explicitly **not** yet decided (open in [open-questions.md](99-open-questions.md)):

- Account model (anonymous local-only vs cloud-synced progress)
- Content authoring pipeline (MDX collections vs DB)
- Grading strategy depth (string match vs AST diff vs test cases)
- Scope of stdlib coverage in exercises
