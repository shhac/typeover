import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { FillBlankLine } from "./FillBlankLine";
import type { GeneratorSpec } from "~/lib/generator";

/*
 * Component-level integration test for <FillBlankLine>. Pins the
 * tile-selection phase contract from design-docs/12 P1.
 *
 * Mirrors Mcq.test.tsx / FillBlankWord.test.tsx — real progress
 * chain through the vitest.setup localStorage shim; byte-level
 * assertions against the storage blob prove the hooks wire through.
 */

const STORAGE_KEY = "typeover:progress";
const EX_ID = "test/fill-line";
const HINTS: readonly [string, string, string] = ["c1", "c2", "c3"];

/** Template generator where the `line` var's pool *is* the tile set.
 *  With a single-element pool there's nothing to compare against —
 *  use a four-element pool so reshuffle / wrong-pick / candidate-
 *  determinism tests have meaningful candidates. */
const GEN: GeneratorSpec = {
  kind: "template",
  vars: {
    line: ["x := value", "x = value", "var x = value", "const x := value"],
  },
  ts: "// line above",
  canonical: "${line}",
};

const renderFBL = (generator: GeneratorSpec = GEN, blanks: string[] = ["line"]) =>
  render(() => (
    <FillBlankLine
      exerciseId={EX_ID}
      prompt="Pick the line."
      generator={generator}
      blanks={blanks}
      hints={HINTS}
    />
  ));

const readProgress = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null
    ? null
    : (JSON.parse(raw) as {
        exercises: Record<
          string,
          {
            instancesSeen: number;
            instancesPassed: number;
            instancesFailed: number;
            hintsUsedTotal: number;
          }
        >;
      });
};

const slot = () => readProgress()?.exercises[EX_ID];

/** Returns each radio tile button (CandidateTile renders as `<button role="radio">`). */
const tiles = (container: HTMLElement): HTMLButtonElement[] =>
  Array.from(container.querySelectorAll('button[role="radio"]'));

const tileTexts = (container: HTMLElement) =>
  tiles(container).map((t) => t.textContent?.trim() ?? "");

const CANONICAL_TEXT = "x := value";

describe("<FillBlankLine> — happy path", () => {
  it("pick canonical → submit → records passed; all tiles lock", () => {
    const { container, getByText } = renderFBL();
    expect(slot()?.instancesSeen).toBe(1);
    const correct = tiles(container).find((t) => t.textContent?.trim() === CANONICAL_TEXT);
    if (!correct) throw new Error("canonical tile not found");
    fireEvent.click(correct);
    fireEvent.click(getByText("Submit"));
    expect(slot()?.instancesPassed).toBe(1);
    expect(slot()?.instancesFailed).toBe(0);
    /* Right-phase locks every tile via the `locked` prop on
     * CandidateTile. */
    for (const t of tiles(container)) {
      expect(t.disabled).toBe(true);
    }
  });
});

describe("<FillBlankLine> — submit gate", () => {
  it("Submit is disabled until a tile is selected", () => {
    const { container, getByText } = renderFBL();
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(tiles(container)[0]!);
    expect(submit.disabled).toBe(false);
  });
});

describe("<FillBlankLine> — wrong path (learner-controls-reveal)", () => {
  it("wrong submit shows three buttons; canonical does NOT auto-light", () => {
    const { container, getByText } = renderFBL();
    const wrong = tiles(container).find((t) => t.textContent?.trim() !== CANONICAL_TEXT);
    if (!wrong) throw new Error("no wrong tile");
    fireEvent.click(wrong);
    fireEvent.click(getByText("Submit"));
    expect(getByText("Try again")).toBeTruthy();
    expect(getByText("Different exercise")).toBeTruthy();
    expect(getByText("Reveal correct")).toBeTruthy();
    /* Pin design-docs/06: the canonical tile is NOT auto-revealed on
     * wrong submit. Picked-wrong tile gets the error styling, but the
     * canonical tile stays neutral until explicit reveal. The class
     * lookup is the truth; check that the canonical-text tile does
     * not carry the success-class signature. */
    const correctTile = tiles(container).find((t) => t.textContent?.trim() === CANONICAL_TEXT);
    expect(correctTile?.className).not.toMatch(/border-success/);
    expect(slot()?.instancesFailed).toBe(0);
  });

  it("Try again resets selection without recording failure", () => {
    const { container, getByText } = renderFBL();
    const wrong = tiles(container).find((t) => t.textContent?.trim() !== CANONICAL_TEXT)!;
    fireEvent.click(wrong);
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Try again"));
    /* Back to picking; Submit visible + disabled (selection cleared). */
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(slot()?.instancesFailed).toBe(0);
    expect(slot()?.instancesPassed).toBe(0);
  });
});

describe("<FillBlankLine> — reveal flow", () => {
  it("Reveal correct records exactly one failure; canonical tile lights via correctRevealed", () => {
    const { container, getByText, queryByText } = renderFBL();
    const wrong = tiles(container).find((t) => t.textContent?.trim() !== CANONICAL_TEXT)!;
    fireEvent.click(wrong);
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Reveal correct"));
    expect(slot()?.instancesFailed).toBe(1);
    expect(queryByText("Reveal correct")).toBeNull();
    /* The canonical tile is now lit (border-success class from
     * correctRevealed state). */
    const correctTile = tiles(container).find((t) => t.textContent?.trim() === CANONICAL_TEXT);
    expect(correctTile?.className).toMatch(/border-success/);
    /* Reveal does NOT count as a pass. */
    expect(slot()?.instancesPassed).toBe(0);
  });
});

describe("<FillBlankLine> — candidate-pool determinism", () => {
  it("same exercise + attempt produces the same tile order across renders", () => {
    /* Per design-docs/12: the `::tiles` seed namespace keeps tile
     * shuffle RNG independent of variant-pick RNG, and same-seed
     * yields same order. Render twice with the same exerciseId =>
     * same `seed()` for attempt 0 => same order. */
    const first = renderFBL();
    const second = renderFBL();
    expect(tileTexts(first.container)).toEqual(tileTexts(second.container));
  });
});

/* `(no candidates — authoring issue)` fallback test omitted: the
 * scenarios that would reach it — variant generator on fill-line,
 * empty vars pool, undeclared blank — are all rejected at content-
 * schema time by #38's refinements before they can hit a render. The
 * fallback exists as defence-in-depth but isn't reachable via a
 * normal render path. */
