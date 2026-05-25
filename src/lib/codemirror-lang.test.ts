import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { cmLanguageExtension, type CmLanguage } from "./codemirror-lang";

/* Verify the dispatcher resolves to SOMETHING for every language.
 * Each grammar is dynamic-imported, so the dispatcher is async.
 * The extension objects are opaque internals — we don't introspect
 * their grammar — but we can confirm they resolve without error
 * and compose into a valid EditorState. */
describe("cmLanguageExtension", () => {
  const langs: readonly CmLanguage[] = ["go", "ts", "zig", "rust"];

  for (const lang of langs) {
    it(`resolves to an Extension for ${lang} that mounts into EditorState.create`, async () => {
      const ext = await cmLanguageExtension(lang);
      expect(ext).toBeTruthy();
      const state = EditorState.create({ doc: "x", extensions: [ext] });
      expect(state.doc.toString()).toBe("x");
    });
  }
});
