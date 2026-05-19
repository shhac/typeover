/**
 * Caret-aware insertion into a text input or textarea. The helper
 * exists because the MobileKeyBar needs to drop characters (`{`,
 * `:=`, `\n`, …) at the caret without:
 *
 *   - blurring the field (iOS Safari would collapse the keyboard)
 *   - blowing away the selection on a Solid re-render
 *   - breaking native undo / redo
 *
 * `setRangeText` is the right call when available — it edits the
 * value in place and keeps the input's native undo stack intact.
 * Setting `.value` directly is the fallback for older browsers
 * (it's not strictly needed for the deploy targets, but is cheap
 * to keep so unit tests can run in jsdom without prodding native
 * APIs).
 *
 * After mutation the helper dispatches a bubbling `input` event so
 * any framework listening to `onInput` (Solid signals, in our case)
 * picks up the change. Without that, the parent's value() signal
 * would diverge from what's actually in the DOM.
 */

type Insertable = HTMLInputElement | HTMLTextAreaElement;

export function insertAtSelection(el: Insertable, text: string): void {
  if (el.disabled) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;

  if (typeof el.setRangeText === "function") {
    /* "end" leaves the caret immediately after the inserted text —
     * the natural follow-the-cursor behaviour authors expect. */
    el.setRangeText(text, start, end, "end");
  } else {
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Insert into whatever input/textarea is currently focused. No-op
 * if nothing focusable holds the caret.
 *
 * Used by MobileKeyBar callers that render multiple potential
 * targets and don't want to forward a ref through nested components
 * — FillBlankLineInput renders its `<input>` inside a `<For>` over
 * blank segments inside CodeBlock; threading a ref out is more
 * invasive than just reading `document.activeElement` here.
 *
 * Safe because MobileKeyBar's `onPointerDown` calls
 * `preventDefault()`, which keeps the previously-focused field
 * active when the button is tapped.
 */
export function insertAtFocused(text: string): void {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    insertAtSelection(active, text);
  }
}

/**
 * Leading-whitespace prefix of the line the caret is currently in.
 * For `"  foo\n    bar|"` (caret at `|`), returns `"    "`. Used by
 * the auto-indent Enter handler so the new line opens with the same
 * indent as the previous one.
 */
export function currentLineIndent(el: HTMLTextAreaElement | HTMLInputElement): string {
  const start = el.selectionStart ?? el.value.length;
  const before = el.value.slice(0, start);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineSoFar = before.slice(lineStart);
  const match = lineSoFar.match(/^[ \t]*/);
  return match ? match[0] : "";
}

/**
 * Auto-indent Enter handler — call from a textarea's `onKeyDown`.
 * Returns `true` when it handled the key (caller must NOT also let
 * the default Enter fire), `false` otherwise.
 *
 * Behaviour: when Enter is pressed and the current line begins with
 * whitespace, inserts `\n` + that whitespace prefix at the caret.
 * Lines with no leading whitespace fall through to the browser's
 * default Enter (bare newline).
 *
 * Modifier keys (Shift, Ctrl, Meta, Alt) fall through unchanged —
 * Shift+Enter is the conventional "no auto-indent" escape hatch
 * for users who want a bare newline mid-block.
 */
export function handleAutoIndentEnter(
  el: HTMLTextAreaElement | HTMLInputElement,
  event: KeyboardEvent,
): boolean {
  if (event.key !== "Enter") return false;
  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
  const indent = currentLineIndent(el);
  if (indent === "") return false;
  event.preventDefault();
  insertAtSelection(el, "\n" + indent);
  return true;
}
