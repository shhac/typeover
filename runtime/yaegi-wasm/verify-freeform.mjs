/*
 * Verify every freeform exercise's canonical produces its expectStdout
 * under Yaegi. Walks src/content/exercises/**\/*.yaml, picks the
 * freeform ones, runs each canonical, asserts stdout matches.
 *
 * Useful as a pre-commit / pre-deploy check — catches authoring errors
 * before they hit a learner. Not part of CI yet; run manually via:
 *   pnpm runtime:verify-freeform
 */
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const wasmPath = join(root, "public", "yaegi", "yaegi.wasm");
const execPath = join(root, "public", "yaegi", "wasm_exec.js");

const execSrc = await readFile(execPath, "utf8");
new Function(execSrc)();

const go = new globalThis.Go();
const wasmBytes = await readFile(wasmPath);
const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
void go.run(instance);
await new Promise((r) => setTimeout(r, 50));

const exercises = [];
for await (const path of glob(join(root, "src/content/exercises/**/*.yaml"))) {
  const raw = await readFile(path, "utf8");
  const data = parse(raw);
  if (data?.type === "freeform") {
    exercises.push({ path, data });
  }
}

let pass = 0;
let fail = 0;
const failures = [];
for (const { path, data } of exercises) {
  const code = data.generator?.canonical;
  const expected = data.expectStdout;
  if (!code) {
    failures.push({ path, reason: "no canonical" });
    fail++;
    continue;
  }
  if (expected === undefined) {
    failures.push({ path, reason: "no expectStdout" });
    fail++;
    continue;
  }
  const r = globalThis.yaegiEval(code);
  const ok = r.error === "" && r.stdout === expected;
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push({
      path,
      reason: `error=${JSON.stringify(r.error)} expected=${JSON.stringify(expected)} got=${JSON.stringify(r.stdout)}`,
    });
  }
  const rel = relative(root, path);
  console.log(`  ${ok ? "✓" : "✗"}  ${rel}`);
}

console.log(`\n${pass}/${pass + fail} freeform canonicals produce their expectStdout under Yaegi.`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ${relative(root, f.path)}: ${f.reason}`);
  }
}
process.exit(fail === 0 ? 0 : 1);
