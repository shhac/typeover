# Contributing to typeover

Thanks for the interest. This doc is the setup-and-conventions
companion to the public [`README.md`](README.md).

## Setup

```bash
git clone <fork>
cd typeover
pnpm install
pnpm dev
```

Dev server runs at `http://localhost:4321/`. Hot-reload covers code
*and* content (YAML); editing an exercise file refreshes the rendered
exercise without restart.

Verify before pushing:

```bash
pnpm build        # static build, must succeed
pnpm typecheck    # astro check, must report 0 errors
```

Both run in <5s on a typical machine.

## What to work on

Open issues track the highest-leverage gaps. The biggest piles right
now:

| Area | What's missing |
|---|---|
| **Module 1 freeform exercises** | Blocked on the Yaegi-in-WASM runtime (task #22). Help on that runtime is welcome. |
| **Modules 2–7 content** | Themes are scaffolded with intros; exercise YAMLs are not yet written. |
| **Distractor sweeps** | A pass over shipped exercises to make sure each distractor fails in a *distinct* way. |
| **Test infrastructure** | Vitest is planned (`task #36`); the test plan is fully written at [`design-docs/12-test-plan.md`](design-docs/12-test-plan.md). |

## Authoring an exercise

Exercises live at `src/content/exercises/<module>/<theme>/<NN>.yaml`.
The shape is validated by Zod at build time; see
`src/content.config.ts` for the schema. A minimal MCQ:

```yaml
target: go
themeId: foundations/variables
type: mcq
order: 1
prompt: |
  Inside a function, which is the idiomatic Go translation of this
  TypeScript?
generator:
  kind: template
  vars:
    name: [count, total, score]
    value: ["5", "42", "0"]
  ts: "let ${name} = ${value};"
  canonical: "${name} := ${value}"
  distractors:
    - "var ${name} = ${value};"
    - "${name} = ${value}"
    - "const ${name} := ${value}"
hints:
  - "TS `let` introduces a new variable; Go has a short form for the same job."
  - "The operator is two characters. Idiomatic at function scope."
  - "`${name} := ${value}`"
runtime: none
```

### Generator kinds

- **`template`** — Use when the same syntactic structure works for
  multiple value choices. Vars are pools the generator picks from
  deterministically per seed; `${name}` placeholders in `ts`,
  `canonical`, and `distractors` are substituted.
- **`variant`** — Use when the exercise needs *semantically distinct*
  examples (different code shapes that share a teaching point, not
  the same shape with different values). Each variant has its own
  `ts`/`canonical`/`distractors`.
- **`procedural`** — Reserved for algorithmically-generated content;
  not implemented yet.

### Quality bar

Per exercise:

- **One concept per exercise.** If it teaches two things, split it.
- **Canonical answer is idiomatic Go**, `gofmt`-clean.
- **All three hints written.** Hint 1 = conceptual nudge; hint 2 =
  structural pointer; hint 3 = near-answer. The hints escalate.
- **Each distractor fails in a *distinct* way** — TS leakage,
  wrong-language-syntax, partial-shift, argument-swap, etc. Avoid
  near-duplicate distractors.
- **`notes:` block** explains the pedagogical intent — what the
  exercise drills, what each distractor exposes. This is
  author-facing documentation; learners never see it.

Per theme:

- **9 exercise slots** in the canonical progression: 3 × MCQ, 2 ×
  fill-word, 2 × fill-line, 2 × freeform.
- **Difficulty ramps cleanly** — recognition → production →
  composition → open problem.

### Fill-line conventions

- Exactly **5 candidate tiles** in the `line:` pool (one canonical,
  four distractors). Schema doesn't enforce this yet but it's the
  house style.
- **When the blanked line is the focus, hardcode the surrounding
  context in `canonical`.** The wrapping code isn't filler — it
  reinforces reflexes from earlier themes. Example: a Theme-5
  break-on-condition fill-line wraps the `${line}` in
  `for i := 0; i < n; i++ { ... }`, recycling Theme 1's `:=` and
  Theme 5's three-clause shape.

## Voice

typeover speaks to its learner as a competent engineer learning a new
language, not as a novice learning to code. The voice is warm + dry,
peer-level, technical. No mascots, no "Great job! ⭐", no
condescension on failure.

Concrete copy patterns are documented in
[`design-docs/06-voice-and-feedback.md`](design-docs/06-voice-and-feedback.md);
the cliff-notes:

| Do | Don't |
|---|---|
| "Correct — and idiomatic." | "Awesome job! ⭐" |
| "Not quite. Pick a different option, ask for a hint, or reveal the answer." | "Oops! Let's try again. 😅" |
| "Compiles, but you'd get heckled in code review." | "Perfect!" |

## Accessibility

The design system is **WCAG 2.2 AA by default**. Don't fight that —
use the existing primitives (`Button`, `CodeBlock`, `Stack`, `Panel`,
`Feedback`, `HintButton`, `RevealButton`) and you inherit focus
rings, keyboard nav, ARIA, and contrast for free. If you find
yourself reaching for raw `<button>` or hard-coding colours, stop and
ask whether the design system needs a new primitive — usually it
already has one.

Test before pushing:

- Keyboard-only navigation works (tab through all interactive
  elements, no traps)
- Screen reader announces phase transitions (`role="status"`
  regions update)
- Mobile layout works on a real phone (not just emulated)

## Pull request

Branch from `main`, work in a feature branch, open a PR. The PR
template asks for:

- **What this PR adds** (one sentence)
- **Pedagogical rationale** (for content PRs: why this exercise,
  what reflex it drills)
- **Manual test run** — list of routes you visited and confirmed
  work
- **Anything you couldn't validate** — flag unknowns; better to
  call them out than to hide them

Smaller PRs land faster. A single exercise per PR is the right
default; a whole theme is fine if the exercises are tightly
coupled.

## Conduct

Be kind. Disagree with positions, not with people. If a discussion
needs heat, take it offline.

## Licence

By contributing, you agree your work is licensed under the same MIT
licence as the rest of the project. See [`LICENSE`](LICENSE).
