import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratorSpec } from "~/lib/generator";

/*
 * Component-level integration test for <Freeform>. Pins the parts
 * of design-docs/12 that the FillBlankLineInput suite covers
 * symmetrically for freeform — happy / wrong / reveal / submit-gate
 * — with two freeform-specific contracts:
 *
 *   - the scaffold seed: the textarea starts pre-populated with the
 *     barren package-main scaffold (per design-docs/99 — freeform
 *     does NOT prefill the canonical).
 *   - Another resets the textarea back to the scaffold AND clears
 *     runResult.
 *
 * Same mocking model as FillBlankLineInput.test: stub `~/runtime`
 * so eval is controllable, real progress chain via vitest.setup.
 */

const { evalMock, terminateMock } = vi.hoisted(() => ({
  evalMock: vi.fn(),
  terminateMock: vi.fn(),
}));

vi.mock("~/runtime", () => ({
  getRunner: () => ({ eval: evalMock, ready: vi.fn() }),
  terminateRunner: terminateMock,
}));

import { Freeform } from "./Freeform";

const STORAGE_KEY = "typeover:progress";
const EX_ID = "test/freeform";
const HINTS: readonly [string, string, string] = ["c1", "c2", "c3"];
const EXPECTED_STDOUT = "hello\n";

/** Minimal freeform generator — no template vars; the canonical is
 *  the reference solution. The scaffold the textarea shows is a
 *  separate constant inside Freeform, not pulled from the generator. */
const GEN: GeneratorSpec = {
  kind: "template",
  vars: {},
  ts: 'console.log("hello")',
  canonical: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hello")\n}\n',
};

beforeEach(() => {
  evalMock.mockReset();
  terminateMock.mockReset();
});
afterEach(() => {
  localStorage.clear();
});

const renderFF = () =>
  render(() => (
    <Freeform
      exerciseId={EX_ID}
      prompt="Print hello."
      generator={GEN}
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

const textarea = (container: HTMLElement): HTMLTextAreaElement => {
  const el = container.querySelector("textarea");
  if (!el) throw new Error("textarea not found");
  return el as HTMLTextAreaElement;
};

const setVal = (el: HTMLTextAreaElement, value: string) =>
  fireEvent.input(el, { target: { value } });

describe("<Freeform> — scaffold seed", () => {
  it("textarea starts with the barren package-main scaffold, NOT the canonical", () => {
    const { container } = renderFF();
    const ta = textarea(container);
    /* Per design-docs/99 — freeform must not pre-fill the canonical. */
    expect(ta.value).toContain("package main");
    expect(ta.value).toContain("func main()");
    expect(ta.value).toContain("implement here");
    expect(ta.value).not.toContain('fmt.Println("hello")');
  });
});

describe("<Freeform> — submit gate", () => {
  it("Submit is disabled until a run has completed", () => {
    const { getByText } = renderFF();
    expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("<Freeform> — happy path", () => {
  it("edit → Run → stdout match → Submit records pass + locks textarea", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText, getByText } = renderFF();
    expect(slot()?.instancesSeen).toBe(1);
    const ta = textarea(container);
    setVal(ta, 'package main\nimport "fmt"\nfunc main() { fmt.Println("hello") }');
    /* Two "Run" buttons in jsdom: the toolbar Run from
     * RunResetToolbar (always visible) and the MobileKeyBar Run
     * shortcut (lg:hidden in real browsers — jsdom doesn't fire
     * media queries so it's in the tree too). Both fire the same
     * yaegi.run; click the first one. */
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByText("Submit"));
    expect(slot()?.instancesPassed).toBe(1);
    expect(slot()?.instancesFailed).toBe(0);
    expect(ta.disabled).toBe(true);
  });
});

describe("<Freeform> — wrong path", () => {
  it("stdout mismatch → wrong-phase actions surface, no pass or fail recorded", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "wrong\n", stderr: "", error: "" });
    const { container, getAllByText, getByText } = renderFF();
    setVal(textarea(container), "package main\nfunc main(){}");
    /* Two "Run" buttons in jsdom: the toolbar Run from
     * RunResetToolbar (always visible) and the MobileKeyBar Run
     * shortcut (lg:hidden in real browsers — jsdom doesn't fire
     * media queries so it's in the tree too). Both fire the same
     * yaegi.run; click the first one. */
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

describe("<Freeform> — reveal flow", () => {
  it("Reveal correct records exactly one failure and hides the Reveal button", async () => {
    evalMock.mockResolvedValueOnce({ stdout: "wrong\n", stderr: "", error: "" });
    const { container, getAllByText, getByText, queryByText } = renderFF();
    setVal(textarea(container), "package main\nfunc main(){}");
    /* Two "Run" buttons in jsdom: the toolbar Run from
     * RunResetToolbar (always visible) and the MobileKeyBar Run
     * shortcut (lg:hidden in real browsers — jsdom doesn't fire
     * media queries so it's in the tree too). Both fire the same
     * yaegi.run; click the first one. */
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

describe("<Freeform> — Another resets scaffold + runResult", () => {
  it("Another after pass returns the textarea to the scaffold and clears runResult", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container, getAllByText, getByText } = renderFF();
    const ta = textarea(container);
    setVal(ta, 'package main\nimport "fmt"\nfunc main() { fmt.Println("hello") }');
    /* Two "Run" buttons in jsdom: the toolbar Run from
     * RunResetToolbar (always visible) and the MobileKeyBar Run
     * shortcut (lg:hidden in real browsers — jsdom doesn't fire
     * media queries so it's in the tree too). Both fire the same
     * yaegi.run; click the first one. */
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => {
      expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByText("Submit"));
    fireEvent.click(getByText("Try a fresh variant"));
    /* Scaffold restored: the marker comment is back, and the prior
     * user submission isn't. */
    expect(ta.value).toContain("implement here");
    expect(ta.value).not.toContain('fmt.Println("hello")');
    /* Submit is back to disabled (runResult cleared). */
    expect((getByText("Submit") as HTMLButtonElement).disabled).toBe(true);
  });
});
