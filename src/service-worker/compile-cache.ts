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
 * The actual cache/registry logic lives in
 * src/lib/compile-service/sw-handler.ts — pure, dependency-injected,
 * unit-tested. This file is the SW shell: register handlers,
 * delegate.
 */

/// <reference lib="webworker" />

import { LANGUAGE_REGISTRY } from "~/lib/compile-service/normalize";
import { handleCompileRequest } from "~/lib/compile-service/sw-handler";
import { shouldHandleCompileRequest } from "./should-handle";

declare const self: ServiceWorkerGlobalScope;

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
  const match = shouldHandleCompileRequest(
    event.request,
    self.location.origin,
    LANGUAGE_REGISTRY,
  );
  if (!match) return;

  event.respondWith(
    handleCompileRequest(event.request, match.lang, {
      fetch: self.fetch.bind(self),
      registry: LANGUAGE_REGISTRY,
    }),
  );
});
