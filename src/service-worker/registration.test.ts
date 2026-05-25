import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * SW registration is a 6-line inline script in BaseLayout.astro —
 * the simplest "is the SW even being registered?" coverage is a
 * content assertion against the layout itself.
 *
 * What this catches:
 *   - someone deletes the registration block during a layout
 *     refactor → cache layer silently goes dormant, every Rust
 *     compile pays the L2 cost forever.
 *   - someone changes the script path or scope, breaking the
 *     registration silently (the browser swallows registration
 *     errors per the .catch).
 *
 * What it doesn't catch:
 *   - logic bugs inside the registration timing (load vs. ready).
 *     A Playwright integration test is the right tool for that;
 *     this file is the cheap layer.
 */

/* vitest runs with cwd at the project root; resolve relative to
 * that rather than `import.meta.url` because the test runner's
 * module URL is not a file:// scheme in all sandbox modes. */
const baseLayoutPath = resolve("src/layouts/BaseLayout.astro");
const layoutSource = readFileSync(baseLayoutPath, "utf8");

describe("BaseLayout SW registration", () => {
  it("registers /sw-compile-cache.js with origin-root scope", () => {
    /* The literal that ships. Whitespace-insensitive substring
     * checks below would let a typo slip through; we want the
     * exact `register("…", { scope: "…" })` call. */
    expect(layoutSource).toMatch(
      /navigator\.serviceWorker\s*\.\s*register\(\s*["']\/sw-compile-cache\.js["']\s*,\s*\{\s*scope:\s*["']\/["']\s*\}\s*\)/,
    );
  });

  it("feature-detects serviceWorker before calling register", () => {
    /* Without the guard, evaluating navigator.serviceWorker on
     * legacy browsers (or anywhere `navigator` lacks the property)
     * throws and breaks the whole inline script — including any
     * unrelated code that follows. */
    expect(layoutSource).toContain('"serviceWorker" in navigator');
  });

  it("defers registration to after window load to avoid first-paint contention", () => {
    /* Registering on parse blocks first paint on slow connections;
     * the load-event handler runs after the page is interactive.
     * Both the `readyState === "complete"` fast-path and the
     * `addEventListener("load", …)` deferred path must be present
     * so the deferral works whether or not the page is already
     * fully loaded by the time the script runs. */
    expect(layoutSource).toMatch(/document\.readyState\s*===\s*["']complete["']/);
    expect(layoutSource).toMatch(/addEventListener\(\s*["']load["']/);
  });

  it("swallows registration failures so SW errors don't break the page", () => {
    /* `.catch(...)` after `.register(...)` — the SW is best-
     * effort. A registration error must not bubble up and trip
     * downstream code in the same inline script. */
    expect(layoutSource).toMatch(/\.register\([^)]+\)\s*\.catch\(/);
  });
});
