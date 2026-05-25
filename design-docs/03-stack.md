# 03 — Stack

**Status as of 2026-05-25.** CodeMirror 6 is wired (no longer
"planned"); the runtime table now lists three languages; the project
layout section below has been rewritten to match the lang-prefixed
content tree, the per-language runtime dirs, and the
`src/lib/compile-service/` + `src/service-worker/` additions for the
Rust pipeline. Static-output build, ~600+ pages, 1013 vitest tests
across 74 files.

## Decisions

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 6** | Content-heavy site with interactive islands. Ships 0 KB JS for static lessons; only the exercise components and the language runners hydrate. |
| Islands | **Solid** | Smallest reactive bundle (~7 KB) compared to React (~45 KB). Each interactive component on a lesson page is cheap. |
| Styling | **Tailwind 4** | CSS-first config (`@theme`), token-driven. Design system has named tokens like `--color-accent-go` / `--color-accent-zig` / `--color-accent-rust` referenced by utility classes. |
| Editor | **CodeMirror 6** | ~300 KB vs Monaco's ~2.4 MB. Modular, with grammars dynamic-imported per language (Go, Zig, Rust, TS) so a learner on a Go exercise never pays for the Rust grammar. Recent chunk-size sweep took CodeHighlight from 594 KB → 36 KB. |
| Runtime — Go | **Yaegi compiled to WASM** in a Web Worker | Client-side Go execution. See [04](04-runtime-strategy.md). |
| Runtime — Zig | **Self-hosted Zig compiler in WASM** in a Web Worker | Two-stage compile-then-run inside one worker; see [04b](04b-zig-runtime.md). |
| Runtime — Rust | **Server-compile, client-execute** (Vercel Sandbox → wasm → browser_wasi_shim) | rustc in a Firecracker microVM emits `wasm32-wasip1`; cached via a three-tier (L1 CDN / L2 Blob / L3 sandbox) cascade; see [32](32-compile-service-architecture-2026-05-24.md). |
| Content | **MDX + Astro Content Collections** | Type-safe lesson authoring; Zod-validated frontmatter. Lang-prefixed collection IDs (`<lang>/<module>/<theme>/<NN>`) per [31](31-multi-language-architecture-2026-05-22.md). |
| Package manager | **pnpm** | Fast, disk-efficient, strict by default. |
| Hosting | **Vercel** | Static site deploy + a single project-root Vercel Function (`/api/compile/rust.ts`) for the Rust compile path; the Function is the only non-static surface. |
| Deployment | **typeover.dev** (primary) + **typeover.paulie.app** (alias) | Both domains point at the same Vercel deployment. |
| Analytics | TBD | Likely Plausible or Cloudflare Web Analytics — privacy-first, no cookie banner. |

## What we explicitly chose against

- **Next.js.** Heavier baseline (90–130 KB framework JS per page). All we
  need is islands; we'd be paying for app-shell features we don't use.
- **SvelteKit.** Equivalent capability to Astro+Solid, but Svelte is a new
  component language for any TS-fluent contributor; Solid stays in JSX.
- **TanStack Start.** Production-capable but still RC as of May 2026. Risky
  to bet a multi-year content project on a pre-1.0 framework.
- **Monaco editor.** Too big. We're editing 5–30 line snippets, not full
  files.
- **Full `gc`-in-WASM as primary runtime.** ~50 MB blob. Useful as a
  fallback for hard exercises, not as the default.

## Why Vercel specifically (vs Cloudflare Pages)

The user already has a Vercel account and the free tier covers static-site
needs. Bandwidth ceiling (100 GB/month) is fine as long as the runtime stays
on Yaegi-sized WASM (~few MB, browser-cached after first load). If we ever
adopt full `gc`-in-WASM as a default runtime, the blob hosting moves to
Cloudflare R2 or jsDelivr and Vercel keeps serving the rest.

## Project layout (current — 2026-05-25)

```
typeover/
├── api/                    ← Vercel zero-config Functions
│   └── compile/rust.ts     ← server-compile entry point (design-docs/32)
├── design-docs/            ← this directory
├── public/
│   ├── favicon.svg, og-image.svg
│   ├── yaegi/              ← yaegi.wasm + wasm_exec.js
│   ├── zig/                ← zig.wasm + libcompiler_rt.a + stdlib tar
│   ├── compile-cache/rust/ ← L1 prebaked wasm artifacts (sha256-named)
│   └── sw-compile-cache.js ← built from src/service-worker/compile-cache.ts
├── runtime/
│   ├── yaegi-wasm/         ← Go program building the Yaegi WASM bundle;
│   │                          symbols/ now includes sync/time/context
│   │                          for Modules 6-7
│   └── zig-wasm/           ← Zig WASM build script + smoke test
├── scripts/                ← TS-first scripts (content-lint,
│                              content-new-theme, content-report,
│                              prebake-compile-cache, build-sw,
│                              build-api, bootstrap-rust-sandbox)
├── src/
│   ├── api/                ← /api/compile/rust handler (tested under vitest)
│   ├── content/
│   │   ├── modules/<lang>/        ← lang-prefixed
│   │   ├── themes/<lang>/<module>/<theme>.yaml
│   │   └── exercises/<lang>/<module>/<theme>/NN.yaml
│   ├── content.config.ts
│   ├── components/
│   │   ├── ds/             ← Eyebrow, Compare, ProgressChip,
│   │   │                     CodeBlock, CodeHighlight (dynamic-imported
│   │   │                     grammars), CodeMirrorEditor, TrackCard,
│   │   │                     Accordion, Toast, …
│   │   ├── exercise/       ← Mcq, FillBlankWord, FillBlankLineInput,
│   │   │                     Freeform, ExerciseShell, RunToolbar,
│   │   │                     RunResetToolbar, SmokeProbe, DiffView
│   │   │                     (lazy-loaded), …
│   │   ├── completion/     ← ModuleCompleteCard
│   │   ├── progress/       ← Theme/ExerciseProgressChip islands
│   │   ├── home/           ← HomepageDrill
│   │   └── settings/       ← AppearancePicker
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── compile-service/   ← language registry, hash, normalize/,
│   │   │                        transports/{sandbox,docker,types}.ts,
│   │   │                        sw-handler, validate-rust-source
│   │   ├── assert-unreachable.ts
│   │   ├── curriculum-loaders.ts ← single source for per-lang collections
│   │   ├── exercise-{phase,instance,dispatch}.ts
│   │   ├── use-runtime-run.ts    ← was useYaegiRun; dispatches to
│   │   │                            yaegi / zig / server (snap)
│   │   └── …                    ← seed, generator, progress, theme,
│   │                              content-schema, fill-line-attempts,
│   │                              wrong-pattern, freeform-shape, …
│   ├── pages/
│   │   ├── index.astro
│   │   ├── settings.astro, privacy.astro, design-system.astro
│   │   └── [lang]/                ← shared route tree for go/zig/rust
│   │       ├── index.astro
│   │       └── [module]/
│   │           ├── complete.astro
│   │           └── [theme]/{index,[index]}.astro
│   ├── runtime/
│   │   ├── index.ts, types.ts, client-descriptors.ts
│   │   ├── error-message.ts, fetch-asset.ts, compile-fetch.ts
│   │   ├── wasi-run.ts
│   │   ├── yaegi-worker.ts
│   │   ├── zig-worker.ts, zig-compile.ts, zig-assets.ts
│   │   └── rust-worker.ts
│   ├── service-worker/
│   │   └── compile-cache.ts   ← built into public/sw-compile-cache.js
│   └── styles/global.css
├── astro.config.mjs
├── package.json, tsconfig.json, vitest.config.ts
└── README.md, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md
```

Notes:

- Freeform + fill-line exercises now drive CodeMirror 6 surfaces
  (`CodeMirrorEditor` / `CodeMirrorFillBlanks`) with grammars
  dynamic-imported per `target`. The legacy `<textarea>` is retained
  only as the SSR placeholder before hydration.
- Content shipping: Go ~288 exercises across all 7 modules; Zig ~180
  across Modules 1-4 (basics, types, memory, errors); Rust ~45 across
  the foundations module and growing under an autonomous build loop.
  See [10](10-curriculum-go.md), [10b](10b-curriculum-zig.md),
  [10c](10c-curriculum-rust.md).
- The `lib ↔ runtime` subsystem cycle was severed in May 2026 —
  `error-message`, `client-descriptors`, and `compile-fetch` live in
  `src/runtime/` to keep imports flowing one direction.
