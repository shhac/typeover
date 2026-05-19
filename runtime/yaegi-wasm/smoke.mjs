/*
 * Sanity-check the built WASM in Node before wiring it to a browser
 * worker. Loads wasm_exec.js + yaegi.wasm, then calls yaegiEval against
 * a trivial Go snippet. Confirms:
 *   - the WASM instantiates without crashing
 *   - the yaegiEval binding is reachable
 *   - stdout from fmt.Println survives the os.Pipe redirection
 *
 * Run with: node smoke.mjs
 *
 * Lives outside the build path; not shipped to the browser.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(here, "..", "..", "public", "yaegi", "yaegi.wasm");
const execPath = join(here, "..", "..", "public", "yaegi", "wasm_exec.js");

// wasm_exec.js leans on global `crypto` and `performance` which Node 24
// exposes natively. The Go runtime also expects `globalThis.fs` (Node)
// or `node:fs` indirection; the bundled wasm_exec.js handles both.
const execSrc = await readFile(execPath, "utf8");
new Function(execSrc)();

const go = new globalThis.Go();
const wasmBytes = await readFile(wasmPath);
const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
void go.run(instance); // fire and forget — the runtime loop blocks on a channel

// Give the runtime a microtask to wire up yaegiEval.
await new Promise((r) => setTimeout(r, 50));

const cases = [
  {
    name: "fmt.Println happy path",
    code: `package main
import "fmt"
func main() { fmt.Println("hello from yaegi") }`,
  },
  {
    name: "fmt.Printf with format spec",
    code: `package main
import "fmt"
func main() { fmt.Printf("answer = %d\\n", 42) }`,
  },
  {
    name: "errors.New + fmt.Println error",
    code: `package main
import (
	"errors"
	"fmt"
)
func main() { fmt.Println(errors.New("boom")) }`,
  },
  {
    name: "syntax error → error field",
    code: `package main
import "fmt"
func main() { fmt.Println(`, // unterminated call
  },
  {
    name: "runtime panic → error field",
    code: `package main
func main() { var p *int; _ = *p }`,
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const r = globalThis.yaegiEval(c.code);
  console.log(`\n=== ${c.name} ===`);
  console.log("  stdout:", JSON.stringify(r.stdout));
  console.log("  stderr:", JSON.stringify(r.stderr));
  console.log("  error :", JSON.stringify(r.error));
  // Heuristic pass: cases without "error" in the name should have empty
  // error and non-empty stdout; the "→ error field" cases should have
  // a non-empty error.
  const wantsError = c.name.includes("→ error field");
  const ok = wantsError ? r.error !== "" : r.error === "" && r.stdout !== "";
  console.log("  =>", ok ? "PASS" : "FAIL");
  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass}/${pass + fail} cases pass`);
process.exit(fail === 0 ? 0 : 1);
