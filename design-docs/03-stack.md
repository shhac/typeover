# 03 — Stack

## Decisions

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 6** | Content-heavy site with interactive islands. Ships 0 KB JS for static lessons; only quizzes and the Go runner hydrate. |
| Islands | **Solid** | Smallest reactive bundle (~7 KB) compared to React (~45 KB). Each interactive component on a lesson page is cheap. |
| Styling | **Tailwind 4** | CSS-first config (`@theme`), token-driven. Design system has named tokens like `--color-accent-go` referenced by utility classes. |
| Editor | **CodeMirror 6** (planned) | ~300 KB vs Monaco's ~2.4 MB. Modular, has a Go grammar via `@codemirror/lang-go`. Decent mobile support (verified during build). Replit and Sourcegraph both moved to CodeMirror for the same reason. |
| Runtime | **Yaegi compiled to WASM** in a Web Worker | Client-side Go execution. Run user code without a server roundtrip. Falls back to server compile for exercises Yaegi can't handle (see runtime-strategy.md). |
| Content | **MDX + Astro Content Collections** | Type-safe lesson authoring; Zod-validated frontmatter. |
| Package manager | **pnpm** | Fast, disk-efficient, strict by default. |
| Hosting | **Vercel** | Static site deploy is trivial; serverless functions available later if we need server-compiled exercises. |
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

## Project layout (current)

```
typeover/
├── design-docs/        ← this directory
├── public/             ← static assets (favicon, og images)
├── src/
│   ├── components/
│   │   └── ds/         ← design system (one component per file)
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css  ← Tailwind import + @theme tokens
├── astro.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

Future additions (planned, not yet present):

```
src/
├── content/            ← MDX lesson collections
│   ├── lessons/
│   └── config.ts       ← Zod schemas for frontmatter
├── runtime/            ← Yaegi-in-WASM + worker plumbing
│   ├── worker.ts
│   └── yaegi.wasm
└── components/
    ├── quiz/           ← MCQ, TileFill, ConstrainedWrite components
    └── runner/         ← CodeMirror + worker-backed run button
```
