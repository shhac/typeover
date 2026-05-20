#!/usr/bin/env node
/*
 * pnpm content:new theme <module>/<theme-id>
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
 *   pnpm content:new theme collections/slices
 *   pnpm content:new theme collections/slices --title="Slices and arrays" --order=1
 *   pnpm content:new theme collections/slices --yes  (skip prompts; use defaults)
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

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  exit(1);
};

/* ───────── argv parsing ───────── */

function parseArgs(av) {
  // av: ["content:new", "theme", "<module>/<id>", "--flag=value", ...]
  // Also tolerate the entry-point form: "node content-new-theme.mjs theme <module>/<id>"
  const remaining = [...av];
  // drop leading "theme" subcommand if present
  if (remaining[0] === "theme") remaining.shift();
  const slug = remaining.find((a) => !a.startsWith("--"));
  const flags = Object.fromEntries(
    remaining
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const eq = a.indexOf("=");
        return eq === -1 ? [a.slice(2), true] : [a.slice(2, eq), a.slice(eq + 1)];
      }),
  );
  return { slug, flags };
}

const { slug, flags } = parseArgs(argv.slice(2));
if (!slug || !slug.includes("/")) {
  fail(
    `Usage: pnpm content:new theme <module>/<theme-id>\n` +
      `e.g.   pnpm content:new theme collections/slices`,
  );
}
const [moduleId, themeId] = slug.split("/", 2);
const themeSlug = `${moduleId}/${themeId}`;

/* ───────── existence checks ───────── */

const modulePath = join(contentRoot, "modules", `${moduleId}.yaml`);
if (!existsSync(modulePath)) {
  const modules = (await readdir(join(contentRoot, "modules")))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
  fail(`Module "${moduleId}" doesn't exist.\n` + `  Known modules: ${modules.join(", ")}`);
}

const themeYamlPath = join(contentRoot, "themes", moduleId, `${themeId}.yaml`);
const exercisesDir = join(contentRoot, "exercises", moduleId, themeId);
const themeExists = existsSync(themeYamlPath);
const exercisesExist = existsSync(exercisesDir);

if (exercisesExist) {
  /* Even an empty exercises directory blocks us — there's nothing
   * to overwrite, but the intent ("stamp fresh stubs into a clean
   * slot") doesn't apply. Operator can rm the directory and retry. */
  fail(`Exercises directory already exists: ${exercisesDir}\n  Refusing to overwrite.`);
}

/* Two valid starting states: (1) genuinely new theme — neither
 * theme.yaml nor exercises dir exist; we stamp both. (2) pre-launch
 * stub — theme.yaml already exists (Modules 2-7 all ship with stub
 * theme.yamls per design-docs/10) but exercises don't; we stamp
 * only the exercises and reuse the existing theme metadata. */
const stampingTheme = !themeExists;

/* ───────── compute defaults ───────── */

// Highest existing order within this module — new theme defaults to N+1.
async function nextOrder() {
  const themesDir = join(contentRoot, "themes", moduleId);
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

const defaultTitle = themeId
  .split("-")
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(" ");
const defaultOrder = await nextOrder();

/* ───────── interactive prompts (or --yes) ───────── */

let title, order, intro, prerequisites;
if (stampingTheme) {
  if (flags.yes) {
    title = flags.title || defaultTitle;
    order = Number(flags.order ?? defaultOrder);
    intro = flags.intro || `TODO: one-paragraph intro for ${themeSlug}.`;
    prerequisites = flags.prereqs ? flags.prereqs.split(",").map((s) => s.trim()) : [];
  } else {
    const rl = createInterface({ input: stdin, output: stdout });
    const ask = async (q, def) => {
      const a = (await rl.question(`${q}${def ? ` [${def}]` : ""}: `)).trim();
      return a || def || "";
    };
    console.log(`\nNew theme: ${themeSlug}\n`);
    title = flags.title || (await ask("title", defaultTitle));
    order = Number(flags.order ?? (await ask("order", String(defaultOrder))));
    intro = await ask("intro (one paragraph)", `TODO: one-paragraph intro for ${themeSlug}.`);
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
} else {
  /* Stub-theme path: theme.yaml already exists, we're just adding
   * exercises. No prompts needed; theme metadata is already
   * authored. The 9 exercise stubs reference the existing
   * theme.yaml via themeSlug. */
  console.log(`Theme metadata already exists at ${themeYamlPath}.`);
  console.log(`Stamping exercise stubs into the existing theme.\n`);
}

/* ───────── theme YAML ───────── */

const themeYaml = stampingTheme
  ? `target: go
moduleId: ${moduleId}
title: ${yamlStr(title)}
order: ${order}
prerequisites: ${prerequisites.length === 0 ? "[]" : `[${prerequisites.map(yamlStr).join(", ")}]`}
intro: |
${intro
  .split("\n")
  .map((l) => `  ${l}`)
  .join("\n")}
`
  : null;

/* ───────── exercise stubs ───────── */

/** YAML-safe string. Single-line, double-quoted when needed. */
function yamlStr(s) {
  if (/^[a-zA-Z0-9 _\-./]+$/.test(s)) return s;
  return JSON.stringify(s);
}

// MCQ stub (slots 1-3). Template generator with one var pool, three
// distractors. References to ${name} keep the schema's placeholder-
// declared refinement happy and remind the author of the shape.
function mcqStub(slot) {
  return `target: go
themeId: ${themeSlug}
type: mcq
order: ${slot}
prompt: |
  TODO: recognition prompt. What pattern does this exercise
  introduce? Frame it as a TS → Go translation choice.
generator:
  kind: template
  vars:
    name: [TODO_value]
  ts: |-
    TODO: TS snippet with \${name}.
  canonical: |-
    TODO: Go canonical with \${name}.
  distractors:
    - "TODO: wrong-shape #1 with \${name}"
    - "TODO: wrong-shape #2 with \${name}"
    - "TODO: wrong-shape #3 with \${name}"
hints:
  - "TODO layer 1 — observational hint."
  - "TODO layer 2 — pointed hint."
  - "TODO layer 3 — the answer."
runtime: none
notes: |
  Stub generated by \`pnpm content:new theme ${themeSlug}\`.
  Replace TODO markers; keep the slot 1-3 MCQ shape (recognition
  before production). See design-docs/02 for the pedagogy contract.
`;
}

// fill-word stub (slots 4-5). Template generator with one declared
// blank var + a contextual name var.
function fillWordStub(slot) {
  return `target: go
themeId: ${themeSlug}
type: fill-word
order: ${slot}
prompt: |
  TODO: production prompt. Which word(s) complete the Go form?
generator:
  kind: template
  vars:
    name: [TODO_name]
    blank_var: [TODO_value]
  ts: |-
    TODO: TS source with \${name}.
  canonical: |-
    TODO: Go canonical with \${name} \${blank_var}
blanks: [blank_var]
hints:
  - "TODO layer 1 — observational hint."
  - "TODO layer 2 — pointed hint."
  - "TODO layer 3 — the answer."
runtime: none
notes: |
  Stub generated by \`pnpm content:new theme ${themeSlug}\`.
  See design-docs/02 — fill-word drills mechanics of syntax.
`;
}

// fill-line stub (slots 6-7). Requires runtime: yaegi + expectStdout.
// Stamps a trivial valid-Go scaffold that compiles cleanly so
// runtime:verify passes; the canonical line is "fmt.Println()" which
// prints an empty newline. expectStdout matches that empty newline.
function fillLineStub(slot) {
  return `target: go
themeId: ${themeSlug}
type: fill-line
order: ${slot}
prompt: |
  TODO: production prompt. Type the Go line that completes the
  scaffold to produce the expected output.
generator:
  kind: template
  vars:
    line:
      - 'fmt.Print("")'
  ts: |-
    TODO: TS snippet.
  canonical: |-
    package main

    import "fmt"

    func main() {
    \t\${line}
    }
  distractors:
    - "TODO: wrong-shape #1"
    - "TODO: wrong-shape #2"
expectStdout: |2

runtime: yaegi
blanks: [line]
hints:
  - "TODO layer 1 — observational hint."
  - "TODO layer 2 — pointed hint."
  - "TODO layer 3 — the answer."
notes: |
  Stub generated by \`pnpm content:new theme ${themeSlug}\`. The
  canonical placeholder is \`fmt.Println()\` which prints a blank
  line — replace with the real exercise content, including a
  meaningful expectStdout. \`pnpm runtime:verify\` passes on the
  stub as-is.
`;
}

// freeform stub (slots 8-9). Trivial empty main + empty expectStdout.
function freeformStub(slot) {
  return `target: go
themeId: ${themeSlug}
type: freeform
order: ${slot}
prompt: |
  TODO: open prompt. What program should the learner produce?
generator:
  kind: template
  vars: {}
  ts: |-
    TODO: TS source the learner is translating.
  canonical: |-
    package main

    func main() {}
expectStdout: |2

runtime: yaegi
hints:
  - "TODO layer 1 — observational hint."
  - "TODO layer 2 — pointed hint."
  - "TODO layer 3 — the answer (canonical Go program)."
notes: |
  Stub generated by \`pnpm content:new theme ${themeSlug}\`. The
  canonical is a no-op program that produces empty stdout — replace
  with the real exercise content, including a meaningful canonical
  and expectStdout. \`pnpm runtime:verify\` passes on the stub.
`;
}

const SLOT_BUILDERS = [
  mcqStub,
  mcqStub,
  mcqStub,
  fillWordStub,
  fillWordStub,
  fillLineStub,
  fillLineStub,
  freeformStub,
  freeformStub,
];

/* ───────── write everything ───────── */

if (stampingTheme) {
  await mkdir(dirname(themeYamlPath), { recursive: true });
  await writeFile(themeYamlPath, themeYaml);
}

await mkdir(exercisesDir, { recursive: true });
for (let i = 0; i < SLOT_BUILDERS.length; i++) {
  const slot = i + 1;
  const file = join(exercisesDir, `${String(slot).padStart(2, "0")}.yaml`);
  await writeFile(file, SLOT_BUILDERS[i](slot));
}

/* ───────── report ───────── */

const rel = (p) => p.replace(repoRoot + "/", "");
console.log(`✓ stamped ${themeSlug}`);
if (stampingTheme) {
  console.log(`  theme:     ${rel(themeYamlPath)}`);
}
console.log(`  exercises: ${rel(exercisesDir)}/{01..09}.yaml`);
console.log(`\nNext:`);
console.log(`  pnpm content:lint       # confirms graph integrity`);
console.log(`  pnpm runtime:verify     # confirms canonicals run`);
console.log(`  pnpm build              # confirms schema passes`);
console.log(`  grep -r 'TODO' ${rel(exercisesDir)}  # find what to write`);
