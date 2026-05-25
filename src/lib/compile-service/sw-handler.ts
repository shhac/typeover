/*
 * Pure, dependency-injected logic for the compile-cache service
 * worker. The actual SW (src/service-worker/compile-cache.ts) is
 * a thin shell that wires up the fetch event listener and delegates
 * here. Splitting it this way lets us test the body-sniffing +
 * cache-lookup contract without standing up a real ServiceWorker
 * runtime.
 *
 * Per design-docs/32.
 */

import { sha256Hex } from "./hash";
import type { LanguageEntry } from "./normalize";

export const CACHE_PREFIX = "/compile-cache/";

/** Extract the Rust source out of an HTTP body string. Accepts:
 *   - JSON `{ source: string }` (current contract)
 *   - JSON `{ edit: string }` (legacy alias kept for migration)
 *   - Plain text (raw source as the body)
 *   - Malformed JSON → falls back to using the body as plain text
 *
 *  Pure function; covers the SW's tolerance for body shape so the
 *  worker can evolve its body format without re-cutting the SW. */
export function extractSource(bodyText: string): string | undefined {
  if (!bodyText.startsWith("{")) return bodyText;
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const bag = parsed as Record<string, unknown>;
    if (typeof bag.source === "string") return bag.source;
    if (typeof bag.edit === "string") return bag.edit;
    return undefined;
  } catch {
    return bodyText;
  }
}

/** Dependencies injected into `handleCompileRequest` so tests can
 *  drive cache hits, misses, and registry lookups without binding
 *  to globals. */
export interface SwHandlerDeps {
  fetch: typeof globalThis.fetch;
  registry: Record<string, LanguageEntry>;
}

/** Normalize → hash → try L1 static asset → fall through to the
 *  real endpoint if missing. Returns the Response the SW should
 *  hand back to the page. */
export async function handleCompileRequest(
  request: Request,
  lang: string,
  deps: SwHandlerDeps,
): Promise<Response> {
  const entry = deps.registry[lang];
  if (!entry) return deps.fetch(request);

  let source: string | undefined;
  try {
    source = extractSource(await request.clone().text());
  } catch {
    return deps.fetch(request);
  }
  if (typeof source !== "string") return deps.fetch(request);

  const hash = await sha256Hex(entry.normalize(source));
  const cacheUrl = `${CACHE_PREFIX}${lang}/${hash}.wasm`;

  /* L1: static asset on Vercel's CDN. A 200 here costs nothing
   * against any usage quota. */
  const cached = await deps.fetch(cacheUrl, { method: "GET" });
  if (cached.ok) {
    /* Pass through wasm bytes with a synthetic Content-Type so
     * downstream consumers don't depend on the CDN's headers. */
    return new Response(await cached.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "application/wasm",
        "X-Typeover-Cache": "sw-l1",
      },
    });
  }

  /* Cache miss — defer to the real endpoint. The Function does
   * its own L2 (Blob) lookup and L3 (Sandbox compile) cascade. */
  return deps.fetch(request);
}
