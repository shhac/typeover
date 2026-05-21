/*
 * Cross-file content integrity check.
 *
 * Two layers already catch most authoring errors:
 *   - Per-file Zod schema (src/lib/content-schema.ts) fires at
 *     `pnpm build` and rejects shape / type / cross-field errors
 *     inside ONE YAML.
 *   - `pnpm runtime:verify` runs every freeform + fill-line
 *     canonical through Yaegi and confirms stdout matches
 *     expectStdout.
 *
 * What neither catches is the graph layer — references between
 * modules / themes / exercises that have to resolve, ordering
 * within a parent, missing slots. This script fills that gap.
 *
 * Run with: pnpm content:lint
 * Exits 1 on any error; 0 otherwise. Warnings don't fail the run
 * but are surfaced.
 *
 * Per design-docs/09 — the third of the three planned authoring
 * tools (alongside `runtime:verify` and the still-unbuilt
 * `content:new theme`).
 */

import { glob, readFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const contentRoot = join(repoRoot, "src", "content");

/** errors fail the run, warnings just print. */
const errors = [];
const warnings = [];

/** rel(path) — repo-relative path for tidy error messages. */
const rel = (p) => relative(repoRoot, p);
const err = (path, msg) => errors.push(`  ✗  ${rel(path)} — ${msg}`);
const warn = (path, msg) => warnings.push(`  !  ${rel(path)} — ${msg}`);

/* ───────────────────────────── ingest ────────────────────────── */

async function readYaml(path) {
  return parse(await readFile(path, "utf8"));
}

const modules = new Map(); // slug → { data, path } where slug is "<lang>/<module>"
const themes = new Map(); // slug → { data, path } where slug is "<lang>/<module>/<theme>"
const exercisesByTheme = new Map(); // themeSlug → Array<{ data, path, slug }>

/* Multi-language tracks: file paths are
 *   src/content/modules/<lang>/<module>.yaml
 *   src/content/themes/<lang>/<module>/<theme>.yaml
 *   src/content/exercises/<lang>/<module>/<theme>/<NN>.yaml
 * The slug we build matches Astro's collection-id shape (lang
 * prefix included) so the schema's moduleId / themeId fields
 * compare equal to the path-derived keys. */

for await (const path of glob(join(contentRoot, "modules", "**/*.yaml"))) {
  const segments = relative(join(contentRoot, "modules"), path).split(sep);
  /* `<lang>/<module>.yaml` → slug `<lang>/<module>`. */
  const slug = `${segments[0]}/${basename(segments[segments.length - 1], ".yaml")}`;
  modules.set(slug, { data: await readYaml(path), path });
}

for await (const path of glob(join(contentRoot, "themes", "**/*.yaml"))) {
  /* `<lang>/<module>/<theme>.yaml` → slug `<lang>/<module>/<theme>`. */
  const segments = relative(join(contentRoot, "themes"), path).split(sep);
  const slug = `${segments[0]}/${segments[1]}/${basename(segments[segments.length - 1], ".yaml")}`;
  themes.set(slug, { data: await readYaml(path), path });
}

for await (const path of glob(join(contentRoot, "exercises", "**/*.yaml"))) {
  const segments = relative(join(contentRoot, "exercises"), path).split(sep);
  /* `<lang>/<module>/<theme>/<NN>.yaml`. The themeId field inside is
   * the authoritative parent reference — but we record the path-
   * derived parent for cross-checking. */
  const themeFromPath = `${segments[0]}/${segments[1]}/${segments[2]}`;
  const exerciseSlug = `${themeFromPath}/${basename(segments[segments.length - 1], ".yaml")}`;
  const data = await readYaml(path);
  if (!exercisesByTheme.has(themeFromPath)) exercisesByTheme.set(themeFromPath, []);
  exercisesByTheme.get(themeFromPath).push({ data, path, slug: exerciseSlug, themeFromPath });
}

/* ──────────────────────────── checks ─────────────────────────── */

/** Module orders are unique WITHIN A LANGUAGE. The order field
 *  determines render position in the per-language curriculum index,
 *  so go/foundations:1 and zig/basics:1 are both valid — they live
 *  on different pages. */
{
  const seenPerLang = new Map();
  for (const [slug, { data, path }] of modules) {
    const lang = data.target;
    if (!seenPerLang.has(lang)) seenPerLang.set(lang, new Map());
    const seen = seenPerLang.get(lang);
    const prior = seen.get(data.order);
    if (prior) {
      err(
        path,
        `module order ${data.order} collides with module "${prior}" in language "${lang}".`,
      );
    } else {
      seen.set(data.order, slug);
    }
  }
}

/** Theme.moduleId points to an existing module. */
for (const [slug, { data, path }] of themes) {
  if (!modules.has(data.moduleId)) {
    err(path, `theme "${slug}" references unknown moduleId "${data.moduleId}".`);
  }
}

/** Theme.prerequisites entries point to existing themes. */
for (const [slug, { data, path }] of themes) {
  for (const pre of data.prerequisites ?? []) {
    if (!themes.has(pre)) {
      err(path, `theme "${slug}" prerequisite "${pre}" does not exist.`);
    }
  }
}

/** Theme orders are unique within their module. */
{
  const seenPerModule = new Map();
  for (const [slug, { data, path }] of themes) {
    const key = data.moduleId;
    if (!seenPerModule.has(key)) seenPerModule.set(key, new Map());
    const seen = seenPerModule.get(key);
    const prior = seen.get(data.order);
    if (prior) {
      err(
        path,
        `theme order ${data.order} collides with "${prior}" inside module "${data.moduleId}".`,
      );
    } else {
      seen.set(data.order, slug);
    }
  }
}

/** Exercise's themeId matches the path-derived parent. (Catches
 *  copy-paste authoring errors where the YAML moved files but the
 *  field stayed.) */
for (const [themeFromPath, exercises] of exercisesByTheme) {
  for (const { data, path } of exercises) {
    if (data.themeId !== themeFromPath) {
      err(
        path,
        `exercise's \`themeId: "${data.themeId}"\` doesn't match its path-derived parent "${themeFromPath}".`,
      );
    }
  }
}

/** Exercise's themeId references an existing theme. */
for (const exercises of exercisesByTheme.values()) {
  for (const { data, path } of exercises) {
    if (!themes.has(data.themeId)) {
      err(path, `exercise references unknown themeId "${data.themeId}".`);
    }
  }
}

/** Within a theme: exercise orders are unique. */
for (const [themeSlug, exercises] of exercisesByTheme) {
  const seen = new Map();
  for (const { data, path } of exercises) {
    const prior = seen.get(data.order);
    if (prior) {
      err(
        path,
        `exercise order ${data.order} collides with "${prior}" inside theme "${themeSlug}".`,
      );
    } else {
      seen.set(data.order, basename(path, ".yaml"));
    }
  }
}

/** Within a theme: exercise orders form a contiguous range 1..N
 *  with no gaps. Authors who renumber a theme can miss a slot. */
for (const [themeSlug, exercises] of exercisesByTheme) {
  const orders = exercises.map((e) => e.data.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      err(
        exercises[0].path,
        `theme "${themeSlug}" exercise orders aren't contiguous from 1: got [${orders.join(", ")}], gap at slot ${i + 1}.`,
      );
      break;
    }
  }
}

/** Each theme should have 9 exercise slots per design-docs/02. Warn
 *  for themes with fewer than 9 but at least 1 — these are
 *  half-authored. Themes with zero exercises are pre-launch stubs
 *  for M2+ and don't deserve per-file warnings; counted in the
 *  summary line below instead. */
const emptyThemes = [];
for (const [themeSlug, { path }] of themes) {
  const exercises = exercisesByTheme.get(themeSlug) ?? [];
  if (exercises.length === 0) {
    emptyThemes.push(themeSlug);
  } else if (exercises.length < 9) {
    warn(path, `theme "${themeSlug}" has ${exercises.length} of the expected 9 exercise slots.`);
  }
}

/* ───────────────────────────── report ────────────────────────── */

console.log(`# content lint\n`);
console.log(
  `Scanned ${modules.size} module(s), ${themes.size} theme(s), ` +
    `${[...exercisesByTheme.values()].reduce((n, xs) => n + xs.length, 0)} exercise(s).`,
);
if (emptyThemes.length > 0) {
  console.log(
    `${emptyThemes.length} theme(s) have no exercises yet (pre-launch stubs): ` +
      emptyThemes.map((s) => `\`${s}\``).join(", "),
  );
}
console.log("");

if (errors.length > 0) {
  console.log(`## Errors (${errors.length})\n`);
  errors.forEach((e) => console.log(e));
  console.log("");
}

if (warnings.length > 0) {
  console.log(`## Warnings (${warnings.length})\n`);
  warnings.forEach((w) => console.log(w));
  console.log("");
}

if (errors.length === 0 && warnings.length === 0) {
  console.log("All graph-level checks pass.");
}

process.exit(errors.length === 0 ? 0 : 1);
