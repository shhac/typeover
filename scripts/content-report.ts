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

import { loadCollection } from "./content-collection.ts";

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

const [modulesRaw, themesRaw, exercisesRaw] = await Promise.all([
  loadCollection<ModuleData>("modules"),
  loadCollection<ThemeData>("themes"),
  loadCollection<ExerciseData>("exercises"),
]);

const modules = modulesRaw
  .map(({ id, data }) => ({ id, data }))
  .sort((a, b) => a.data.order - b.data.order);

const themes = themesRaw
  .map(({ id, data }) => ({ id, data }))
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

interface ModuleRow {
  id: string;
  title: string;
  themes: Array<{
    id: string;
    count: number;
    mark: string;
    label: string;
  }>;
}

interface Summary {
  modules: ModuleRow[];
  moduleSummary: { complete: number; partial: number; empty: number };
  themeSummary: { complete: number; wip: number; empty: number };
  totalExercises: number;
  themesWithContent: number;
  totalThemes: number;
}

/** Pure: classify every theme + every module from the already-parsed
 *  content trees and the exercises-by-theme map. The render
 *  function below is the only thing that touches `console.log`,
 *  which keeps the classification logic unit-testable. */
function summarise(
  modules: Array<{ id: string; data: ModuleData }>,
  themes: Array<{ id: string; data: ThemeData }>,
  exercisesByTheme: Map<string, ExerciseData[]>,
): Summary {
  const moduleSummary = { complete: 0, partial: 0, empty: 0 };
  const themeSummary = { complete: 0, wip: 0, empty: 0 };
  let totalExercises = 0;
  let themesWithContent = 0;
  const rows: ModuleRow[] = [];

  for (const m of modules) {
    const themesInModule = themes.filter((t) => t.data.moduleId === m.id);
    const counts = themesInModule.map((t) => exercisesByTheme.get(t.id)?.length ?? 0);
    const moduleHasAny = counts.some((c) => c > 0);
    const moduleHasGap = counts.some((c) => c === 0);
    if (!moduleHasAny) moduleSummary.empty++;
    else if (moduleHasGap) moduleSummary.partial++;
    else moduleSummary.complete++;

    const themeRows = themesInModule.map((t) => {
      const count = exercisesByTheme.get(t.id)?.length ?? 0;
      totalExercises += count;
      if (count > 0) themesWithContent++;
      const c = classify(count);
      if (c.label === "empty") themeSummary.empty++;
      else if (c.label === "complete") themeSummary.complete++;
      else themeSummary.wip++;
      return { id: t.id, count, mark: c.mark, label: c.label };
    });
    rows.push({ id: m.id, title: m.data.title, themes: themeRows });
  }

  return {
    modules: rows,
    moduleSummary,
    themeSummary,
    totalExercises,
    themesWithContent,
    totalThemes: themes.length,
  };
}

function renderMarkdown(summary: Summary): string {
  const lines: string[] = ["# content report\n"];
  for (const m of summary.modules) {
    lines.push(`## ${m.title} (\`${m.id}\`)\n`);
    if (m.themes.length === 0) {
      lines.push("_(no themes yet)_\n");
      continue;
    }
    lines.push("| Theme | Exercises | Status |");
    lines.push("|---|---:|---|");
    for (const t of m.themes) {
      lines.push(`| ${t.mark} \`${t.id}\` | ${t.count} | ${t.label} |`);
    }
    lines.push("");
  }
  const { moduleSummary, themeSummary, totalExercises, themesWithContent, totalThemes } = summary;
  const pct = totalThemes === 0 ? 0 : Math.round((themesWithContent / totalThemes) * 100);
  lines.push("## Summary\n");
  lines.push(
    `Modules:   ${moduleSummary.complete} complete · ${moduleSummary.partial} partial · ${moduleSummary.empty} empty`,
  );
  lines.push(
    `Themes:    ${themeSummary.complete} complete (≥${SLOT_TARGET} slots) · ${themeSummary.wip} WIP · ${themeSummary.empty} empty`,
  );
  lines.push(`Exercises: ${totalExercises} authored across ${themesWithContent} theme(s)`);
  lines.push(
    `Launch progress (themes with any content): ${themesWithContent}/${totalThemes} = ${pct}%`,
  );
  return lines.join("\n");
}

/* ─────────────────────── render ───────────────────── */

const summary = summarise(modules, themes, exercisesByTheme);
console.log(renderMarkdown(summary));
