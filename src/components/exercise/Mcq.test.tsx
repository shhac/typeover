import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Mcq } from "./Mcq";
import type { GeneratorSpec } from "~/lib/generator";

/*
 * Component-level integration test for <Mcq>. Pins the phase
 * transitions documented in design-docs/12 (P1 — MCQ correctness):
 *
 *   picking → right       happy path
 *   picking → wrong       wrong submit, three buttons appear
 *   wrong   → revealed    explicit reveal records failure
 *   right   → picking     "Another" advances seed
 *
 * Uses the real progress module with the vitest.setup localStorage
 * shim — `byte-level` assertions against the storage blob mirror
 * progress.test.ts and prove the hooks wire through end-to-end.
 */

const STORAGE_KEY = "typeover:progress";
const EX_ID = "test/mcq";
const HINTS: readonly [string, string, string] = ["c1", "c2", "c3"];

/** Template generator with predictable substitutions: canonical
 *  always renders to "x := 1" given vars.x = ["1"]. */
const GEN: GeneratorSpec = {
  kind: "template",
  vars: { x: ["1"] },
  ts: "let y = ${x}",
  canonical: "x := ${x}",
  distractors: ["x = ${x}", "var x ${x}"],
};

const renderMcq = () =>
  render(() => (
    <Mcq
      exerciseId={EX_ID}
      prompt="Translate to idiomatic Go."
      generator={GEN}
      hints={HINTS}
    />
  ));

const readProgress = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as {
    exercises: Record<
      string,
      { instancesSeen: number; instancesPassed: number; instancesFailed: number; hintsUsedTotal: number }
    >;
  });
};

const slot = () => readProgress()?.exercises[EX_ID];

/** The canonical text after substitution. */
const CANONICAL_TEXT = "x := 1";

/** Find every radio whose <pre><code> label matches `text`. */
const findOptionByText = (container: HTMLElement, text: string): HTMLInputElement => {
  const labels = Array.from(container.querySelectorAll("label"));
  const match = labels.find((l) => l.textContent?.trim() === text);
  if (!match) throw new Error(`option not found: ${text}`);
  return match.querySelector("input[type=radio]") as HTMLInputElement;
};

const wrongOption = (container: HTMLElement): HTMLInputElement => {
  const labels = Array.from(container.querySelectorAll("label"));
  const match = labels.find((l) => {
    const t = l.textContent?.trim();
    return t !== undefined && t !== CANONICAL_TEXT;
  });
  if (!match) throw new Error("no wrong option found");
  return match.querySelector("input[type=radio]") as HTMLInputElement;
};

describe("<Mcq> — happy path", () => {
  it("select correct → submit → records passed once, shows Next/Another row", () => {
    const { container, getByText } = renderMcq();
    /* Initial seen-on-mount recorded by useExerciseInstance. */
    expect(slot()?.instancesSeen).toBe(1);
    expect(slot()?.instancesPassed).toBe(0);

    const correct = findOptionByText(container, CANONICAL_TEXT);
    fireEvent.click(correct);
    fireEvent.click(getByText("Submit"));

    expect(slot()?.instancesPassed).toBe(1);
    /* No failure recorded — the asymmetry from design-docs/12. */
    expect(slot()?.instancesFailed).toBe(0);
    /* Right-phase shell: "Try again with a different instance" appears. */
    expect(getByText("Try again with a different instance")).toBeTruthy();
  });

  it("Another after right resets phase and bumps instancesSeen", () => {
    const { container, getByText } = renderMcq();
    fireEvent.click(findOptionByText(container, CANONICAL_TEXT));
    fireEvent.click(getByText("Submit"));
    const seenBeforeAnother = slot()?.instancesSeen;
    fireEvent.click(getByText("Try again with a different instance"));
    /* Back to picking: Submit button visible. */
    expect(getByText("Submit")).toBeTruthy();
    /* useExerciseInstance's createEffect fires on seed change. */
    expect(slot()?.instancesSeen).toBe((seenBeforeAnother ?? 0) + 1);
  });
});

describe("<Mcq> — wrong path", () => {
  it("wrong submit shows three buttons and records NO failure (yet)", () => {
    const { container, getByText } = renderMcq();
    fireEvent.click(wrongOption(container));
    fireEvent.click(getByText("Submit"));
    expect(getByText("Try again")).toBeTruthy();
    expect(getByText("Different exercise")).toBeTruthy();
    expect(getByText("Reveal correct")).toBeTruthy();
    /* Failure is only counted via explicit reveal — wrong submit
     * alone does not penalise. */
    expect(slot()?.instancesFailed).toBe(0);
  });

  it("Try again clears submission without recording", () => {
    const { container, getByText, queryByText } = renderMcq();
    fireEvent.click(wrongOption(container));
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Try again"));
    expect(getByText("Submit")).toBeTruthy();
    expect(queryByText("Reveal correct")).toBeNull();
    expect(slot()?.instancesFailed).toBe(0);
    expect(slot()?.instancesPassed).toBe(0);
  });

  it("wrong then correct counts as passed, not failed (asymmetry pin)", () => {
    /* design-docs/12 P1 — pinned behaviour: a learner who recovers
     * via Try-again gets credit for the eventual pass and no penalty
     * for the wrong submit. Only Reveal records a failure. */
    const { container, getByText } = renderMcq();
    fireEvent.click(wrongOption(container));
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Try again"));
    fireEvent.click(findOptionByText(container, CANONICAL_TEXT));
    fireEvent.click(getByText("Submit"));
    expect(slot()?.instancesPassed).toBe(1);
    expect(slot()?.instancesFailed).toBe(0);
  });
});

describe("<Mcq> — reveal flow", () => {
  it("Reveal correct records exactly one failure and hides the Reveal button", () => {
    const { container, getByText, queryByText } = renderMcq();
    fireEvent.click(wrongOption(container));
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Reveal correct"));
    expect(slot()?.instancesFailed).toBe(1);
    expect(queryByText("Reveal correct")).toBeNull();
    /* Reveal does NOT count as a pass. */
    expect(slot()?.instancesPassed).toBe(0);
  });
});

describe("<Mcq> — hint usage", () => {
  it("each Hint click increments hintsUsedTotal on the exercise slot", () => {
    const { container } = renderMcq();
    /* Disambiguate Hint from the option radios — multiple <button>s
     * live in the shell footer; the Hint button's text is exactly
     * "Hint" pre-reveal. */
    const buttons = Array.from(container.querySelectorAll("button"));
    const hintBtn = buttons.find((b) => b.textContent === "Hint");
    if (!hintBtn) throw new Error("Hint button not found");
    fireEvent.click(hintBtn);
    expect(slot()?.hintsUsedTotal).toBe(1);
    fireEvent.click(hintBtn);
    fireEvent.click(hintBtn);
    expect(slot()?.hintsUsedTotal).toBe(3);
  });
});
