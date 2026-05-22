import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratorSpec } from "~/lib/generator-schema";

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

/* Distinct spies per runtime so the runtime-selection block at the
 * bottom can verify dispatch. The main blocks use the Yaegi pair
 * (matching the historic suite). */
const { zigEvalMock, zigTerminateMock } = vi.hoisted(() => ({
  zigEvalMock: vi.fn(),
  zigTerminateMock: vi.fn(),
}));

vi.mock("~/runtime", () => ({
  getRunner: () => ({ eval: evalMock, ready: () => Promise.resolve() }),
  terminateRunner: terminateMock,
  getZigRunner: () => ({ eval: zigEvalMock, ready: () => Promise.resolve() }),
  terminateZigRunner: zigTerminateMock,
}));

import { Freeform } from "./Freeform";
import { HINTS, makeProgressReader } from "./__test__/progress-helpers";

const EX_ID = "test/freeform";
const { slot } = makeProgressReader(EX_ID);
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
  zigEvalMock.mockReset();
  zigTerminateMock.mockReset();
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

describe("<Freeform> — Cmd/Ctrl+Enter triggers Run from inside the textarea", () => {
  it("Cmd+Enter (mac) in the textarea calls yaegi.run() with the current code", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container } = renderFF();
    const ta = textarea(container);
    setVal(ta, 'package main\nimport "fmt"\nfunc main() { fmt.Println("hello") }');
    fireEvent.keyDown(ta, { key: "Enter", metaKey: true });
    await vi.waitFor(() => {
      expect(evalMock).toHaveBeenCalledTimes(1);
    });
    const program = evalMock.mock.calls[0]?.[0] as string;
    expect(program).toContain('fmt.Println("hello")');
  });

  it("Ctrl+Enter (win/linux) in the textarea calls yaegi.run()", async () => {
    evalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { container } = renderFF();
    const ta = textarea(container);
    setVal(ta, "package main\nfunc main() {}");
    fireEvent.keyDown(ta, { key: "Enter", ctrlKey: true });
    await vi.waitFor(() => {
      expect(evalMock).toHaveBeenCalledTimes(1);
    });
  });

  it("plain Enter does NOT trigger Run (auto-indent path keeps owning bare Enter)", () => {
    const { container } = renderFF();
    const ta = textarea(container);
    setVal(ta, "package main\nfunc main() {");
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("Shift+Cmd+Enter does NOT trigger Run (modifier-collision guard)", () => {
    const { container } = renderFF();
    setVal(textarea(container), "package main\nfunc main() {}");
    fireEvent.keyDown(textarea(container), { key: "Enter", metaKey: true, shiftKey: true });
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("Cmd+Enter with empty code is a no-op (canRun gate holds)", () => {
    const { container } = renderFF();
    const ta = textarea(container);
    setVal(ta, "   \n\n  ");
    fireEvent.keyDown(ta, { key: "Enter", metaKey: true });
    expect(evalMock).not.toHaveBeenCalled();
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

describe("<Freeform> — runtime dispatch", () => {
  /* Pin which worker the Freeform component drives based on its
   * `runtime` prop. Before distinct spies landed, both branches
   * shared one `evalMock` and the dispatch wiring was invisible
   * to the suite — a regression hard-coding the Yaegi runtime
   * inside Freeform would silently still grade correctly under
   * `runtime="zig"`. */

  const renderZig = () =>
    render(() => (
      <Freeform
        exerciseId={EX_ID}
        prompt="Print hello."
        generator={GEN}
        hints={HINTS}
        expectStdout={EXPECTED_STDOUT}
        runtime="zig"
      />
    ));

  const renderServer = () =>
    render(() => (
      <Freeform
        exerciseId={EX_ID}
        prompt="Print hello."
        generator={GEN}
        hints={HINTS}
        expectStdout={EXPECTED_STDOUT}
        runtime="server"
      />
    ));

  it("Run dispatches eval to the Zig runner when runtime is zig", async () => {
    zigEvalMock.mockResolvedValueOnce({ stdout: EXPECTED_STDOUT, stderr: "", error: "" });
    const { getAllByText } = renderZig();
    fireEvent.click(getAllByText("Run")[0]!);
    await vi.waitFor(() => expect(zigEvalMock).toHaveBeenCalledTimes(1));
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("server runtime disables Run — canRun gates the button", async () => {
    /* The hook now accepts `"server"` and returns `canRun: false`
     * for it; Freeform threads that into `canRun={runner.canRun}`.
     * Without this gate a learner could click Run on a server-
     * runtime exercise and trip an undefined-accessor path. */
    const { getAllByText } = renderServer();
    /* Flush any boot microtasks just to be safe. */
    await Promise.resolve();
    await Promise.resolve();
    /* Two "Run" buttons: toolbar + mobile-key-bar shortcut. The
     * toolbar's is the one with the disabled attribute (the
     * MobileKeyBar omits its Run prop when !canRun, leaving the
     * button absent from that toolbar). Find the disabled toolbar
     * Run. */
    const runBtns = getAllByText("Run") as HTMLButtonElement[];
    const toolbarRun = runBtns.find((b) => b.disabled);
    expect(toolbarRun).toBeTruthy();
    fireEvent.click(toolbarRun!);
    expect(zigEvalMock).not.toHaveBeenCalled();
    expect(evalMock).not.toHaveBeenCalled();
  });
});
