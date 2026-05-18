# 09 — Authoring

## Posture

typeover is **community-friendly from day one**. The author of most
content is the maintainer, but the schema, templates, and process are
documented well enough that anyone can submit a theme via PR.

This serves three goals:

1. **Quality through clarity.** A schema strict enough for outsiders is
   also strict enough to keep the maintainer's content consistent.
2. **Lower bus factor.** If the maintainer goes idle for months, the
   project doesn't die.
3. **Portfolio signal.** A community-friendly repo signals a different
   skill than a solo repo.

## Content tree layout

```
src/content/
├── modules/<module-id>.yaml    # module metadata + theme list
└── themes/<module-id>/<theme-id>/
    ├── theme.yaml              # theme metadata
    ├── concept.md              # learner-facing intro prose
    └── exercises/
        ├── 01-mcq.yaml
        ├── 02-mcq.yaml
        ├── 03-mcq.yaml
        ├── 04-fill-word.yaml
        ├── 05-fill-word.yaml
        ├── 06-fill-line.yaml
        ├── 07-fill-line.yaml
        ├── 08-freeform.yaml
        └── 09-freeform.yaml
```

Schemas live in `src/content/schema.ts` as Zod definitions. Astro
Content Collections validate everything at build time.

## Generator types

Every exercise file declares a `generator.kind` from one of three:

### `template`
Simplest. The exercise file declares a TS template, a Go template, and
a small pool of value substitutions. The generator picks values
deterministically from a seed; the canonical answer is computed by
applying the same substitutions to the Go template.

```yaml
kind: template
vars:
  name: [x, count, total, n]
  value: ["5", "42", "0"]
ts: "let ${name} = ${value};"
canonical: "${name} := ${value}"
distractors:           # optional, MCQ only
  - "var ${name} = ${value};"
```

### `variant`
Pre-authored variants. The generator picks one at random per instance.
Used when the variation needed exceeds template substitution.

```yaml
kind: variant
variants:
  - id: int-int
    ts: "function add(a: number, b: number): number { return a + b; }"
    canonical: "func add(a, b int) int { return a + b }"
    distractors:       # optional, MCQ only
      - "function add(a int, b int) int { return a + b }"
  - id: string-string
    ts: "function greet(s: string): string { return 'hi ' + s; }"
    canonical: "func greet(s string) string { return \"hi \" + s }"
```

### `procedural`
Algorithm in TypeScript. The generator function returns `(instance,
canonicalAnswer)` for any seed. Used for the most-drilled themes (e.g.
"complete this struct from a description").

```yaml
kind: procedural
module: "./gen.ts"
```

## Exercise schema

The Zod schema is the **single source of truth**. Read it directly at
[`src/content.config.ts`](../src/content.config.ts) — don't mirror it
in prose, as duplication drifts. The generator-spec discriminated
union lives alongside the runtime at
[`src/lib/generator.ts`](../src/lib/generator.ts), `z.infer`'d so the
schema and the runtime types never drift either.

Shape at a glance (read the actual files for the live definition):

- An exercise has `target`, `themeId`, `type`, `order`, `prompt`,
  `generator`, `hints` (3-tuple), and optional `blanks`, `runtime`,
  `notes`.
- `generator.kind` is `"template" | "variant" | "procedural"` with
  shapes shown in the section above.
- A theme has `target`, `moduleId`, `title`, `intro`, `order`,
  optional `prerequisites`.
- A module has `target`, `title`, `summary`, `order`.

## Style guide

Voice (peer-level, warm + dry, never patronising) lives at
[06-voice-and-feedback.md](06-voice-and-feedback.md).

**Per-exercise quality bar, per-theme quality bar, fill-line
conventions, distractor rules, and the PR shape are the canonical
contributor surface at the repo root:** see
[`CONTRIBUTING.md`](../CONTRIBUTING.md). This file used to duplicate
them; the duplication drifted, so the rules now live in
CONTRIBUTING and this doc focuses on the *design rationale* (why the
schema looks like it does, why the generator kinds are shaped this
way) rather than the rules an author follows day-to-day.

## Tooling we'll need

- `pnpm exercise:check <id>` — runs the generator N times, checks
  canonical answers compile + match expected outputs (for freeform).
- `pnpm content:lint` — verifies schema, checks for missing hints,
  checks that prerequisite themes exist.
- `pnpm content:new theme <id>` — scaffolds a theme directory from the
  template.

None of this is built yet. It's the second-priority tooling chunk
after the first vertical slice (one rendered exercise) is in place.
