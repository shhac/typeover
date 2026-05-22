/*
 * Authoring-progress report. Cheaper than the lint:
 * `content-lint.ts` answers "is the content graph valid?"; this
 * answers "how much have we written, and what's left?". Run with
 *
 *   pnpm content:report
 *
 * Always exits 0 — informational. Output is a structured Markdown
 * table grouped by module, with a summary line. The data is the
 * same content collection Astro builds against; no schema fields
 * added.
 *
 * Surfaces design-docs/25 P8 devil's-advocate recommendation: the
 * Module 3+ authoring queue benefits from a single "what's left to
 * write" view that doesn't require running the lint and reading
 * its pre-launch-stub footnote.
 */

import { glob, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const contentRoot = join(repoRoot, "src", "content");

/** Soft slot target per design-docs/02 ("9 exercises per theme")
 *  + design-docs/23's actual landings (10-11 per theme). Used to
 *  label themes as `complete` (≥ SLOT_TARGET) vs `WIP` (< target
 *  but ≥ 1). Themes with zero exercises are flagged `empty`. */
const SLOT_TARGET = 9;

interface ModuleData {
  target: string;
  title: string;
  order: number;
  summary: string;
}
interface ThemeData {
  target: string;
  moduleId: string;
  title: string;
  order: number;
}
interface ExerciseData {
  target: string;
  themeId: string;
  order: number;
}

interface RawEntry<T> {
  data: T;
  path: string;
}

/** Load + parse every YAML under a content sub-tree. */
async function loadCollection<T>(subdir: string): Promise<RawEntry<T>[]> {
  const out: RawEntry<T>[] = [];
  for await (const path of glob(join(contentRoot, subdir, "**/*.yaml"))) {
    const data = parse(await readFile(path, "utf8")) as T;
    out.push({ data, path });
  }
  return out;
}

const [modulesRaw, themesRaw, exercisesRaw] = await Promise.all([
  loadCollection<ModuleData>("modules"),
  loadCollection<ThemeData>("themes"),
  loadCollection<ExerciseData>("exercises"),
]);

/* Module / theme IDs match Astro's collection IDs:
 *   modules/<lang>/<module>.yaml      → `<lang>/<module>`
 *   themes/<lang>/<module>/<theme>.yaml → `<lang>/<module>/<theme>`
 * Mirrors how astro:content + the lint identify entries. */
function moduleId(path: string): string {
  const r = relative(join(contentRoot, "modules"), path);
  return r.slice(0, -".yaml".length).split(sep).join("/");
}
function themeId(path: string): string {
  const r = relative(join(contentRoot, "themes"), path);
  return r.slice(0, -".yaml".length).split(sep).join("/");
}

const modules = modulesRaw
  .map(({ data, path }) => ({ id: moduleId(path), data }))
  .sort((a, b) => a.data.order - b.data.order);

const themes = themesRaw
  .map(({ data, path }) => ({ id: themeId(path), data }))
  .sort((a, b) => a.data.order - b.data.order);

/** Group exercises by theme ID. */
const exercisesByTheme = new Map<string, ExerciseData[]>();
for (const { data } of exercisesRaw) {
  const arr = exercisesByTheme.get(data.themeId) ?? [];
  arr.push(data);
  exercisesByTheme.set(data.themeId, arr);
}

/** Per-theme bookkeeping for the table + summary. */
function classify(count: number): { mark: string; label: string } {
  if (count === 0) return { mark: "○", label: "empty" };
  if (count < SLOT_TARGET) return { mark: "·", label: `WIP (${count}/${SLOT_TARGET})` };
  return { mark: "✓", label: "complete" };
}

/* ─────────────────────── per-module render ───────────────────── */

console.log("# content report\n");

const moduleSummary = { complete: 0, partial: 0, empty: 0 };
const themeSummary = { complete: 0, wip: 0, empty: 0 };
let totalExercises = 0;
let themesWithContent = 0;

for (const m of modules) {
  const themesInModule = themes.filter((t) => t.data.moduleId === m.id);
  const counts = themesInModule.map((t) => exercisesByTheme.get(t.id)?.length ?? 0);
  const moduleHasAny = counts.some((c) => c > 0);
  const moduleHasGap = counts.some((c) => c === 0);
  if (!moduleHasAny) moduleSummary.empty++;
  else if (moduleHasGap) moduleSummary.partial++;
  else moduleSummary.complete++;

  console.log(`## ${m.data.title} (\`${m.id}\`)\n`);
  if (themesInModule.length === 0) {
    console.log("_(no themes yet)_\n");
    continue;
  }

  console.log("| Theme | Exercises | Status |");
  console.log("|---|---:|---|");
  for (const t of themesInModule) {
    const count = exercisesByTheme.get(t.id)?.length ?? 0;
    totalExercises += count;
    if (count > 0) themesWithContent++;
    const c = classify(count);
    if (c.label === "empty") themeSummary.empty++;
    else if (c.label === "complete") themeSummary.complete++;
    else themeSummary.wip++;
    console.log(`| ${c.mark} \`${t.id}\` | ${count} | ${c.label} |`);
  }
  console.log("");
}

/* ───────────────────────── summary line ──────────────────────── */

const totalThemes = themes.length;
const pct = totalThemes === 0 ? 0 : Math.round((themesWithContent / totalThemes) * 100);

console.log("## Summary\n");
console.log(
  `Modules:   ${moduleSummary.complete} complete · ${moduleSummary.partial} partial · ${moduleSummary.empty} empty`,
);
console.log(
  `Themes:    ${themeSummary.complete} complete (≥${SLOT_TARGET} slots) · ${themeSummary.wip} WIP · ${themeSummary.empty} empty`,
);
console.log(`Exercises: ${totalExercises} authored across ${themesWithContent} theme(s)`);
console.log(
  `Launch progress (themes with any content): ${themesWithContent}/${totalThemes} = ${pct}%`,
);
