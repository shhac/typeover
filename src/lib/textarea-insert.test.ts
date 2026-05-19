import { describe, expect, it } from "vitest";
import { insertAtSelection } from "./textarea-insert";

/*
 * insertAtSelection — caret-aware text injection used by
 * MobileKeyBar. Pinned cases: empty selection, mid-text caret,
 * selected-range replacement, and the no-op-when-disabled guard.
 *
 * jsdom implements `setRangeText` on HTMLTextAreaElement and
 * HTMLInputElement, so the happy path exercises that branch
 * directly. The `.value =` fallback is unreachable in jsdom but
 * remains in the source as defence in depth for older targets.
 */

function makeTextarea(initial = "", caretAt = 0): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.value = initial;
  ta.selectionStart = ta.selectionEnd = caretAt;
  document.body.appendChild(ta);
  return ta;
}

describe("insertAtSelection — empty input", () => {
  it("inserts at the start of an empty textarea", () => {
    const ta = makeTextarea("", 0);
    insertAtSelection(ta, "hello");
    expect(ta.value).toBe("hello");
    expect(ta.selectionStart).toBe(5);
    expect(ta.selectionEnd).toBe(5);
  });
});

describe("insertAtSelection — mid-text caret", () => {
  it("splits the value at the caret", () => {
    const ta = makeTextarea("abcdef", 3);
    insertAtSelection(ta, "XY");
    expect(ta.value).toBe("abcXYdef");
    expect(ta.selectionStart).toBe(5);
  });
});

describe("insertAtSelection — selected range", () => {
  it("replaces the selected range with the new text", () => {
    const ta = makeTextarea("abcdef", 0);
    ta.setSelectionRange(2, 5);
    insertAtSelection(ta, "Z");
    expect(ta.value).toBe("abZf");
    expect(ta.selectionStart).toBe(3);
  });
});

describe("insertAtSelection — newline", () => {
  it("inserts a literal newline at the caret", () => {
    const ta = makeTextarea("ab", 2);
    insertAtSelection(ta, "\n");
    expect(ta.value).toBe("ab\n");
    expect(ta.selectionStart).toBe(3);
  });
});

describe("insertAtSelection — disabled element", () => {
  it("is a no-op when the textarea is disabled", () => {
    const ta = makeTextarea("untouched", 0);
    ta.disabled = true;
    insertAtSelection(ta, "X");
    expect(ta.value).toBe("untouched");
  });
});

describe("insertAtSelection — input event", () => {
  it("dispatches a bubbling input event after mutation", () => {
    const ta = makeTextarea("hi", 2);
    let fired = false;
    ta.addEventListener("input", () => {
      fired = true;
    });
    insertAtSelection(ta, "!");
    expect(fired).toBe(true);
    expect(ta.value).toBe("hi!");
  });
});

describe("insertAtSelection — text input element (not just textarea)", () => {
  it("works on an <input type='text'>", () => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = "foo";
    document.body.appendChild(inp);
    inp.setSelectionRange(3, 3);
    insertAtSelection(inp, "BAR");
    expect(inp.value).toBe("fooBAR");
    expect(inp.selectionStart).toBe(6);
  });
});
