/*
 * Prebake the compile-service L1 cache.
 *
 * For each freeform exercise with `runtime: "server"`, compile the
 * canonical solution at build time and write it to
 * `public/compile-cache/<lang>/<hash>.wasm`. The SW serves these
 * verbatim as static assets — zero Function invocation, zero
 * Sandbox CPU, instant load via Vercel's CDN.
 *
 * Per design-docs/32. Run via `pnpm cache:prebake`. The wider
 * `pnpm build` chain (via `prebuild`) bundles the SW; the prebake
 * is intentionally NOT in `prebuild` so a build still works without
 * Docker. Run it explicitly when canonicals change.
 *
 * Transport selection:
 *   COMPILE_TRANSPORT=docker  (default) — uses local Docker
 *   COMPILE_TRANSPORT=sandbox            — uses Vercel Sandbox
 *                                          (requires snapshot ID +
 *                                          OIDC token)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { contentRoot, loadCollection, repoRoot } from "./content-collection.ts";
import { normalizeRust } from "../src/lib/compile-service/normalize/rust.ts";
import { sha256Hex } from "../src/lib/compile-service/hash.ts";
import { DockerTransport } from "../src/lib/compile-service/transports/docker.ts";
import { SandboxTransport } from "../src/lib/compile-service/transports/sandbox.ts";
import type { CompileTransport } from "../src/lib/compile-service/transports/types.ts";

const exercisesRoot = join(contentRoot, "exercises/rust");
const cacheRoot = join(repoRoot, "public/compile-cache/rust");

export type ExerciseYaml = {
  target: string;
  themeId: string;
  type: string;
  order: number;
  runtime?: string;
  expectStdout?: string;
  alternateCanonicals?: string[];
  acceptedAnswers?: Array<{ match: string; prebake?: boolean }>;
  blanks?: string[];
  generator?: {
    kind?: string;
    canonical?: string;
    variants?: Array<{ canonical?: string }>;
    vars?: Record<string, string[]>;
  };
};

/** Substitute `${name}` template variables in `canonical` with the
 *  first option from each var's options list. Matches what
 *  generator-runtime does at exercise-instance time when the user's
 *  input equals `vars[name][0]` (the canonical answer). Used for
 *  fill-line prebake so the cache key matches what the runtime
 *  actually POSTs when a learner types the canonical line. */
export function substituteCanonicalVars(
  canonical: string,
  vars: Record<string, string[]> | undefined,
): string {
  if (!vars) return canonical;
  let out = canonical;
  for (const [name, options] of Object.entries(vars)) {
    if (Array.isArray(options) && typeof options[0] === "string") {
      out = out.replaceAll(`\${${name}}`, options[0]);
    }
  }
  return out;
}

export function substituteFillLineAnswer(
  canonical: string,
  vars: Record<string, string[]> | undefined,
  blanks: readonly string[] | undefined,
  answer: string,
): string {
  if (!vars || !blanks || blanks.length === 0) return substituteCanonicalVars(canonical, vars);
  const blank = blanks[0]!;
  let out = canonical;
  for (const [name, options] of Object.entries(vars)) {
    const value = name === blank ? substituteCanonicalVars(answer, vars) : options[0];
    if (typeof value === "string") out = out.replaceAll(`\${${name}}`, value);
  }
  return out;
}

interface CanonicalEntry {
  exerciseId: string;
  source: string;
}

/** Pure: extract every canonical source the prebake should compile
 *  from one exercise yaml. Returns:
 *   - 0 entries when the exercise isn't freeform+server-runtime, or
 *     has no canonical/variants
 *   - 1 entry for a `template` generator (single `canonical` field)
 *   - N entries for a `variant` generator (one per variant)
 *
 *  Splitting this out (a) lets the test suite assert all variants
 *  get prebaked (previously the loop took only `variants[0]`,
 *  silently leaving subsequent variants paying cold-compile on
 *  first hit), and (b) keeps the directory walker pure I/O. */
export function extractCanonicals(data: ExerciseYaml): string[] {
  if (data.runtime !== "server") return [];

  /* freeform: the generator's canonical IS the compilable program;
   * variants ship their own canonical each. */
  if (data.type === "freeform") {
    const out: string[] = [];
    if (typeof data.generator?.canonical === "string") {
      out.push(data.generator.canonical);
    }
    for (const v of data.generator?.variants ?? []) {
      if (typeof v.canonical === "string") out.push(v.canonical);
    }
    return out;
  }

  /* fill-line: the generator's canonical is a template with
   * `${var}` placeholders; the compilable program is what you get
   * when you fill each blank with the var's canonical first option.
   * That's also the exact bytes the runtime POSTs when the learner
   * types the canonical answer, so the SHA-256 lines up with the
   * cache lookup the SW does. Alternate canonicals are pre-baked
   * too so success notes pass without a Sandbox round-trip. */
  if (data.type === "fill-line") {
    const out: string[] = [];
    if (typeof data.generator?.canonical === "string") {
      out.push(substituteCanonicalVars(data.generator.canonical, data.generator.vars));
    }
    for (const answer of data.acceptedAnswers ?? []) {
      if (answer.prebake && typeof data.generator?.canonical === "string") {
        out.push(
          substituteFillLineAnswer(
            data.generator.canonical,
            data.generator.vars,
            data.blanks,
            answer.match,
          ),
        );
      }
    }
    for (const alt of data.alternateCanonicals ?? []) {
      if (typeof alt === "string") out.push(alt);
    }
    return out;
  }

  return [];
}

async function collectCanonicals(): Promise<CanonicalEntry[]> {
  if (!existsSync(exercisesRoot)) return [];
  const entries: CanonicalEntry[] = [];

  for (const { id, data } of await loadCollection<ExerciseYaml>("exercises")) {
    if (!id.startsWith("rust/")) continue;
    const sources = extractCanonicals(data);
    if (sources.length === 0) continue;
    sources.forEach((source, idx) => {
      /* When an exercise has multiple variants, append a suffix
       * so the log distinguishes which one's being baked. The
       * hash key is the only thing the SW actually looks up,
       * so the suffix is purely cosmetic. */
      const suffix = sources.length > 1 ? `#${idx}` : "";
      entries.push({
        exerciseId: `${id}${suffix}`,
        source,
      });
    });
  }

  return entries;
}

function pickTransport(): CompileTransport {
  const mode = process.env.COMPILE_TRANSPORT ?? "docker";
  if (mode === "sandbox") {
    /* SandboxTransport uses the pool-pattern: warm sandboxes named
     * by stable shard IDs auto-install rustc on first creation and
     * resume from snapshot afterward. No env-var snapshot ID needed
     * — the pool name + Vercel persistence does it. */
    return new SandboxTransport();
  }
  return new DockerTransport();
}

async function main(): Promise<void> {
  const canonicals = await collectCanonicals();
  if (canonicals.length === 0) {
    console.log("[prebake] no server-runtime rust exercises — nothing to do");
    return;
  }

  const transport = pickTransport();
  console.log(`[prebake] ${canonicals.length} canonical(s) · transport=${transport.name}`);
  await mkdir(cacheRoot, { recursive: true });

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const entry of canonicals) {
    const normalized = normalizeRust(entry.source);
    const hash = await sha256Hex(normalized);
    const outPath = join(cacheRoot, `${hash}.wasm`);
    if (existsSync(outPath)) {
      console.log(`  ✓ ${entry.exerciseId} · cached (${hash.slice(0, 8)})`);
      skipCount++;
      continue;
    }

    const result = await transport.compile({
      language: "rust",
      source: entry.source,
      label: entry.exerciseId,
    });
    if (!result.ok) {
      console.error(
        `  ✗ ${entry.exerciseId} · ${result.elapsedSeconds.toFixed(1)}s\n` +
          result.message
            .split("\n")
            .map((l) => `      ${l}`)
            .join("\n"),
      );
      failCount++;
      continue;
    }
    await writeFile(outPath, result.wasm);
    console.log(
      `  + ${entry.exerciseId} · ${hash.slice(0, 8)} · ` +
        `${(result.wasm.byteLength / 1024).toFixed(1)} KB · ` +
        `${result.elapsedSeconds.toFixed(1)}s`,
    );
    okCount++;
  }

  console.log(`[prebake] done · built ${okCount} · cached ${skipCount} · failed ${failCount}`);
  if (failCount > 0) process.exit(1);
}

await main();
