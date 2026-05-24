/*
 * Service worker — compile-service cache layer.
 *
 * Bundled by `scripts/build-sw.mjs` into `public/sw-compile-cache.js`,
 * which Astro then serves at the origin root. Registered by
 * BaseLayout.astro on every route so a single SW instance handles
 * the entire site.
 *
 * URL contract (per design-docs/32):
 *   POST /api/compile/<lang>            ← source in body
 *     → SW hashes normalize(source), tries:
 *         GET /compile-cache/<lang>/<hash>.wasm
 *           ↳ 200 → return cached bytes (L1, free CDN)
 *           ↳ 404 → fall through to the real POST (L2/L3)
 *
 * The SW is intentionally dumb about specific languages. It looks
 * up the language entry in LANGUAGE_REGISTRY and calls
 * `.normalize(source)`. Adding a future server-compile language is
 * one new file in src/lib/compile-service/normalize/ plus a
 * registry entry — the SW does not change.
 */

/// <reference lib="webworker" />

import { LANGUAGE_REGISTRY } from "~/lib/compile-service/normalize";
import { sha256Hex } from "~/lib/compile-service/hash";

declare const self: ServiceWorkerGlobalScope;

const COMPILE_PREFIX = "/api/compile/";
const CACHE_PREFIX = "/compile-cache/";

/* Skip the standard install/activate dance — claim immediately so
 * the first navigation after a fresh deploy uses the new SW
 * without a reload. Acceptable for a learning site where SW
 * versioning is best-effort, not safety-critical. */
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST") return;
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(COMPILE_PREFIX)) return;

  const lang = url.pathname.slice(COMPILE_PREFIX.length);
  if (!LANGUAGE_REGISTRY[lang]) return;

  event.respondWith(handleCompileRequest(event.request, lang));
});

async function handleCompileRequest(
  request: Request,
  lang: string,
): Promise<Response> {
  const entry = LANGUAGE_REGISTRY[lang];
  if (!entry) return fetch(request);

  /* The body shape isn't fully nailed down yet — the eventual
   * /api/compile/<lang> route will define it. For the cache lookup
   * we only need the source string; tolerate both raw-text and
   * JSON-wrapped bodies. */
  const clone = request.clone();
  let source: string | undefined;
  try {
    const text = await clone.text();
    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        source =
          typeof parsed.source === "string"
            ? parsed.source
            : typeof parsed.edit === "string"
              ? parsed.edit
              : undefined;
      } catch {
        source = text;
      }
    } else {
      source = text;
    }
  } catch {
    return fetch(request);
  }
  if (typeof source !== "string") return fetch(request);

  const hash = await sha256Hex(entry.normalize(source));
  const cacheUrl = `${CACHE_PREFIX}${lang}/${hash}.wasm`;

  /* L1: static asset on Vercel's CDN. A 200 here costs nothing
   * against any usage quota. */
  const cached = await fetch(cacheUrl, { method: "GET" });
  if (cached.ok) {
    /* Pass through Content-Type + length so the caller sees a
     * normal wasm response. */
    return new Response(await cached.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "application/wasm",
        "X-Typeover-Cache": "sw-l1",
      },
    });
  }

  /* Cache miss — defer to the real endpoint. The Function does its
   * own L2 (Blob) lookup and L3 (Sandbox compile) cascade. */
  return fetch(request);
}
