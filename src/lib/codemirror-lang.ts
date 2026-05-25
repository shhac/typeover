/*
 * Centralised CodeMirror language-extension dispatcher.
 *
 * Three editor surfaces (`CodeMirrorEditor`, `CodeMirrorFillBlanks`,
 * `BlankInput`) each used to maintain their own switch / record /
 * ternary picking between `go()`, `javascript({typescript:true})`,
 * and `zigLanguage`. Adding a new language meant three coordinated
 * edits, and the per-component type unions (`EditorLanguage`,
 * `FillBlanksLanguage`, etc.) overlapped but didn't align.
 *
 * This module owns:
 *   - `CmLanguage` — the canonical union the three editors agree on.
 *   - `cmLanguageExtension(lang)` — the dispatcher.
 *
 * Per-editor types remain (some surfaces are read-only and don't
 * load a completion source; some don't allow `"ts"` etc.), but they
 * narrow `CmLanguage` rather than duplicate it. Adding a fourth
 * language is one new import + one new switch case.
 */

import type { Extension } from "@codemirror/state";
import { go } from "@codemirror/lang-go";
import { javascript } from "@codemirror/lang-javascript";
import { zigLanguage } from "@ndim/codemirror-lang-zig";
import { assertUnreachable } from "./assert-unreachable";

/** Canonical language union for every CodeMirror editor surface. */
export type CmLanguage = "go" | "ts" | "zig" | "rust";

/** Return the CodeMirror extension for a given language. */
export function cmLanguageExtension(lang: CmLanguage): Extension {
  switch (lang) {
    case "go":
      return go();
    case "ts":
      return javascript({ typescript: true });
    case "zig":
      /* `zigLanguage` is an `LRLanguage` value (not a constructor
       * like lang-go's `go()`); use directly as the extension. */
      return zigLanguage;
    case "rust":
      /* No Rust Lezer parser bundled today — code renders in mono
       * with no syntax tinting. Adding a parser is a focused
       * upgrade (`@codemirror/lang-rust` exists upstream); leaving
       * the fallback empty keeps the bundle lean until the Rust
       * track justifies the dependency. */
      return [];
    default:
      /* Widening CmLanguage without a matching case here is a
       * compile-time failure rather than a silent fall-through
       * returning undefined. */
      return assertUnreachable(lang);
  }
}
