/*
 * Verify every "runnable" exercise's canonical produces its
 * expectStdout under Yaegi. "Runnable" = freeform OR fill-line that
 * opts into the input+Yaegi UX by setting `expectStdout`.
 *
 * For fill-line: substitute vars.line[0] (the correct line) into the
 * canonical at the `${line}` placeholder, then run.
 * For freeform: run the canonical directly.
 *
 * Catches authoring drift before it hits a learner. Manual today via:
 *   pnpm runtime:verify [--filter <substring>]
 *
 * --filter narrows the scan to paths containing the substring (case-
 * sensitive). Per design-docs/20 proposer-cycle, this is the smaller
 * win that supersedes a per-exercise CLI: HMR + a pinned tab already
 * covers single-file iteration on the visual side; this flag covers
 * the headless Yaegi-grading side.
 *
 * (Replaces the freeform-only verify-freeform.mjs.)
 */
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { bootstrapYaegi } from "./bootstrap.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

/* --filter <substring>: narrow the scan to paths containing the
 * substring. Minimal CLI parse — no flag library, no aliases; the
 * script is meant to stay readable. */
const filterIdx = process.argv.indexOf("--filter");
const filter = filterIdx >= 0 ? process.argv[filterIdx + 1] : null;
if (filterIdx >= 0 && !filter) {
  console.error("--filter requires a substring argument");
  process.exit(2);
}

const yaegiEval = await bootstrapYaegi();

/* Returns the program to run + a label, or null if the exercise
 * isn't runnable under this verifier. */
function buildProgram(data) {
  if (data?.type === "freeform") {
    return { kind: "freeform", code: data.generator?.canonical };
  }
  if (data?.type === "fill-line" && data.expectStdout !== undefined) {
    const tmpl = data.generator?.canonical;
    /* The blank var's name is read from `blanks[0]` rather than
     * hardcoded to `line` so authors can pick a name that better
     * describes the missing piece (e.g. `sig` for a func
     * signature). Falls back to `line` for legacy entries that
     * pre-date `blanks` enforcement. */
    const blankVar = data?.blanks?.[0] ?? "line";
    const correct = data.generator?.vars?.[blankVar]?.[0];
    if (!tmpl || correct === undefined) return null;
    /* Substitute only the blank var — other template vars are
     * substituted at exercise time, but for verification we need
     * the canonical form which is "first pool value" for every
     * var. The blank's first value is enough to make the rest of
     * the template (plain text + the var's substitution) runnable. */
    const re = new RegExp(`\\$\\{${blankVar}\\}`, "g");
    return { kind: "fill-line", code: tmpl.replace(re, correct) };
  }
  return null;
}

const exercises = [];
for await (const path of glob(join(root, "src/content/exercises/**/*.yaml"))) {
  if (filter !== null && !path.includes(filter)) continue;
  const raw = await readFile(path, "utf8");
  const data = parse(raw);
  const program = buildProgram(data);
  if (program) exercises.push({ path, data, program });
}

if (filter !== null) {
  console.log(`Filtered to "${filter}" — ${exercises.length} runnable exercise(s).\n`);
  if (exercises.length === 0) {
    console.log("No runnable exercises matched.");
    process.exit(0);
  }
}

let pass = 0;
let fail = 0;
const failures = [];
for (const { path, data, program } of exercises) {
  if (!program.code) {
    failures.push({ path, reason: "no canonical" });
    fail++;
    continue;
  }
  if (data.expectStdout === undefined) {
    failures.push({ path, reason: "no expectStdout" });
    fail++;
    continue;
  }
  const r = yaegiEval(program.code);
  const ok = r.error === "" && r.stdout === data.expectStdout;
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push({
      path,
      reason: `error=${JSON.stringify(r.error)} expected=${JSON.stringify(data.expectStdout)} got=${JSON.stringify(r.stdout)}`,
    });
  }
  const rel = relative(root, path);
  console.log(`  ${ok ? "✓" : "✗"}  [${program.kind}] ${rel}`);
}

console.log(`\n${pass}/${pass + fail} runnable canonicals produce their expectStdout under Yaegi.`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ${relative(root, f.path)}: ${f.reason}`);
  }
}
process.exit(fail === 0 ? 0 : 1);
