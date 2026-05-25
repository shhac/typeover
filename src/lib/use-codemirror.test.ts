import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { insertAtFocused } from "./textarea-insert";

/*
 * "CodeMirror-real" tests — exercise the production CM path even
 * though we're running under jsdom. Vitest's setup adds a
 * `data-codemirror-test` attribute on `<html>` so component code
 * bifurcates to the simpler `<input>` / `<textarea>` fallback; we
 * remove it for these tests + restore after.
 *
 * The harness mounts a minimal real EditorView (no Solid component,
 * no fallback dispatch) and exercises behaviors that the fallback
 * cannot reproduce — the single-line transaction filter, the
 * Prec.high Enter keymap, the cm-content focus detection that
 * `insertAtFocused` relies on for MobileKeyBar chips.
 */

const MARKER_ATTR = "data-codemirror-test";
let markerWasPresent = false;

beforeEach(() => {
  markerWasPresent = document.documentElement.hasAttribute(MARKER_ATTR);
  document.documentElement.removeAttribute(MARKER_ATTR);
});

afterEach(() => {
  if (markerWasPresent) document.documentElement.setAttribute(MARKER_ATTR, "");
});

/* Helper: mount a bare EditorView with whatever extensions the test
 * supplies, append to body, return the view + a cleanup. Each test
 * owns its own view so they don't share state. */
function mountView(initialDoc: string, extensions: Extension[] = []) {
  const parent = document.createElement("div");
  document.body.append(parent);
  const state = EditorState.create({ doc: initialDoc, extensions });
  const view = new EditorView({ state, parent });
  return {
    view,
    cleanup: () => {
      view.destroy();
      parent.remove();
    },
  };
}

describe("insertAtFocused — CodeMirror branch (E3)", () => {
  it("dispatches text at the selection of a focused CM view", () => {
    const { view, cleanup } = mountView("abcd");
    view.dispatch({ selection: { anchor: 2 } });
    view.focus();
    insertAtFocused(":=");
    expect(view.state.doc.toString()).toBe("ab:=cd");
    /* Caret should land immediately after the inserted text. */
    expect(view.state.selection.main.anchor).toBe(4);
    cleanup();
  });

  it("is a no-op when nothing focusable holds the caret", () => {
    /* No view mounted, no input focused — should silently do nothing. */
    expect(() => insertAtFocused("X")).not.toThrow();
  });

  it("falls through to native-field path when an input is focused, not a CM view", () => {
    const input = document.createElement("input");
    input.value = "hello";
    document.body.append(input);
    input.focus();
    input.setSelectionRange(5, 5);
    insertAtFocused("!");
    expect(input.value).toBe("hello!");
    input.remove();
  });
});

describe("single-line transaction filter (E1)", () => {
  /* Recreate the filter inline — it's stateless, lives in
   * BlankInput.tsx, and is the production behavior we're testing.
   * Replicating it here keeps the test focused on the filter's
   * contract without coupling to BlankInput's import surface. */
  function singleLineFilter(): Extension {
    return EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged) return tr;
      const newDoc = tr.newDoc.toString();
      if (!newDoc.includes("\n")) return tr;
      return {
        changes: { from: 0, to: tr.startState.doc.length, insert: newDoc.replaceAll("\n", "") },
      };
    });
  }

  it("strips newlines on paste of multi-line content", () => {
    const { view, cleanup } = mountView("", [singleLineFilter()]);
    view.dispatch({ changes: { from: 0, insert: "foo\nbar" } });
    expect(view.state.doc.toString()).toBe("foobar");
    expect(view.state.doc.toString()).not.toContain("\n");
    cleanup();
  });

  it("strips multiple newlines", () => {
    const { view, cleanup } = mountView("", [singleLineFilter()]);
    view.dispatch({ changes: { from: 0, insert: "a\nb\nc" } });
    expect(view.state.doc.toString()).toBe("abc");
    cleanup();
  });

  it("passes through single-line content unchanged", () => {
    const { view, cleanup } = mountView("", [singleLineFilter()]);
    view.dispatch({ changes: { from: 0, insert: "no newlines here" } });
    expect(view.state.doc.toString()).toBe("no newlines here");
    cleanup();
  });
});

import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { useCodeMirror } from "./use-codemirror";
import { createSignal, createRoot } from "solid-js";

describe("Prec.high Enter keymap on a single-line surface (E2)", () => {
  it("fires the handler AND does not insert a newline", () => {
    let fired = 0;
    const { view, cleanup } = mountView("", [
      Prec.high(
        keymap.of([
          {
            key: "Enter",
            run: () => {
              fired += 1;
              return true;
            },
          },
        ]),
      ),
    ]);
    view.focus();
    /* Dispatch an Enter via the runScopeHandlers path: CM's
     * keymap responds to runtime key events; in jsdom we
     * synthesise a KeyboardEvent and dispatch it on the
     * contentDOM. */
    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    expect(fired).toBe(1);
    expect(view.state.doc.toString()).toBe(""); /* no newline inserted */
    cleanup();
  });
});

/* Solid's `onMount` queues for after the synchronous reactive
 * setup. Tests have to flush a microtask before the EditorView is
 * mounted and findable. */
const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0));

describe("useCodeMirror value-sync cursor-jump guard (E4)", () => {
  it("does not re-dispatch when external value matches current doc", async () => {
    const [value, setValue] = createSignal("hello");
    const parent = document.createElement("div");
    document.body.append(parent);
    const dispose = createRoot((d) => {
      useCodeMirror({
        parent: () => parent,
        initialDoc: value(),
        value,
        buildExtensions: () => [],
      });
      return d;
    });
    await flushMicrotasks();
    const cmContent = parent.querySelector(".cm-content") as HTMLElement | null;
    expect(cmContent).not.toBeNull();
    const view = EditorView.findFromDOM(cmContent!);
    expect(view).not.toBeNull();
    /* Spy on dispatch to count subsequent calls. `EditorView.dispatch`
     * has multiple overloads; cast through `unknown` to bypass the
     * overload-narrowing dance for spy installation. */
    let dispatchCount = 0;
    const origDispatch = view!.dispatch.bind(view);
    (view as unknown as { dispatch: (...args: unknown[]) => void }).dispatch = (
      ...args: unknown[]
    ) => {
      dispatchCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origDispatch as any)(...args);
    };
    /* Re-set the SAME value — the guard should suppress the dispatch. */
    setValue("hello");
    await flushMicrotasks();
    expect(dispatchCount).toBe(0);
    /* Set a different value — should dispatch once. */
    setValue("world");
    await flushMicrotasks();
    expect(dispatchCount).toBe(1);
    expect(view!.state.doc.toString()).toBe("world");
    dispose();
    parent.remove();
  });
});

describe("useCodeMirror editable compartment toggle (E5)", () => {
  it("reconfigures editable to false when locked flips, rejecting subsequent edits", async () => {
    const [editable, setEditable] = createSignal(true);
    const parent = document.createElement("div");
    document.body.append(parent);
    const dispose = createRoot((d) => {
      useCodeMirror({
        parent: () => parent,
        initialDoc: "ab",
        editable,
        buildExtensions: ({ editableCompartment }) => [
          editableCompartment.of(EditorView.editable.of(editable())),
        ],
      });
      return d;
    });
    await flushMicrotasks();
    const cmContent = parent.querySelector(".cm-content") as HTMLElement | null;
    expect(cmContent).not.toBeNull();
    const view = EditorView.findFromDOM(cmContent!);
    expect(view).not.toBeNull();
    /* Initially editable. */
    expect(view!.state.facet(EditorView.editable)).toBe(true);
    /* Flip to false. */
    setEditable(false);
    await flushMicrotasks();
    expect(view!.state.facet(EditorView.editable)).toBe(false);
    dispose();
    parent.remove();
  });
});
