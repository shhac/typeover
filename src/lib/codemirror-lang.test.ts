import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { cmLanguageExtension, CM_LANGUAGE_LABEL, type CmLanguage } from "./codemirror-lang";

/* Verify the dispatcher returns SOMETHING for every language. The
 * extension objects are opaque internals — we don't introspect their
 * grammar — but we can confirm they instantiate without error and
 * compose into a valid EditorState. */
describe("cmLanguageExtension", () => {
  const langs: readonly CmLanguage[] = ["go", "ts", "zig"];

  for (const lang of langs) {
    it(`returns an Extension for ${lang} that mounts into EditorState.create`, () => {
      const ext = cmLanguageExtension(lang);
      expect(ext).toBeTruthy();
      const state = EditorState.create({ doc: "x", extensions: [ext] });
      expect(state.doc.toString()).toBe("x");
    });
  }
});

describe("CM_LANGUAGE_LABEL", () => {
  it("provides human labels for every language", () => {
    expect(CM_LANGUAGE_LABEL.go).toBe("Go");
    expect(CM_LANGUAGE_LABEL.ts).toBe("TypeScript");
    expect(CM_LANGUAGE_LABEL.zig).toBe("Zig");
  });
});
