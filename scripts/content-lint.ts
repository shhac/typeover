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
 *
 * Internal shape: ingest builds a `Graph`; each check is a pure
 * `(graph) => Issue[]` function (declared in CHECKS below) so
 * adding a new rule is one append. The driver collects + reports.
 */

import { glob, readFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const contentRoot = join(repoRoot, "src", "content");

/* ───────────────────────────── types ──────────────────────────── */

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
  prerequisites?: readonly string[];
  intro: string;
}
interface ExerciseData {
  target: string;
  themeId: string;
  type: string;
  order: number;
}

interface ModuleEntry {
  data: ModuleData;
  path: string;
}
interface ThemeEntry {
  data: ThemeData;
  path: string;
}
interface ExerciseEntry {
  data: ExerciseData;
  path: string;
  slug: string;
  themeFromPath: string;
}

interface Graph {
  modules: Map<string, ModuleEntry>;
  themes: Map<string, ThemeEntry>;
  exercisesByTheme: Map<string, ExerciseEntry[]>;
}

type Severity = "error" | "warning";
interface Issue {
  severity: Severity;
  path: string;
  msg: string;
}

const fail = (path: string, msg: string): Issue => ({ severity: "error", path, msg });
const warn = (path: string, msg: string): Issue => ({ severity: "warning", path, msg });

/* ───────────────────────────── ingest ────────────────────────── */

async function readYaml<T>(path: string): Promise<T> {
  return parse(await readFile(path, "utf8")) as T;
}

/* Multi-language tracks: file paths are
 *   src/content/modules/<lang>/<module>.yaml
 *   src/content/themes/<lang>/<module>/<theme>.yaml
 *   src/content/exercises/<lang>/<module>/<theme>/<NN>.yaml
 * The slug we build matches Astro's collection-id shape (lang
 * prefix included) so the schema's moduleId / themeId fields
 * compare equal to the path-derived keys. */
async function ingest(): Promise<Graph> {
  const modules = new Map<string, ModuleEntry>();
  const themes = new Map<string, ThemeEntry>();
  const exercisesByTheme = new Map<string, ExerciseEntry[]>();

  for await (const path of glob(join(contentRoot, "modules", "**/*.yaml"))) {
    const segments = relative(join(contentRoot, "modules"), path).split(sep);
    const slug = `${segments[0]}/${basename(segments[segments.length - 1]!, ".yaml")}`;
    modules.set(slug, { data: await readYaml<ModuleData>(path), path });
  }

  for await (const path of glob(join(contentRoot, "themes", "**/*.yaml"))) {
    const segments = relative(join(contentRoot, "themes"), path).split(sep);
    const slug = `${segments[0]}/${segments[1]}/${basename(segments[segments.length - 1]!, ".yaml")}`;
    themes.set(slug, { data: await readYaml<ThemeData>(path), path });
  }

  for await (const path of glob(join(contentRoot, "exercises", "**/*.yaml"))) {
    const segments = relative(join(contentRoot, "exercises"), path).split(sep);
    const themeFromPath = `${segments[0]}/${segments[1]}/${segments[2]}`;
    const exerciseSlug = `${themeFromPath}/${basename(segments[segments.length - 1]!, ".yaml")}`;
    const data = await readYaml<ExerciseData>(path);
    if (!exercisesByTheme.has(themeFromPath)) exercisesByTheme.set(themeFromPath, []);
    exercisesByTheme.get(themeFromPath)!.push({ data, path, slug: exerciseSlug, themeFromPath });
  }

  return { modules, themes, exercisesByTheme };
}

/* ──────────────────────────── checks ─────────────────────────── */

/** Module orders are unique WITHIN A LANGUAGE. The order field
 *  determines render position in the per-language curriculum index,
 *  so go/foundations:1 and zig/basics:1 are both valid — they live
 *  on different pages. */
function checkModuleOrders(g: Graph): Issue[] {
  const out: Issue[] = [];
  const seenPerLang = new Map<string, Map<number, string>>();
  for (const [slug, { data, path }] of g.modules) {
    if (!seenPerLang.has(data.target)) seenPerLang.set(data.target, new Map());
    const seen = seenPerLang.get(data.target)!;
    const prior = seen.get(data.order);
    if (prior) {
      out.push(
        fail(
          path,
          `module order ${data.order} collides with module "${prior}" in language "${data.target}".`,
        ),
      );
    } else {
      seen.set(data.order, slug);
    }
  }
  return out;
}

/** Theme.moduleId points to an existing module. */
function checkThemeParents(g: Graph): Issue[] {
  const out: Issue[] = [];
  for (const [slug, { data, path }] of g.themes) {
    if (!g.modules.has(data.moduleId)) {
      out.push(fail(path, `theme "${slug}" references unknown moduleId "${data.moduleId}".`));
    }
  }
  return out;
}

/** Theme.prerequisites entries point to existing themes. */
function checkThemePrerequisites(g: Graph): Issue[] {
  const out: Issue[] = [];
  for (const [slug, { data, path }] of g.themes) {
    for (const pre of data.prerequisites ?? []) {
      if (!g.themes.has(pre)) {
        out.push(fail(path, `theme "${slug}" prerequisite "${pre}" does not exist.`));
      }
    }
  }
  return out;
}

/** Theme orders are unique within their module. */
function checkThemeOrders(g: Graph): Issue[] {
  const out: Issue[] = [];
  const seenPerModule = new Map<string, Map<number, string>>();
  for (const [slug, { data, path }] of g.themes) {
    if (!seenPerModule.has(data.moduleId)) seenPerModule.set(data.moduleId, new Map());
    const seen = seenPerModule.get(data.moduleId)!;
    const prior = seen.get(data.order);
    if (prior) {
      out.push(
        fail(
          path,
          `theme order ${data.order} collides with "${prior}" inside module "${data.moduleId}".`,
        ),
      );
    } else {
      seen.set(data.order, slug);
    }
  }
  return out;
}

/** Exercise's themeId matches the path-derived parent. (Catches
 *  copy-paste authoring errors where the YAML moved files but the
 *  field stayed.) */
function checkExerciseThemeIdMatchesPath(g: Graph): Issue[] {
  const out: Issue[] = [];
  for (const [themeFromPath, exercises] of g.exercisesByTheme) {
    for (const { data, path } of exercises) {
      if (data.themeId !== themeFromPath) {
        out.push(
          fail(
            path,
            `exercise's \`themeId: "${data.themeId}"\` doesn't match its path-derived parent "${themeFromPath}".`,
          ),
        );
      }
    }
  }
  return out;
}

/** Exercise's themeId references an existing theme. */
function checkExerciseThemeIdExists(g: Graph): Issue[] {
  const out: Issue[] = [];
  for (const exercises of g.exercisesByTheme.values()) {
    for (const { data, path } of exercises) {
      if (!g.themes.has(data.themeId)) {
        out.push(fail(path, `exercise references unknown themeId "${data.themeId}".`));
      }
    }
  }
  return out;
}

/** Within a theme: exercise orders are unique. */
function checkExerciseOrdersUnique(g: Graph): Issue[] {
  const out: Issue[] = [];
  for (const [themeSlug, exercises] of g.exercisesByTheme) {
    const seen = new Map<number, string>();
    for (const { data, path } of exercises) {
      const prior = seen.get(data.order);
      if (prior) {
        out.push(
          fail(
            path,
            `exercise order ${data.order} collides with "${prior}" inside theme "${themeSlug}".`,
          ),
        );
      } else {
        seen.set(data.order, basename(path, ".yaml"));
      }
    }
  }
  return out;
}

/** Within a theme: exercise orders form a contiguous range 1..N
 *  with no gaps. Authors who renumber a theme can miss a slot. */
function checkExerciseOrdersContiguous(g: Graph): Issue[] {
  const out: Issue[] = [];
  for (const [themeSlug, exercises] of g.exercisesByTheme) {
    const orders = exercises.map((e) => e.data.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        out.push(
          fail(
            exercises[0]!.path,
            `theme "${themeSlug}" exercise orders aren't contiguous from 1: got [${orders.join(", ")}], gap at slot ${i + 1}.`,
          ),
        );
        break;
      }
    }
  }
  return out;
}

/** Each theme should have 9 exercise slots per design-docs/02. Warn
 *  for themes with fewer than 9 but at least 1 — these are
 *  half-authored. Themes with zero exercises are pre-launch stubs
 *  for M2+ and don't deserve per-file warnings; counted in the
 *  summary line below instead. */
function checkSlotCount(g: Graph): Issue[] {
  const out: Issue[] = [];
  for (const [themeSlug, { path }] of g.themes) {
    const exercises = g.exercisesByTheme.get(themeSlug) ?? [];
    if (exercises.length > 0 && exercises.length < 9) {
      out.push(
        warn(
          path,
          `theme "${themeSlug}" has ${exercises.length} of the expected 9 exercise slots.`,
        ),
      );
    }
  }
  return out;
}

/* The check registry. Adding a new graph-level rule is one append. */
const CHECKS: ReadonlyArray<(g: Graph) => Issue[]> = [
  checkModuleOrders,
  checkThemeParents,
  checkThemePrerequisites,
  checkThemeOrders,
  checkExerciseThemeIdMatchesPath,
  checkExerciseThemeIdExists,
  checkExerciseOrdersUnique,
  checkExerciseOrdersContiguous,
  checkSlotCount,
];

/* ───────────────────────────── report ────────────────────────── */

const rel = (p: string) => relative(repoRoot, p);
const fmtIssue = (i: Issue): string =>
  i.severity === "error" ? `  ✗  ${rel(i.path)} — ${i.msg}` : `  !  ${rel(i.path)} — ${i.msg}`;

const graph = await ingest();
const issues = CHECKS.flatMap((check) => check(graph));
const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

const emptyThemes: string[] = [];
for (const [themeSlug] of graph.themes) {
  const xs = graph.exercisesByTheme.get(themeSlug) ?? [];
  if (xs.length === 0) emptyThemes.push(themeSlug);
}

console.log(`# content lint\n`);
console.log(
  `Scanned ${graph.modules.size} module(s), ${graph.themes.size} theme(s), ` +
    `${[...graph.exercisesByTheme.values()].reduce((n, xs) => n + xs.length, 0)} exercise(s).`,
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
  errors.forEach((e) => console.log(fmtIssue(e)));
  console.log("");
}

if (warnings.length > 0) {
  console.log(`## Warnings (${warnings.length})\n`);
  warnings.forEach((w) => console.log(fmtIssue(w)));
  console.log("");
}

if (errors.length === 0 && warnings.length === 0) {
  console.log("All graph-level checks pass.");
}

process.exit(errors.length === 0 ? 0 : 1);
