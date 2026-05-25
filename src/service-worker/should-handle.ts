/*
 * Fetch-event gating for the compile-service SW.
 *
 * Lifted out of compile-cache.ts so it can be unit-tested without
 * importing the SW shell (which executes `self.addEventListener` at
 * module load and can't load in jsdom/node). The actual cache-hit
 * logic in sw-handler.ts is already covered by its own suite; this
 * file pins the four-condition bouncer that decides whether a
 * request even reaches that handler:
 *
 *   1. POST (anything else is read-only navigation / static asset)
 *   2. same-origin (we don't intercept cross-origin requests)
 *   3. path under /api/compile/<lang>
 *   4. <lang> is in the LANGUAGE_REGISTRY
 *
 * A regression that flipped any of these (e.g. dropping the
 * method check, broadening the prefix) would either start
 * intercepting unrelated requests OR fail to hit the cache for
 * compile requests — both invisible in the browser until traffic
 * patterns shift. Hence the explicit test.
 */

import type { LanguageEntry } from "~/lib/compile-service/normalize";

type LanguageRegistry = Record<string, LanguageEntry>;

export const COMPILE_PREFIX = "/api/compile/";

/** Classify a fetch event for the compile-service SW. Returns the
 *  matched language id when all four gate conditions hold, or
 *  `null` to signal "pass-through — don't intercept." */
export function shouldHandleCompileRequest(
  request: Request,
  selfOrigin: string,
  registry: LanguageRegistry,
): { lang: string } | null {
  if (request.method !== "POST") return null;

  const url = new URL(request.url);
  if (url.origin !== selfOrigin) return null;
  if (!url.pathname.startsWith(COMPILE_PREFIX)) return null;

  const lang = url.pathname.slice(COMPILE_PREFIX.length);
  /* `Object.hasOwn` instead of `lang in registry` / `registry[lang]`
   * to guard against inherited names like `__proto__` and
   * `constructor` — a POST to /api/compile/__proto__ would
   * otherwise resolve `registry["__proto__"]` to the Object
   * prototype object (truthy) and slip past the gate. */
  if (!Object.hasOwn(registry, lang)) return null;

  return { lang };
}
