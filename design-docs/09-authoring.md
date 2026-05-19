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
├── modules/<module-id>.yaml             # module metadata + summary
├── themes/<module-id>/<theme-id>.yaml   # theme metadata + intro prose
└── exercises/<module-id>/<theme-id>/
    ├── 01.yaml
    ├── 02.yaml
    ├── …
    └── 09.yaml
```

Themes are flat YAML files (intro prose lives inside as the `intro`
string, not in a separate `.md` file). Exercises are named by their
slot number `NN.yaml`; the `type` field inside (`mcq` / `fill-word` /
`fill-line` / `freeform`) determines which component renders them,
not the filename. The canonical 9-slot progression is documented in
[02-pedagogy.md](02-pedagogy.md) and enforced by `content:lint`.

Schemas live in [`src/content.config.ts`](../src/content.config.ts)
(the Astro-side entry point) and
[`src/lib/content-schema.ts`](../src/lib/content-schema.ts) (the
vitest-testable extract). Astro Content Collections validate
everything at build time.

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

## Authoring tooling

Three planned tools, two shipped:

- **`pnpm runtime:verify`** — *shipped.* Runs every freeform +
  fill-line canonical through Yaegi and confirms `expectStdout`
  matches. Closest analogue to the original `exercise:check <id>`
  proposal; runs across the whole tree, not per-id, because that
  matches how content gets reviewed in practice (PRs touch
  multiple files).
- **`pnpm content:lint`** — *shipped 2026-05-19.*
  `scripts/content-lint.mjs`. Cross-file graph integrity: theme
  → module references, exercise → theme references, unique
  orders, contiguous 1..N slot numbering within a theme,
  half-authored theme warnings. The per-file Zod schema and
  `runtime:verify` cover the other two layers (per-file and
  per-canonical); this covers the graph.
- **`pnpm content:new theme <id>`** — *not built.* Stamper for a
  theme.yaml + 9 prefilled exercise YAMLs across the canonical
  3 × MCQ / 2 × fill-word / 2 × fill-line / 2 × freeform
  progression. Proposed shape in
  [99-open-questions.md](99-open-questions.md). Pickup gated on
  either the maintainer authoring Module 2 reaching for it OR
  the first community PR bouncing off the manual scaffold.
