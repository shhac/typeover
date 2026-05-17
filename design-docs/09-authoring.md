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
ts: "let ${name} = ${value};"
go: "${name} := ${value}"
vars:
  - name: { values: [x, count, total, n] }
  - value: { values: ["5", "42", "0"] }
```

### `variant`
Pre-authored variants. The generator picks one at random per instance.
Used when the variation needed exceeds template substitution.

```yaml
kind: variant
variants:
  - id: int-int
    ts: "function add(a: number, b: number): number { return a + b; }"
    go:  "func add(a, b int) int { return a + b }"
  - id: string-string
    ts: "function greet(s: string): string { return 'hi ' + s; }"
    go:  "func greet(s string) string { return \"hi \" + s }"
```

### `procedural`
Algorithm in TypeScript. The generator function returns `(instance,
canonicalAnswer)` for any seed. Used for the most-drilled themes (e.g.
"complete this struct from a description").

```yaml
kind: procedural
module: "./gen.ts"
```

## Exercise schema (Zod)

Sketched here; canonical is `src/content/schema.ts`.

```ts
const Exercise = z.object({
  id: z.string(),                      // stable, used in URL + storage
  type: z.enum([
    "mcq", "fill-word", "fill-line", "freeform",
  ]),
  prompt: z.string(),                  // shown to learner
  generator: GeneratorSpec,            // see above

  hints: z.tuple([
    z.string(),  // conceptual
    z.string(),  // structural
    z.string(),  // near-answer
  ]),

  canonical: z.string(),               // idiomatic Go (for diff and reveal)
  testCases: z.array(z.object({        // freeform only
    in: z.unknown(),
    out: z.unknown(),
  })).optional(),

  runtime: z.enum(["yaegi", "server", "none"]).default("none"),
  notes: z.string().optional(),        // author-facing rationale
});
```

## Style guide for authors

### Voice
See [06-voice-and-feedback.md](06-voice-and-feedback.md). Peer-level,
warm + dry, never patronising.

### Quality bar (per exercise)
- One concept per exercise. If an exercise teaches two things, it
  splits.
- Canonical answer is idiomatic Go. `gofmt`-clean.
- All three hints written. Conceptual is a *nudge*, not the answer.
- Generator produces at least 3 meaningfully different instances.
- Author runs every instance manually before opening the PR.

### Quality bar (per theme)
- Theme has all 9 slots filled (or a documented reason for fewer).
- Difficulty ramps cleanly: MCQ → fill-word → fill-line → freeform.
- Prerequisite themes are declared in `theme.yaml`.

## CONTRIBUTING.md sketch

The full contributing doc will live at the repo root. Outline:

1. **Setup** — `pnpm install`, `pnpm dev`, the dev URL.
2. **Authoring a theme** — copy `_template/`, fill in metadata, add
   exercises following the schema.
3. **Generator authoring** — for each generator type, a worked example.
4. **Validating** — `pnpm typecheck` + `pnpm exercise:check <id>` runs
   every generator instance and verifies canonical answers compile.
5. **Submitting** — PR template asks for the why, the source idea, and
   confirmation that you ran every instance.

## Tooling we'll need

- `pnpm exercise:check <id>` — runs the generator N times, checks
  canonical answers compile + match expected outputs (for freeform).
- `pnpm content:lint` — verifies schema, checks for missing hints,
  checks that prerequisite themes exist.
- `pnpm content:new theme <id>` — scaffolds a theme directory from the
  template.

None of this is built yet. It's the second-priority tooling chunk
after the first vertical slice (one rendered exercise) is in place.
