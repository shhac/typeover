import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Smoke test for `pnpm content:report`. Doesn't try to assert
 * specific exercise counts (which will change every authoring
 * cycle); pins the OUTPUT SHAPE so a future refactor that breaks
 * the report's structure (missing summary, broken per-module
 * grouping) fails the suite.
 *
 * Runs the real script in a child process via node — same path
 * `pnpm content:report` would take.
 */

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(here, "content-report.ts");
const repoRoot = join(here, "..");

function runReport(): string {
  return execFileSync("node", [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("content-report script", () => {
  it("emits the title + summary sections", () => {
    const out = runReport();
    expect(out).toMatch(/^# content report/m);
    expect(out).toMatch(/^## Summary/m);
  });

  it("renders one per-module section per Module YAML", () => {
    const out = runReport();
    /* Every module in src/content/modules/ should appear as its
     * own `## <Title> (\`<id>\`)` heading. Test against the seven
     * known module IDs to catch a missing or duplicate render. */
    for (const moduleId of [
      "go/foundations",
      "go/collections",
      "go/types",
      "go/interfaces",
      "go/errors",
      "go/concurrency",
      "go/idioms",
    ]) {
      expect(out, `missing module section: ${moduleId}`).toMatch(
        new RegExp(`\\(\`${moduleId}\`\\)`),
      );
    }
  });

  it("surfaces theme status with ✓ / · / ○ markers", () => {
    const out = runReport();
    /* All three labels should appear at the current state of the
     * content tree — Modules 1+2 give us `complete`, the stub
     * modules give us `empty`. `WIP` may or may not appear
     * depending on authoring state, so don't gate on it. */
    expect(out).toMatch(/complete/);
    expect(out).toMatch(/empty/);
  });

  it("emits the launch-progress percentage line", () => {
    const out = runReport();
    expect(out).toMatch(/Launch progress \(themes with any content\): \d+\/\d+ = \d+%/);
  });
});
