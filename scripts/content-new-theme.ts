#!/usr/bin/env node
/*
 * pnpm content:new theme <lang>/<module>/<theme-id>
 *
 * Stamps a new theme directory + 9 starter exercise files. Per
 * design-docs/09 + 99 — the third of the three authoring tools
 * alongside `runtime:verify` and `content:lint`.
 *
 * The stamped content satisfies every schema refinement (so
 * `pnpm build` doesn't break) AND `pnpm runtime:verify` (so the
 * canonical-runs gate stays green) — the placeholders are all
 * TODO markers in prompts/hints/distractors, and the few fields
 * that runtime:verify checks (canonical + expectStdout) are
 * deliberately trivial valid-Go bodies that produce empty stdout.
 *
 * Author replaces the TODO markers iteratively; the structure
 * gives them the canonical 3-MCQ / 2-fill-word / 2-fill-line /
 * 2-freeform progression from design-docs/02 already encoded.
 *
 * Usage:
 *   pnpm content:new theme go/collections/slices
 *   pnpm content:new theme go/collections/slices --title="Slices and arrays" --order=1
 *   pnpm content:new theme go/collections/slices --yes  (skip prompts; use defaults)
 *
 * Internal shape: a tiny `main()` orchestrates four helpers —
 * `resolveSlug`, `checkPreconditions`, `collectThemeFields`,
 * `stampFiles`. Each is independently testable; the only
 * remaining top-level concern is argv parsing.
 *
 * Exits 1 on validation failure; 0 on success.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const contentRoot = join(repoRoot, "src", "content");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  exit(1);
}

/* ───────── argv parsing ───────── */

interface ParsedArgs {
  slug: string | undefined;
  flags: Record<string, string | true>;
}

function parseArgs(av: readonly string[]): ParsedArgs {
  // av: ["content:new", "theme", "<lang>/<module>/<id>", "--flag=value", ...]
  // Also tolerate "node content-new-theme.ts theme <lang>/<module>/<id>"
  const remaining = [...av];
  if (remaining[0] === "theme") remaining.shift();
  const slug = remaining.find((a) => !a.startsWith("--"));
  const flags = Object.fromEntries(
    remaining
      .filter((a) => a.startsWith("--"))
      .map((a): [string, string | true] => {
        const eq = a.indexOf("=");
        return eq === -1 ? [a.slice(2), true] : [a.slice(2, eq), a.slice(eq + 1)];
      }),
  );
  return { slug, flags };
}

/* ───────── slug + paths resolution ───────── */

import {
  SLOT_BUILDERS,
  type Slug,
  type ThemeFields,
  composeThemeYaml,
} from "./content-new-theme-stubs.ts";

/* The Slug / ThemeFields shapes + the stub templates + YAML
 * helpers all live in `content-new-theme-stubs.ts`. This file
 * keeps the orchestration: argv parsing, slug resolution,
 * preconditions, prompts, and stamping. */

function resolveSlug(raw: string | undefined): Slug {
  const slugParts = raw ? raw.split("/") : [];
  if (slugParts.length !== 3) {
    fail(
      `Usage: pnpm content:new theme <lang>/<module>/<theme-id>\n` +
        `e.g.   pnpm content:new theme go/collections/slices\n` +
        `       pnpm content:new theme zig/basics/while-and-for`,
    );
  }
  const [lang, moduleSlug, themeSlugTail] = slugParts as [string, string, string];
  const moduleId = `${lang}/${moduleSlug}`;
  const themeSlug = `${moduleId}/${themeSlugTail}`;
  return {
    lang,
    moduleSlug,
    themeSlugTail,
    moduleId,
    themeSlug,
    modulePath: join(contentRoot, "modules", lang, `${moduleSlug}.yaml`),
    themeYamlPath: join(contentRoot, "themes", lang, moduleSlug, `${themeSlugTail}.yaml`),
    exercisesDir: join(contentRoot, "exercises", lang, moduleSlug, themeSlugTail),
  };
}

/* ───────── preconditions ───────── */

async function checkPreconditions(slug: Slug): Promise<{ stampingTheme: boolean }> {
  /* Two valid starting states: (1) genuinely new theme — neither
   * theme.yaml nor exercises dir exist; we stamp both. (2) pre-launch
   * stub — theme.yaml already exists (Modules 2-7 all ship with stub
   * theme.yamls per design-docs/10) but exercises don't; we stamp
   * only the exercises and reuse the existing theme metadata. */
  if (!existsSync(slug.modulePath)) {
    const modulesDir = join(contentRoot, "modules", slug.lang);
    const known = existsSync(modulesDir)
      ? (await readdir(modulesDir))
          .filter((f) => f.endsWith(".yaml"))
          .map((f) => `${slug.lang}/${f.replace(/\.yaml$/, "")}`)
      : [];
    fail(
      `Module "${slug.moduleId}" doesn't exist.\n` +
        (known.length > 0
          ? `  Known modules for ${slug.lang}: ${known.join(", ")}`
          : `  No modules under src/content/modules/${slug.lang}/ yet.`),
    );
  }
  if (existsSync(slug.exercisesDir)) {
    /* Even an empty exercises directory blocks us — there's nothing
     * to overwrite, but the intent ("stamp fresh stubs into a clean
     * slot") doesn't apply. Operator can rm the directory and retry. */
    fail(`Exercises directory already exists: ${slug.exercisesDir}\n  Refusing to overwrite.`);
  }
  return { stampingTheme: !existsSync(slug.themeYamlPath) };
}

/* ───────── compute defaults ───────── */

// Highest existing order within this module — new theme defaults to N+1.
async function nextOrder(slug: Slug): Promise<number> {
  const themesDir = join(contentRoot, "themes", slug.lang, slug.moduleSlug);
  if (!existsSync(themesDir)) return 1;
  const yamls = (await readdir(themesDir)).filter((f) => f.endsWith(".yaml"));
  let max = 0;
  for (const f of yamls) {
    const content = await readFile(join(themesDir, f), "utf8");
    const m = content.match(/^order:\s*(\d+)/m);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/* ───────── interactive prompts (or --yes) ───────── */

async function collectThemeFields(
  slug: Slug,
  flags: Record<string, string | true>,
): Promise<ThemeFields> {
  const defaultTitle = slug.themeSlugTail
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const defaultOrder = await nextOrder(slug);

  const flagStr = (k: string): string | undefined => {
    const v = flags[k];
    return typeof v === "string" ? v : undefined;
  };

  let title: string;
  let order: number;
  let intro: string;
  let prerequisites: readonly string[];

  if (flags.yes) {
    title = flagStr("title") ?? defaultTitle;
    order = Number(flagStr("order") ?? defaultOrder);
    intro = flagStr("intro") ?? `TODO: one-paragraph intro for ${slug.themeSlug}.`;
    const preFlag = flagStr("prereqs");
    prerequisites = preFlag ? preFlag.split(",").map((s) => s.trim()) : [];
  } else {
    const rl = createInterface({ input: stdin, output: stdout });
    const ask = async (q: string, def: string): Promise<string> => {
      const a = (await rl.question(`${q}${def ? ` [${def}]` : ""}: `)).trim();
      return a || def || "";
    };
    console.log(`\nNew theme: ${slug.themeSlug}\n`);
    title = flagStr("title") ?? (await ask("title", defaultTitle));
    order = Number(flagStr("order") ?? (await ask("order", String(defaultOrder))));
    intro = await ask("intro (one paragraph)", `TODO: one-paragraph intro for ${slug.themeSlug}.`);
    const pre = await ask("prerequisites (comma-separated, blank for none)", "");
    prerequisites = pre
      ? pre
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    rl.close();
  }

  if (!Number.isInteger(order) || order < 1) {
    fail(`order must be a positive integer, got "${order}"`);
  }
  return { title, order, intro, prerequisites };
}

/* YAML composition + exercise stubs live in
 * ./content-new-theme-stubs.ts. */

/* ───────── stamping ───────── */

async function stampFiles(slug: Slug, fields: ThemeFields | null): Promise<void> {
  if (fields !== null) {
    await mkdir(dirname(slug.themeYamlPath), { recursive: true });
    await writeFile(slug.themeYamlPath, composeThemeYaml(slug, fields));
  }
  await mkdir(slug.exercisesDir, { recursive: true });
  for (let i = 0; i < SLOT_BUILDERS.length; i++) {
    const slot = i + 1;
    const file = join(slug.exercisesDir, `${String(slot).padStart(2, "0")}.yaml`);
    await writeFile(file, SLOT_BUILDERS[i]!(slug, slot));
  }
}

/* ───────── report ───────── */

const rel = (p: string) => p.replace(repoRoot + "/", "");

function report(slug: Slug, themeStamped: boolean): void {
  console.log(`✓ stamped ${slug.themeSlug}`);
  if (themeStamped) {
    console.log(`  theme:     ${rel(slug.themeYamlPath)}`);
  }
  console.log(`  exercises: ${rel(slug.exercisesDir)}/{01..09}.yaml`);
  console.log(`\nNext:`);
  console.log(`  pnpm content:lint       # confirms graph integrity`);
  console.log(`  pnpm runtime:verify     # confirms canonicals run`);
  console.log(`  pnpm build              # confirms schema passes`);
  console.log(`  grep -r 'TODO' ${rel(slug.exercisesDir)}  # find what to write`);
}

/* ───────── entry point ───────── */

async function main(): Promise<void> {
  const { slug: rawSlug, flags } = parseArgs(argv.slice(2));
  const slug = resolveSlug(rawSlug);
  const { stampingTheme } = await checkPreconditions(slug);
  const fields = stampingTheme ? await collectThemeFields(slug, flags) : null;
  if (!stampingTheme) {
    console.log(`Theme metadata already exists at ${slug.themeYamlPath}.`);
    console.log(`Stamping exercise stubs into the existing theme.\n`);
  }
  await stampFiles(slug, fields);
  report(slug, stampingTheme);
}

await main();
