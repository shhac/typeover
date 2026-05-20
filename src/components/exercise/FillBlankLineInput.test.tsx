import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratorSpec } from "~/lib/generator";

/*
 * Component-level integration test for <FillBlankLineInput>. Pins
 * the contract documented in design-docs/12 (P1 — FillBlankLine
 * correctness, input + Yaegi grading branch):
 *
 *   - happy path: type canonical line → Run → stdout match → Submit
 *     records pass once → input locks in the right phase.
 *   - wrong path: stdout mismatch → wrong-phase actions surface,
 *     no pass and no fail recorded (asymmetry pinned by phase hook).
 *   - reveal: explicit reveal records failure exactly once.
 *   - canSubmit gate: empty input + running flag both keep Submit
 *     disabled.
 *   - Enter-to-Run: triggers run() only when input is non-empty.
 *   - another(): clears input AND runResult.
 *
 * Mocks `~/runtime` so eval is controllable — same pattern as
 * use-yaegi-run.test.ts. Real progress chain via the vitest.setup
 * localStorage shim.
 */

const { evalMock, terminateMock } = vi.hoisted(() => ({
  evalMock: vi.fn(),
  terminateMock: vi.fn(),
}));

vi.mock("~/runtime", () => ({
  getRunner: () => ({ eval: evalMock, ready: () => Promise.resolve() }),
  terminateRunner: terminateMock,
}));

import { FillBlankLineInput } from "./FillBlankLineInput";

const STORAGE_KEY = "typeover:progress";
const EX_ID = "test/fill-line";
const HINTS: readonly [string, string, string] = ["c1", "c2", "c3"];

/** Single-blank template. With vars: { line: ["doubled := count * 2"] }
 *  and blanks: ["line"], the canonical's blank-segment expected
 *  string is "doubled := count * 2". */
const GEN: GeneratorSpec = {
  kind: "template",
  vars: { line: ["doubled := count * 2"] },
  ts: "const doubled = count * 2",
  canonical: "func main() {\n  count := 5\n  ${line}\n  fmt.Println(doubled)\n}",
};

const EXPECTED_STDOUT = "10\n";

beforeEach(() => {
  evalMock.mockReset();
  terminateMock.mockReset();
});
afterEach(() => {
  localStorage.clear();
});

const renderFBL = () =>
  render(() => (
    <FillBlankLineInput
      exerciseId={EX_ID}
      prompt="Type the missing line."
      generator={GEN}
      blanks={["line"]}
      hints={HINTS}
      expectStdout={EXPECTED_STDOUT}
      runtime="yaegi"
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

const lineInput = (container: HTMLElement): HTMLInputElement => {
  const el = container.querySelector('input[type="text"]');
  if (!el) throw new Error("blank input not found");
  return el as HTMLInputElement;
};

const setVal = (el: HTMLInputElement, value: string) => fireEvent.input(el, { target: { value } });

describe("<FillBlankLineInput> — submit gate", () => {
  it("Submit is disabled until a run has completed", () => {
    const { container, getByText } = renderFBL();
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    /* Even with input filled, canSubmit is false until runResult lands. */
    setVal(lineInput(container), "doubled := count * 2");
    expect(submit.disabled).toBe(true);
  });

  it("Run button is disabled until input is non-empty", async () => {
    const { container } = renderFBL();
    /* Flush microtasks so the onMount → preflight → ready() resolution
     * settles; otherwise the disabled state still reflects the
     * "booting" gate from design-docs/16 F-4. */
    await Promise.resolve();
    await Promise.resolve();
    /* The toolbar Run carries the disabled-state contract; the
     * MobileKeyBar Run shortcut is unconditional (it fires when
     * tapped if input is non-empty, but no disabled attribute).
     * Target the toolbar one by excluding anything inside the
     * mobile bar's toolbar role. */
    const runBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Run" && !b.closest('[role="toolbar"]'),
    ) as HTMLButtonElement;
    expect(runBtn).toBeTruthy();
    expect(runBtn.disabled).toBe(true);
    setVal(lineInput(container), "x");
    expect(runBtn.disabled).toBe(false);
  });
});

describe("<FillBlankLineInput> — stale-runResult invalidation", () => {
  it("editing the input after a successful Run clears runResult and disables Submit", async () => {
    /* design-docs/19 F-3 pin: a learner who Runs valid code,
     * then edits the input to garbage, must NOT be able to
     * Submit the previous Run's grade against the new input.
     * Clearing runResult on edit drops canSubmit back to false. */
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText, getByText } = renderFBL();
    const input = lineInput(container);
    setVal(input, "doubled := count * 2");
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    /* Edit to garbage — Submit must lock again. */
    setVal(input, "asdf");
    expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("<FillBlankLineInput> — happy path", () => {
  it("type → Run → stdout match → Submit records pass once + locks input", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText, getByText } = renderFBL();
    expect(slot()?.instancesSeen).toBe(1);

    const input = lineInput(container);
    setVal(input, "doubled := count * 2");
    /* Two "Run" buttons in jsdom — RunResetToolbar's plus the
     * MobileKeyBar shortcut (lg:hidden in real browsers; jsdom
     * doesn't fire media queries so both live in the tree). Both
     * fire yaegi.run; the toolbar's is first. */
    fireEvent.click(getAllByText("Run")[0]!);
    /* Wait for the awaited run to settle. */
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByText("Submit"));
    expect(slot()?.instancesPassed).toBe(1);
    expect(slot()?.instancesFailed).toBe(0);
    expect(input.disabled).toBe(true);
  });
});

describe("<FillBlankLineInput> — wrong path", () => {
  it("stdout mismatch → wrong-phase actions surface, no pass or fail recorded", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "wrong-output\n", stderr: "", error: "" });
    const { container, getAllByText, getByText } = renderFBL();
    setVal(lineInput(container), "broken := count");
    /* Two "Run" buttons in jsdom — RunResetToolbar's plus the
     * MobileKeyBar shortcut (lg:hidden in real browsers; jsdom
     * doesn't fire media queries so both live in the tree). Both
     * fire yaegi.run; the toolbar's is first. */
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByText("Submit"));
    expect(getByText("Try again")).toBeTruthy();
    expect(getByText("Reshuffle this exercise")).toBeTruthy();
    expect(getByText("Reveal answer (counts as fail)")).toBeTruthy();
    expect(slot()?.instancesPassed).toBe(0);
    expect(slot()?.instancesFailed).toBe(0);
  });
});

describe("<FillBlankLineInput> — reveal flow", () => {
  it("Reveal correct records exactly one failure and hides the Reveal button", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "wrong\n", stderr: "", error: "" });
    const { container, getAllByText, getByText, queryByText } = renderFBL();
    setVal(lineInput(container), "broken := count");
    /* Two "Run" buttons in jsdom — RunResetToolbar's plus the
     * MobileKeyBar shortcut (lg:hidden in real browsers; jsdom
     * doesn't fire media queries so both live in the tree). Both
     * fire yaegi.run; the toolbar's is first. */
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Reveal answer (counts as fail)"));
    expect(slot()?.instancesFailed).toBe(1);
    expect(queryByText("Reveal answer (counts as fail)")).toBeNull();
    expect(slot()?.instancesPassed).toBe(0);
  });
});

describe("<FillBlankLineInput> — Enter-to-Run", () => {
  it("Enter on the input triggers run() with the substituted program", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container } = renderFBL();
    const input = lineInput(container);
    setVal(input, "doubled := count * 2");
    fireEvent.keyDown(input, { key: "Enter" });
    await vi.waitFor(() => {
      expect(evalMock).toHaveBeenCalledTimes(1);
    });
    /* Program text wraps the user's line in the scaffold. */
    const program = evalMock.mock.calls[0]?.[0] as string;
    expect(program).toContain("doubled := count * 2");
    expect(program).toContain("count := 5");
  });

  it("Enter on an empty input is a no-op (no eval call)", () => {
    const { container } = renderFBL();
    fireEvent.keyDown(lineInput(container), { key: "Enter" });
    expect(evalMock).not.toHaveBeenCalled();
  });
});

describe("<FillBlankLineInput> — Another resets state", () => {
  it("Another clears input AND runResult", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText, getByText, queryByText } = renderFBL();
    setVal(lineInput(container), "doubled := count * 2");
    /* Two "Run" buttons in jsdom — RunResetToolbar's plus the
     * MobileKeyBar shortcut (lg:hidden in real browsers; jsdom
     * doesn't fire media queries so both live in the tree). Both
     * fire yaegi.run; the toolbar's is first. */
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByText("Submit"));
    /* In the right phase: "Try a fresh variant" is the
     * shell's Another button. */
    fireEvent.click(getByText("Try a fresh variant"));
    /* Input is cleared and the run-result panel (which renders the
     * stdout) is gone. */
    expect(lineInput(container).value).toBe("");
    expect(queryByText(EXPECTED_STDOUT.trim())).toBeNull();
  });
});
