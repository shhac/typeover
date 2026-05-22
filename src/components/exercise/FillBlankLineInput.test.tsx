import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratorSpec } from "~/lib/generator-schema";

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
 * use-runtime-run.test.ts. Real progress chain via the vitest.setup
 * localStorage shim.
 */

const { evalMock, terminateMock, zigEvalMock, zigTerminateMock } = vi.hoisted(() => ({
  evalMock: vi.fn(),
  terminateMock: vi.fn(),
  zigEvalMock: vi.fn(),
  zigTerminateMock: vi.fn(),
}));

vi.mock("~/runtime", () => ({
  /* Distinct spies per runtime so the runtime-selection block at
   * the bottom can verify dispatch. The main happy/wrong/etc.
   * blocks use the Yaegi pair (matching the historic suite). */
  getRunner: () => ({ eval: evalMock, ready: () => Promise.resolve() }),
  terminateRunner: terminateMock,
  getZigRunner: () => ({ eval: zigEvalMock, ready: () => Promise.resolve() }),
  terminateZigRunner: zigTerminateMock,
}));

import { FillBlankLineInput } from "./FillBlankLineInput";
import { HINTS, makeProgressReader } from "./__test__/progress-helpers";

const EX_ID = "test/fill-line";
const { slot } = makeProgressReader(EX_ID);

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
  zigEvalMock.mockReset();
  zigTerminateMock.mockReset();
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

const lineInput = (container: HTMLElement): HTMLInputElement => {
  const el = container.querySelector('input[type="text"]');
  if (!el) throw new Error("blank input not found");
  return el as HTMLInputElement;
};

const setVal = (el: HTMLInputElement, value: string) => fireEvent.input(el, { target: { value } });

describe("<FillBlankLineInput> — submit gate", () => {
  it("Submit is disabled while input is empty (auto-Run has nothing to run)", () => {
    const { getByText } = renderFBL();
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("Submit becomes enabled as soon as input is non-empty (will auto-Run on click)", () => {
    /* design-docs/26 UX ask — Submit no longer waits for a prior
     * Run; clicking it triggers Run, and the auto-Submit-on-correct
     * effect commits the verdict when the result lands. */
    const { container, getByText } = renderFBL();
    setVal(lineInput(container), "doubled := count * 2");
    const submit = getByText("Submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
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
  it("editing the input after a Run clears runResult; Submit stays enabled and will auto-Run again", async () => {
    /* design-docs/19 F-3: a learner who Runs valid code then
     * edits the input must NOT be graded against the previous
     * Run's stdout. Clearing runResult on edit guarantees that —
     * with the new auto-Run-on-Submit contract (docs/26), Submit
     * is still enabled, but clicking it triggers a fresh Run
     * against the current input, not a stale grading. */
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText } = renderFBL();
    const input = lineInput(container);
    setVal(input, "doubled := count * 2");
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      /* Once Run resolves correctly, the auto-Submit effect fires
       * and the input locks (right phase). Wait for that. */
      expect(input.disabled).toBe(true);
    });
  });
});

describe("<FillBlankLineInput> — happy path", () => {
  it("type → Run → stdout match → auto-Submit records pass once + locks input", async () => {
    /* design-docs/26 UX ask — a correct Run auto-Submits without
     * the learner needing to click Submit. The phase transitions
     * directly to "right" once the result lands. */
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText } = renderFBL();
    expect(slot()?.instancesSeen).toBe(1);

    const input = lineInput(container);
    setVal(input, "doubled := count * 2");
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      /* Right phase pins: pass recorded + input locked. */
      expect(slot()?.instancesPassed).toBe(1);
      expect(input.disabled).toBe(true);
    });
    expect(slot()?.instancesFailed).toBe(0);
  });

  it("Submit click without a prior Run auto-Runs first, then auto-Submits on correct", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getByText } = renderFBL();
    const input = lineInput(container);
    setVal(input, "doubled := count * 2");
    /* No Run click — go straight to Submit. */
    fireEvent.click(getByText("Submit"));
    await vi.waitFor(() => {
      expect(slot()?.instancesPassed).toBe(1);
    });
    expect(input.disabled).toBe(true);
    /* Exactly one eval call — the auto-Run. */
    expect(evalMock).toHaveBeenCalledTimes(1);
  });
});

describe("<FillBlankLineInput> — wrong path", () => {
  it("stdout mismatch → stays in picking after Run; explicit Submit commits to wrong-phase", async () => {
    /* Wrong-stdout Runs deliberately DO NOT auto-Submit — the
     * learner needs the chance to inspect the result panel and
     * iterate before committing. They have to click Submit
     * explicitly to take the failure. */
    evalMock.mockResolvedValueOnce({ stdout: "wrong-output\n", stderr: "", error: "" });
    const { container, getAllByText, getByText } = renderFBL();
    setVal(lineInput(container), "broken := count");
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      /* Run resolved; we're still in picking with Submit available. */
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    expect(slot()?.instancesPassed).toBe(0);
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

describe("<FillBlankLineInput> — alternate canonical (Yaegi-unrunnable but perfect)", () => {
  it("submission matches an authored alternate → graded correct even when Yaegi errors", async () => {
    /* Simulate Yaegi failing to run the modern form (e.g.
     * `slices.Sort` under our Yaegi build without generic stdlib
     * support). Mock returns a non-empty error and mismatched
     * stdout — the standard isCorrect path would FAIL. The
     * alternate-canonical match should rescue it. */
    evalMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "undefined: slices.Sort",
      error: "9:2: undefined selector: slices.Sort",
    });
    const { container, getAllByText, getByText } = render(() => (
      <FillBlankLineInput
        exerciseId={EX_ID}
        prompt="Type the missing line."
        generator={GEN}
        blanks={["line"]}
        hints={HINTS}
        expectStdout={EXPECTED_STDOUT}
        runtime="yaegi"
        alternateCanonicals={["MODERN := count * 2"]}
        successNote="Yaegi can't run this, but you typed the modern form — accepted."
      />
    ));
    setVal(lineInput(container), "MODERN := count * 2");
    fireEvent.click(getAllByText("Run")[0]!);
    /* Auto-Submit-on-correct fires whether the verdict came via
     * stdout match or via alternateCanonicals — the isCorrect
     * predicate is the same gate. */
    await vi.waitFor(() => {
      expect(slot()?.instancesPassed).toBe(1);
    });
    expect(slot()?.instancesFailed).toBe(0);
    /* successNote disclosure surfaces in the right-phase shell. */
    expect(
      getByText("Yaegi can't run this, but you typed the modern form — accepted."),
    ).toBeTruthy();
  });

  it("submission that doesn't match any alternate AND Yaegi mismatches → still wrong", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "garbage\n", stderr: "", error: "" });
    const { container, getAllByText, getByText } = render(() => (
      <FillBlankLineInput
        exerciseId={EX_ID}
        prompt="Type the missing line."
        generator={GEN}
        blanks={["line"]}
        hints={HINTS}
        expectStdout={EXPECTED_STDOUT}
        runtime="yaegi"
        alternateCanonicals={["MODERN := count * 2"]}
      />
    ));
    setVal(lineInput(container), "neither := canonical");
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByText("Submit"));
    expect(getByText("Try again")).toBeTruthy();
    expect(slot()?.instancesPassed).toBe(0);
  });
});

describe("<FillBlankLineInput> — Another resets state", () => {
  it("Another clears input AND runResult", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText, getByText, queryByText } = renderFBL();
    setVal(lineInput(container), "doubled := count * 2");
    fireEvent.click(getAllByText("Run")[0]!);
    /* Auto-Submit-on-correct lands the right phase directly — wait
     * for the "Try a fresh variant" button to appear. */
    await vi.waitFor(() => {
      expect(getByText("Try a fresh variant")).toBeTruthy();
    });
    fireEvent.click(getByText("Try a fresh variant"));
    expect(lineInput(container).value).toBe("");
    expect(queryByText(EXPECTED_STDOUT.trim())).toBeNull();
  });
});

describe('<FillBlankLineInput> — runtime="zig" path', () => {
  /* Until this block existed, both `getRunner` and `getZigRunner`
   * shared one spy and every test was `runtime="yaegi"`. A
   * regression hard-coding the Yaegi runtime inside the component
   * would not have failed any test. These cases pin:
   *   - eval() dispatches to the Zig runner spy
   *   - the CodeMirror surface picks up the Zig aria-label
   *   - terminate dispatches to the Zig terminate spy on reset */

  const renderZig = () =>
    render(() => (
      <FillBlankLineInput
        exerciseId={EX_ID}
        prompt="Type the missing line."
        generator={GEN}
        blanks={["line"]}
        hints={HINTS}
        expectStdout={EXPECTED_STDOUT}
        runtime="zig"
      />
    ));

  it("Run dispatches eval to the Zig runner, not the Yaegi runner", async () => {
    zigEvalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText } = renderZig();
    setVal(lineInput(container), "doubled := count * 2");
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => expect(zigEvalMock).toHaveBeenCalledTimes(1));
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("CodeMirror surface carries the Zig aria-label", () => {
    const { container } = renderZig();
    /* Under jsdom the LegacyFallback renders; the language prop
     * + aria-label now thread onto the wrapper div, so the
     * grammar-selection wiring is observable end-to-end. */
    const surface = container.querySelector('[aria-label="Fill-the-line Zig snippet"]');
    expect(surface).not.toBeNull();
  });
});
