import { describe, expect, it } from "vitest";
import {
  currentLineIndent,
  handleAutoIndentEnter,
  insertAtFocused,
  insertAtSelection,
} from "./textarea-insert";

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

describe("currentLineIndent", () => {
  it("returns empty for an empty value", () => {
    const ta = makeTextarea("", 0);
    expect(currentLineIndent(ta)).toBe("");
  });

  it("returns the leading spaces of the caret's line", () => {
    const ta = makeTextarea("  foo\n    bar", 13);
    expect(currentLineIndent(ta)).toBe("    ");
  });

  it("returns the leading tabs of the caret's line", () => {
    const ta = makeTextarea("\t\tfoo", 5);
    expect(currentLineIndent(ta)).toBe("\t\t");
  });

  it("returns mixed leading whitespace verbatim", () => {
    const ta = makeTextarea("  \tfoo", 6);
    expect(currentLineIndent(ta)).toBe("  \t");
  });

  it("is empty when the caret's line has no leading whitespace", () => {
    const ta = makeTextarea("foo\nbar", 7);
    expect(currentLineIndent(ta)).toBe("");
  });

  it("reads the FIRST line when caret is in the first line", () => {
    const ta = makeTextarea("  foo\n    bar", 3);
    expect(currentLineIndent(ta)).toBe("  ");
  });
});

describe("handleAutoIndentEnter", () => {
  const enterEvent = (init?: Partial<KeyboardEventInit>): KeyboardEvent =>
    new KeyboardEvent("keydown", { key: "Enter", cancelable: true, ...init });

  it("returns false (and doesn't preventDefault) for non-Enter keys", () => {
    const ta = makeTextarea("  foo", 5);
    const ev = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    expect(handleAutoIndentEnter(ta, ev)).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("returns false when the current line has no leading whitespace", () => {
    const ta = makeTextarea("foo", 3);
    const ev = enterEvent();
    expect(handleAutoIndentEnter(ta, ev)).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
    /* Value is untouched — the browser's default Enter handler runs. */
    expect(ta.value).toBe("foo");
  });

  it("inserts \\n + indent and preventDefaults when the line is indented", () => {
    const ta = makeTextarea("  foo", 5);
    const ev = enterEvent();
    expect(handleAutoIndentEnter(ta, ev)).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
    expect(ta.value).toBe("  foo\n  ");
    expect(ta.selectionStart).toBe(8);
  });

  it("preserves tab indents", () => {
    const ta = makeTextarea("\tfoo", 4);
    const ev = enterEvent();
    handleAutoIndentEnter(ta, ev);
    expect(ta.value).toBe("\tfoo\n\t");
  });

  it("falls through (returns false) on Shift+Enter — escape hatch", () => {
    const ta = makeTextarea("  foo", 5);
    const ev = enterEvent({ shiftKey: true });
    expect(handleAutoIndentEnter(ta, ev)).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("falls through on Ctrl+Enter / Meta+Enter / Alt+Enter", () => {
    for (const mod of ["ctrlKey", "metaKey", "altKey"] as const) {
      const ta = makeTextarea("  foo", 5);
      const ev = enterEvent({ [mod]: true });
      expect(handleAutoIndentEnter(ta, ev)).toBe(false);
    }
  });

  it("handles Enter at mid-line — indent comes from the line, caret splits the line", () => {
    /* Caret between "foo" and "bar" on an indented line. The new
     * line starts with the same indent, then "bar" follows after
     * the auto-inserted whitespace. */
    const ta = makeTextarea("  foobar", 5);
    handleAutoIndentEnter(ta, enterEvent());
    expect(ta.value).toBe("  foo\n  bar");
  });
});

describe("insertAtFocused", () => {
  it("inserts into a focused textarea", () => {
    const ta = makeTextarea("abc", 1);
    ta.focus();
    insertAtFocused("Z");
    expect(ta.value).toBe("aZbc");
  });

  it("inserts into a focused input", () => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = "xy";
    document.body.appendChild(inp);
    inp.focus();
    inp.setSelectionRange(2, 2);
    insertAtFocused("Q");
    expect(inp.value).toBe("xyQ");
  });

  it("is a no-op when no input/textarea is focused", () => {
    const ta = makeTextarea("untouched", 0);
    /* Move focus to something that isn't an input/textarea. */
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    insertAtFocused("X");
    expect(ta.value).toBe("untouched");
  });
});
