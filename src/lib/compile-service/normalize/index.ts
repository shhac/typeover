/*
 * Language registry for the compile-service cache layer.
 *
 * The service worker dispatches /api/compile/<lang> traffic by URL
 * prefix; it knows nothing about any specific language and asks
 * the registry for the normalizer. Adding a future server-compile
 * language (TypeScript-via-tsc, Swift, Kotlin) is one new file in
 * this directory plus an entry below.
 */

import { normalizeRust } from "./rust";

export interface LanguageEntry {
  /** URL slug — appears in /api/compile/<id> and
   *  /compile-cache/<id>/<hash>.wasm. */
  id: string;
  /** Pure, deterministic source → canonical-string transform.
   *  Same input ⇒ same output across every runtime that imports
   *  this module. */
  normalize: (src: string) => string;
}

export const LANGUAGE_REGISTRY: Record<string, LanguageEntry> = {
  rust: { id: "rust", normalize: normalizeRust },
};

export function getLanguage(id: string): LanguageEntry | undefined {
  return LANGUAGE_REGISTRY[id];
}

export { normalizeRust };
