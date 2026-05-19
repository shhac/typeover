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
