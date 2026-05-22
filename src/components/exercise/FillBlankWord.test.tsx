import { fireEvent, render } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it } from "vitest";
import { FillBlankWord, nextEmptySlot } from "./FillBlankWord";
import type { GeneratorSpec } from "~/lib/generator-schema";

/*
 * Component-level integration test for <FillBlankWord>. Pins the
 * phase-transition + submit-gate contract from design-docs/12 (P1).
 *
 * Uses the real progress chain via the vitest.setup localStorage shim;
 * mirrors Mcq.test.tsx's structure so any future shared lifecycle
 * helper (extracted from the three exercise components) has a paired
 * regression surface.
 */

import { HINTS, makeProgressReader } from "./__test__/progress-helpers";

const EX_ID = "test/fill-word";
const { slot } = makeProgressReader(EX_ID);

/** Two-blank template. With vars: { a: ["1"], b: ["2"] } and
 *  blanks: ["a", "b"], the canonical renders to:
 *    text:"x := " | blank:"a" expected:"1" | text:" + " | blank:"b" expected:"2"
 */
const TWO_BLANK_GEN: GeneratorSpec = {
  kind: "template",
  vars: { a: ["1"], b: ["2"] },
  ts: "let x = ${a} + ${b}",
  canonical: "x := ${a} + ${b}",
};

/** Same var twice — `${x} + ${x}`. Two independent input slots. */
const SAME_VAR_GEN: GeneratorSpec = {
  kind: "template",
  vars: { x: ["v"] },
  ts: "echo ${x} ${x}",
  canonical: "${x} + ${x}",
};

const renderFBW = (generator: GeneratorSpec = TWO_BLANK_GEN, blanks: string[] = ["a", "b"]) =>
  render(() => (
    <FillBlankWord
      exerciseId={EX_ID}
      prompt="Fill the blanks."
      generator={generator}
      blanks={blanks}
      hints={HINTS}
    />
  ));

const inputs = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(container.querySelectorAll('input[type="text"]'));

const setVal = (el: HTMLInputElement, value: string) => fireEvent.input(el, { target: { value } });

describe("<FillBlankWord> — happy path", () => {
  it("fill correct → submit → records passed once, inputs lock", () => {
    const { container, getByText } = renderFBW();
    expect(slot()?.instancesSeen).toBe(1);
    const [a, b] = inputs(container);
    setVal(a!, "1");
    setVal(b!, "2");
    fireEvent.click(getByText("Submit"));
    expect(slot()?.instancesPassed).toBe(1);
    expect(slot()?.instancesFailed).toBe(0);
    /* `locked` flips disabled on every blank input in the right phase. */
    expect(a!.disabled).toBe(true);
    expect(b!.disabled).toBe(true);
  });
});

describe("<FillBlankWord> — submit gate (allFilled)", () => {
  it("submit is disabled until every blank is filled", () => {
    const { container, getByText } = renderFBW();
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const [a, b] = inputs(container);
    setVal(a!, "1");
    expect(submit.disabled).toBe(true);
    setVal(b!, "2");
    expect(submit.disabled).toBe(false);
  });
});

describe("<FillBlankWord> — wrong path", () => {
  it("wrong submit shows the four-button row including Clear", () => {
    const { container, getByText } = renderFBW();
    const [a, b] = inputs(container);
    setVal(a!, "1");
    setVal(b!, "wrong");
    fireEvent.click(getByText("Submit"));
    expect(getByText("Try again")).toBeTruthy();
    expect(getByText("Reshuffle this exercise")).toBeTruthy();
    expect(getByText("Reveal answer (counts as fail)")).toBeTruthy();
    /* Clear shows in both picking and wrong phases when there's
     * any input — the extraWrongActions slot mounts it here. */
    expect(getByText("Clear")).toBeTruthy();
    expect(slot()?.instancesFailed).toBe(0);
  });

  it("Try again preserves partial inputs (iterate, don't restart)", () => {
    const { container, getByText } = renderFBW();
    const [a, b] = inputs(container);
    setVal(a!, "1");
    setVal(b!, "wrong");
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Try again"));
    /* design-docs/06: tryAgain keeps inputs; Clear is the explicit reset. */
    expect(a!.value).toBe("1");
    expect(b!.value).toBe("wrong");
    expect(slot()?.instancesFailed).toBe(0);
    expect(slot()?.instancesPassed).toBe(0);
  });

  it("Clear empties every input and returns to the picking phase", () => {
    const { container, getByText, queryByText } = renderFBW();
    const [a, b] = inputs(container);
    setVal(a!, "1");
    setVal(b!, "wrong");
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Clear"));
    expect(a!.value).toBe("");
    expect(b!.value).toBe("");
    /* Back to picking — wrong-phase actions gone. */
    expect(queryByText("Reveal answer (counts as fail)")).toBeNull();
    expect(getByText("Submit")).toBeTruthy();
  });
});

describe("<FillBlankWord> — reveal flow", () => {
  it("Reveal correct records exactly one failure and hides the Reveal button", () => {
    const { container, getByText, queryByText } = renderFBW();
    const [a, b] = inputs(container);
    setVal(a!, "1");
    setVal(b!, "wrong");
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Reveal answer (counts as fail)"));
    expect(slot()?.instancesFailed).toBe(1);
    expect(queryByText("Reveal answer (counts as fail)")).toBeNull();
    expect(slot()?.instancesPassed).toBe(0);
  });
});

describe("<FillBlankWord> — same var twice", () => {
  it("each occurrence is an independent slot; both must match to pass", () => {
    /* Per design-docs/12 P1: canonical `${x} + ${x}` with blanks: ["x"]
     * yields two inputs. Filling one is not enough to enable Submit;
     * filling both with "v" passes. */
    const { container, getByText } = renderFBW(SAME_VAR_GEN, ["x"]);
    const [first, second] = inputs(container);
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    setVal(first!, "v");
    expect(submit.disabled).toBe(true);
    setVal(second!, "v");
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(slot()?.instancesPassed).toBe(1);
  });
});

describe("<FillBlankWord> — Enter behaviour (focus-next or submit)", () => {
  it("Enter on a filled blank with another blank empty jumps focus to that empty blank", () => {
    const { container } = renderFBW();
    const [a, b] = inputs(container);
    setVal(a!, "1");
    a!.focus();
    expect(document.activeElement).toBe(a);
    fireEvent.keyDown(a!, { key: "Enter" });
    expect(document.activeElement).toBe(b);
  });

  it("Enter when all blanks are filled triggers Submit", () => {
    const { container } = renderFBW();
    const [a, b] = inputs(container);
    setVal(a!, "1");
    setVal(b!, "2");
    b!.focus();
    fireEvent.keyDown(b!, { key: "Enter" });
    expect(slot()?.instancesPassed).toBe(1);
  });

  it("Enter wraps backwards — focus jumps to an earlier empty blank when later are filled", () => {
    const { container } = renderFBW();
    const [a, b] = inputs(container);
    setVal(b!, "2");
    /* `a` is still empty. Enter from `b` should wrap to `a`. */
    b!.focus();
    fireEvent.keyDown(b!, { key: "Enter" });
    expect(document.activeElement).toBe(a);
  });
});

describe("<FillBlankWord> — vacuous-truth guard (blanks: [])", () => {
  it("a blanks-less exercise renders no inputs and Submit stays disabled", () => {
    /* Iter-4 fix pinned: allFilled returns false when there are zero
     * blank positions. Without the guard, "every blank is filled" was
     * vacuously true and Submit auto-passed. (#38 now rejects this at
     * schema time for fill-* types, but the runtime guard is still
     * load-bearing as a defence-in-depth pin.) */
    const { container, getByText } = renderFBW(TWO_BLANK_GEN, []);
    expect(inputs(container)).toHaveLength(0);
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

describe("nextEmptySlot", () => {
  const filled = new Set<number>();
  const hasValue = (slot: number) => filled.has(slot);

  beforeEach(() => filled.clear());

  it("returns the slot after `from` when it's empty", () => {
    filled.add(1);
    expect(nextEmptySlot([1, 2, 3], 1, hasValue)).toBe(2);
  });

  it("wraps past the end to find an earlier empty slot", () => {
    filled.add(2);
    filled.add(3);
    /* from=3 (last); only 1 is empty. Wrap to find it. */
    expect(nextEmptySlot([1, 2, 3], 3, hasValue)).toBe(1);
  });

  it("returns null when every slot is filled", () => {
    filled.add(1);
    filled.add(2);
    filled.add(3);
    expect(nextEmptySlot([1, 2, 3], 1, hasValue)).toBeNull();
  });

  it("returns the only empty slot when called from itself with others filled", () => {
    filled.add(1);
    filled.add(3);
    /* from=1 (filled), iterate: 2 (empty) → return 2. */
    expect(nextEmptySlot([1, 2, 3], 1, hasValue)).toBe(2);
  });

  it("handles `from` not present in the ordered list (indexOf -1)", () => {
    /* currentRank = -1, iteration starts at orderedSlots[0]. */
    expect(nextEmptySlot([10, 20], 999, hasValue)).toBe(10);
  });
});
