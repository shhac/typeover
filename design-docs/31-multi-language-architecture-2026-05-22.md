# 31 — Multi-language track architecture (2026-05-22)

The one-time architectural reshape we made when adding the Zig
track alongside Go. Captures **why the multi-language shape looks
the way it does** so a future contributor adding a third language
doesn't have to re-derive it. Pairs with
[04b-zig-runtime.md](04b-zig-runtime.md) (the Zig-specific runtime
internals) and [10b-curriculum-zig.md](10b-curriculum-zig.md) (the
Zig curriculum spine).

## What changed

Before this session the codebase was implicitly Go-only. Every
content collection ID was a single 3-segment slug
(`foundations/loops/01`), every route lived under `/go/...`, and
the runtime hook was named `useYaegiRun`. Adding Zig forced six
decisions; this doc records each one + the why.

## D1 — Content lives under `src/content/{modules,themes,exercises}/<lang>/...`

Symmetric subdirs by language. Astro collection IDs become
`<lang>/<module>[/<theme>[/<NN>]]` for free, matching the URL
path 1-to-1.

**Alternative considered:** keep Go content flat at
`src/content/modules/foundations.yaml`, put Zig under
`src/content/modules/zig/basics.yaml`. Rejected as asymmetric
forever — future-us looks at the tree and has to remember which
language got the "implicit" treatment.

**Alternative considered:** `<module>/<lang>` (e.g.
`src/content/modules/foundations/go.yaml`). Rejected because
module sets diverge across languages — Go has `concurrency` +
`interfaces`, Zig has `memory` + `comptime`. A `<module>/<lang>`
layout implies a 1:1 mapping between language curricula that
doesn't exist.

Cost: every existing Go `moduleId` and `themeId` value gained a
`go/` prefix in one mechanical sweep. Worth it.

## D2 — Shared `/[lang]/...` route tree

One canonical `src/pages/[lang]/[module]/[theme]/[index].astro`
(plus 4 siblings for the lang index, module index,
module-complete, theme overview). Each page reads `Astro.params.lang`
and filters `getCollection(...)` by `target` to render only that
language's content.

**Alternative considered:** parallel `/go/*` and `/zig/*` route
trees with copy-pasted page files, each filtering its own
target. Rejected because the trees would drift over time — a
fix on /go/[module]/index.astro would silently not land on the
Zig copy. Single source of truth wins.

Implementation: every `getStaticPaths` returns one route per
content entry, with params derived from splitting the collection
ID. Helpers `paramsForExercise`, `paramsForTheme`,
`paramsForModule` live in `src/lib/curriculum-nav.ts`.

## D3 — Schema: `target = z.enum(["go", "zig"])`, `runtime` gains `"zig"`

`targetSchema` was already typed as `z.literal("go")` with a
comment foreshadowing this widening. Widening:

```ts
export const targetSchema = z.enum(["go", "zig"]);
export type Target = z.infer<typeof targetSchema>;
```

The `runtime` enum gained `"zig"` alongside `"yaegi"` /
`"server"` / `"none"`. The `validateFillLineMode` refinement
swaps its hardcoded `runtime === "yaegi"` check for a
`FILL_LINE_RUNTIMES` allowlist (`"yaegi"`, `"zig"`) so adding
a fourth language is a one-line edit. `validateRunnableExpectStdout`
was already shape-correct (gates on `runtime === "none"`).

**Schema gap intentionally left:** there's no refinement asserting
`target === "go" ⇒ runtime ∈ {"yaegi", "server", "none"}` and
`target === "zig" ⇒ runtime ∈ {"zig", "server", "none"}`. An
authoring slip (`target: "zig"` + `runtime: "yaegi"`) passes the
schema today and would route to the wrong worker. Low-risk for
now since we hand-author each YAML and the lint catches the
graph; flagged for a future refinement.

## D4 — `useYaegiRun` → `useRuntimeRun` with runtime selector

The hook's lifecycle (running, runResult, boot status, stall
guard, generation-tagged settlements, reset) was already runtime-
agnostic. Only the worker accessors and the boot-badge label
depended on language. Refactor:

```ts
useRuntimeRun({ runtime: "yaegi" | "zig", buildProgram: () => string })
```

Internally dispatches via a small `RUNTIME_ACCESSORS` record:

```ts
const RUNTIME_ACCESSORS = {
  yaegi: { get: getRunner, terminate: terminateRunner },
  zig:   { get: getZigRunner, terminate: terminateZigRunner },
};
```

The handle also exposes a `runtimeLabel: string` ("Go" / "Zig")
so `RunResetToolbar`'s boot badge renders the right copy without
each consumer owning the mapping.

Consumers updated: `Freeform`, `FillBlankLineInput`, `YaegiSmoke`.
The "server" runtime for freeform exercises snaps to `"yaegi"`
inside Freeform so the hook constructs cleanly; the Run button +
mobile-bar Run handler gate on an `isClientRuntime` predicate so
the unused accessor never actually fires. Replace the snap with
real dispatch when the SSR-fallback path lands.

## D5 — Progress localStorage migration

Existing learners' localStorage carried 3-segment IDs like
`foundations/variables/01`. After the reorg these point at
nothing in the curriculum and would orphan every learner's
progress chip silently.

The read path now detects un-prefixed 3-segment IDs and rewrites
each to `go/<old-id>` once on first read of a fresh tab session.
Conflict policy: if both a legacy `<id>` AND a modern
`go/<id>` exist for the same exercise (vanishingly rare — would
mean the learner ran between commits across the schema bump),
the modern entry wins. No backup blob — not worth the storage.

The migration runs inside `progress.ts`'s `read()` and persists
immediately so cross-tab `storage` listeners see canonical
shape. Four vitest cases cover the rewrite, the no-op on
already-modern IDs, the conflict resolution, and "leave
malformed IDs alone."

**Accepted side-effect:** the exercise-instance RNG seeds on the
ID, so a learner who previously saw `foundations/variables/01::0`
gets a *different* roll under `go/foundations/variables/01::0`.
Their `instancesSeen` count survives but the specific variants
they were being shown are re-rolled. Worth flagging in a future
changelog so it isn't treated as a regression report.

## D6 — DS tokens: Badge / LangCrumbs / CodeBlock accept `"zig"`

The design system widened in three places:

- `Badge` variant union grows `"zig"`, with filled + outline
  classes referencing a new `accent-zig` token.
- `LangCrumbs` `from` / `to` widen from `"ts" | "go"` to
  `"ts" | "go" | "zig"`.
- `CodeBlock` `lang` union grows `"zig"` with a matching
  `ZIG` label tag and color accent.
- `src/styles/global.css`'s base `@theme` block adds
  `--color-accent-zig: #f7a41d` (Zig's brand orange) + a
  dim variant. Every palette inherits the brand orange unless
  it specifically overrides; Tailwind v4 picks it up as
  `bg-accent-zig` / `text-accent-zig` / `border-accent-zig`.

The CodeMirror surfaces (`CodeMirrorFillBlanks`) gained a
`language: "go" | "zig"` prop wired from the exercise's
`target` field. Default stays `"go"` so the 12 existing Go
fill-line exercises don't move. Required adding
`@ndim/codemirror-lang-zig` + the `lezer-zig` →
`@ndim/lezer-zig` pnpm override (the unscoped `lezer-zig` isn't
on npm, same constraint zigtools' playground hit).

## What still has Go-only assumptions

Flagged during the verification review pass; deferred to a
future session because they don't affect anything currently
shipped:

1. **`Freeform.tsx` default scaffold + aria-label + CodeMirror
   `language="go"`** — the freeform editor will seed with `package
   main; import "fmt"…` for any future Zig freeform exercise.
   Mitigate by adding a `scaffold` field to the exercise schema
   and a `language` prop to `CodeMirrorEditor`.
2. **`MobileKeyBar` default chips** include `:=` (wrong for Zig).
   Add a language-aware preset.
3. **`use-runtime-run.test.ts` Zig dispatch coverage** — tests
   mock Yaegi + Zig with the same spy and only set
   `runtime: "yaegi"`. A regression that hard-codes the Yaegi
   branch wouldn't fail any test. Add one case constructing the
   hook with `runtime: "zig"`, using distinct mocks.
4. **`scripts/content-new-theme.mjs` stub templates** still emit
   Go-flavoured placeholder snippets even when called with a
   Zig slug. Either pass language into the placeholder copy or
   leave the stubs language-agnostic.
5. **No `/zig-smoke` route** — `src/pages/runtime-smoke.astro` is
   Yaegi-only. A parallel Zig probe route would be useful for
   dev-side verification without spinning up a real exercise.

## Why no `[lang]` content-collection alias

We didn't add a `Lang` type alias re-exported from a central
spot — the `target` field is the canonical source-of-truth and
every consumer reads it directly from the entry. Adding an alias
would create two ways to refer to a language without making any
existing code clearer.

## Files that capture each decision

| Decision | Files |
|---|---|
| D1 — content layout | `src/content/{modules,themes,exercises}/<lang>/...` |
| D2 — `/[lang]/` route | `src/pages/[lang]/**/*.astro`, `src/lib/curriculum-nav.ts` |
| D3 — schema | `src/lib/content-schema.ts` |
| D4 — runtime hook | `src/lib/use-runtime-run.ts`, `src/components/exercise/{Freeform,FillBlankLineInput}.tsx`, `src/components/exercise/RunResetToolbar.tsx` |
| D5 — progress migration | `src/lib/progress.ts`'s `migrateLegacyIds`, tests in `progress.test.ts` |
| D6 — DS tokens | `src/components/ds/{Badge,LangCrumbs,CodeBlock,CodeMirrorFillBlanks}.tsx`, `src/styles/global.css` |
