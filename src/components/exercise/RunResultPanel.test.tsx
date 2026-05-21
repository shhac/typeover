import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { RunResultPanel } from "./RunResultPanel";
import type { RunResult } from "~/lib/use-runtime-run";

/*
 * Pins the a11y contract added in the lighter variant of
 * design-docs/24 P4: the panel is a labelled `region` landmark
 * with tabindex="-1" so consumers can move focus to it after a
 * Yaegi Run completes. Without this, sighted keyboard users stay
 * stranded on the Run button and SR users have no landmark to
 * navigate to.
 *
 * The auto-focus behaviour itself is owned by the consumers
 * (Freeform / FillBlankLineInput) — they use createEffect to
 * focus the ref on a fresh result. Tests for that integration
 * live alongside those components.
 */

const baseResult: RunResult = {
  stdout: "hello\n",
  stderr: "",
  error: "",
  durationMs: 12.3,
};

describe("<RunResultPanel> — a11y contract", () => {
  it("renders as a region landmark with an accessible name", () => {
    const { container } = render(() => (
      <RunResultPanel result={baseResult} expectStdout="hello\n" />
    ));
    const region = container.querySelector('[role="region"]');
    if (!region) throw new Error("region landmark missing");
    expect(region.getAttribute("aria-label")).toBe("Run result");
  });

  it("is programmatically focusable but not in the tab order", () => {
    const { container } = render(() => (
      <RunResultPanel result={baseResult} expectStdout="hello\n" />
    ));
    const region = container.querySelector('[role="region"]') as HTMLElement | null;
    if (!region) throw new Error("region landmark missing");
    expect(region.getAttribute("tabindex")).toBe("-1");
    region.focus();
    expect(document.activeElement).toBe(region);
  });

  it("forwards the ref so consumers can move focus on result-mount", () => {
    let captured: HTMLDivElement | undefined;
    render(() => (
      <RunResultPanel
        result={baseResult}
        expectStdout="hello\n"
        ref={(el) => {
          captured = el;
        }}
      />
    ));
    if (!captured) throw new Error("ref was not invoked");
    expect(captured.getAttribute("role")).toBe("region");
  });
});
