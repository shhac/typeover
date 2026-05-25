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
 *   - `cmLanguageExtension(lang)` — async dispatcher; each grammar
 *      is dynamic-imported so it lands in its own chunk.
 *
 * Per-editor types remain (some surfaces are read-only and don't
 * load a completion source; some don't allow `"ts"` etc.), but they
 * narrow `CmLanguage` rather than duplicate it. Adding a fourth
 * language is one new switch case.
 *
 * Why async: the three grammars are ~100 KB minified each. Static
 * imports forced them all into the `ExerciseShell` chunk, blowing
 * past Vite's 500 KB warning. Dynamic imports split each grammar
 * into its own chunk, lazy-loaded only on pages that use it. The
 * cost is a Compartment dance in callers — see `useCodeMirror`'s
 * `language` config and the wrapper in `useLanguageCompartment`.
 */

import type { Extension } from "@codemirror/state";
import { assertUnreachable } from "./assert-unreachable";

/** Canonical language union for every CodeMirror editor surface. */
export type CmLanguage = "go" | "ts" | "zig" | "rust";

/** Resolve the CodeMirror extension for a given language. Each
 *  grammar is dynamic-imported so Vite splits them into their own
 *  chunks; only pages that actually mount an editor with that
 *  language pay the download. */
export async function cmLanguageExtension(lang: CmLanguage): Promise<Extension> {
  switch (lang) {
    case "go": {
      const { go } = await import("@codemirror/lang-go");
      return go();
    }
    case "ts": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({ typescript: true });
    }
    case "zig": {
      /* `zigLanguage` is an `LRLanguage` value (not a constructor
       * like lang-go's `go()`); use directly as the extension. */
      const { zigLanguage } = await import("@ndim/codemirror-lang-zig");
      return zigLanguage;
    }
    case "rust":
      /* No Rust Lezer parser bundled today — code renders in mono
       * with no syntax tinting. Adding a parser is a focused
       * upgrade (`@codemirror/lang-rust` exists upstream); leaving
       * the fallback empty keeps the bundle lean until the Rust
       * track justifies the dependency. Async wrapper for API
       * uniformity even though no work is done here. */
      return [];
    default:
      /* Widening CmLanguage without a matching case here is a
       * compile-time failure rather than a silent fall-through
       * returning undefined. */
      return assertUnreachable(lang);
  }
}
