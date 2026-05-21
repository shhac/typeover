/**
 * Shared `data-codemirror-test` marker check. Vitest sets the
 * attribute on `<html>` in `vitest.setup.ts`; the CodeMirror
 * surfaces look here to swap into a `<textarea>`/`<pre>`/span-tree
 * fallback whose DOM matches what the existing test suite
 * dispatches against (CM's contentEditable is brittle in jsdom).
 *
 * Pulled out of CodeMirrorEditor + CodeMirrorFillBlanks +
 * McqOption — they each used to redefine an identical 4-line
 * predicate, making future "what's the test marker?" edits a
 * three-file dance.
 */
export function isCodeMirrorTestEnv(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-codemirror-test")
  );
}
