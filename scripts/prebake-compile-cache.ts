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

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { normalizeRust } from "../src/lib/compile-service/normalize/rust.ts";
import { sha256Hex } from "../src/lib/compile-service/hash.ts";
import { DockerTransport } from "../src/lib/compile-service/transports/docker.ts";
import { SandboxTransport } from "../src/lib/compile-service/transports/sandbox.ts";
import type { CompileTransport } from "../src/lib/compile-service/transports/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const exercisesRoot = join(root, "src/content/exercises/rust");
const cacheRoot = join(root, "public/compile-cache/rust");

export type ExerciseYaml = {
  target: string;
  themeId: string;
  type: string;
  order: number;
  runtime?: string;
  expectStdout?: string;
  generator?: {
    kind?: string;
    canonical?: string;
    variants?: Array<{ canonical?: string }>;
  };
};

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
  if (data.type !== "freeform") return [];
  const out: string[] = [];
  if (typeof data.generator?.canonical === "string") {
    out.push(data.generator.canonical);
  }
  for (const v of data.generator?.variants ?? []) {
    if (typeof v.canonical === "string") out.push(v.canonical);
  }
  return out;
}

async function collectCanonicals(): Promise<CanonicalEntry[]> {
  if (!existsSync(exercisesRoot)) return [];
  const entries: CanonicalEntry[] = [];

  async function walk(dir: string): Promise<void> {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const full = join(dir, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.name.endsWith(".yaml")) {
        const raw = await readFile(full, "utf8");
        const data = parse(raw) as ExerciseYaml;
        const sources = extractCanonicals(data);
        if (sources.length === 0) continue;
        const idPath = relative(exercisesRoot, full).replace(/\.yaml$/, "");
        sources.forEach((source, idx) => {
          /* When an exercise has multiple variants, append a suffix
           * so the log distinguishes which one's being baked. The
           * hash key is the only thing the SW actually looks up,
           * so the suffix is purely cosmetic. */
          const suffix = sources.length > 1 ? `#${idx}` : "";
          entries.push({
            exerciseId: `rust/${idPath}${suffix}`,
            source,
          });
        });
      }
    }
  }

  await walk(exercisesRoot);
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
    console.log(
      "[prebake] no freeform rust exercises with runtime=server — nothing to do",
    );
    return;
  }

  const transport = pickTransport();
  console.log(
    `[prebake] ${canonicals.length} canonical(s) · transport=${transport.name}`,
  );
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
          result.message.split("\n").map((l) => `      ${l}`).join("\n"),
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

  console.log(
    `[prebake] done · built ${okCount} · cached ${skipCount} · failed ${failCount}`,
  );
  if (failCount > 0) process.exit(1);
}

await main();
