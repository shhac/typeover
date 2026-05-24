/*
 * /api/compile/rust — Vercel Function endpoint.
 *
 * Cache-miss fallback path for the freeform compile-service. The SW
 * intercepts the worker's POST and short-circuits L1 cache hits
 * directly from /compile-cache/rust/<hash>.wasm static assets; only
 * genuinely novel learner source ever reaches this Function.
 *
 * Pipeline:
 *   1. Validate the JSON body (a single `source` string within the
 *      cap).
 *   2. Run a source-token filter to reject obvious abuse vectors
 *      (extern crate, std::process, fs/net/os, unsafe, macros that
 *      pull in arbitrary files). Cheap signal, not the boundary —
 *      the microVM is.
 *   3. Hand off to the SandboxTransport, which round-robins across
 *      the warm sandbox pool and returns the compiled wasm bytes.
 *   4. Stream the bytes back as `application/wasm`.
 *
 * Auth: the @vercel/sandbox SDK reads VERCEL_OIDC_TOKEN from the
 * Function's environment automatically — no manual token handling.
 *
 * Lives at the project root (`/api/compile/rust.ts`) rather than
 * inside `src/pages/api/` to keep Astro in `output: "static"` mode.
 * Vercel auto-detects top-level `/api/` as serverless Functions on
 * any deploy. design-docs/32.
 */

import { SandboxTransport } from "../../src/lib/compile-service/transports/sandbox";

const MAX_SOURCE_BYTES = 8 * 1024;

/* Cheap pre-filter. The microVM boundary is the security guarantee;
 * this just bounces the obvious abuse cases before they reach
 * rustc. Adding a token here is not "tightening security" — it's
 * "deny early." */
const FORBIDDEN_PATTERNS = [
  /\bextern\s+crate\b/,
  /\bstd::process\b/,
  /\bstd::env\b/,
  /\bstd::fs\b/,
  /\bstd::net\b/,
  /\bstd::os::/,
  /\bunsafe\b/,
  /\basm!\s*\(/,
  /\binclude_str!\s*\(/,
  /\binclude_bytes!\s*\(/,
  /\binclude!\s*\(/,
  /#!\[feature\(/,
];

interface CompileRequestBody {
  source?: unknown;
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* One transport instance per Function cold-start — keeps the
 * per-request shard counter alive across invocations the same
 * Function process handles. */
const transport = new SandboxTransport();

export async function POST(request: Request): Promise<Response> {
  let body: CompileRequestBody;
  try {
    body = (await request.json()) as CompileRequestBody;
  } catch {
    return errorResponse(400, "Body must be JSON.");
  }

  const source = body.source;
  if (typeof source !== "string") {
    return errorResponse(400, "`source` must be a string.");
  }
  if (source.length === 0) {
    return errorResponse(400, "`source` is empty.");
  }
  if (source.length > MAX_SOURCE_BYTES) {
    return errorResponse(
      413,
      `source exceeds ${MAX_SOURCE_BYTES} bytes`,
    );
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      return errorResponse(
        422,
        "Source contains a token typeover doesn't permit in the " +
          "freeform sandbox (process / env / fs / net / unsafe / asm / " +
          "include / nightly features). The learner-track exercises " +
          "don't need these.",
      );
    }
  }

  const result = await transport.compile({
    language: "rust",
    source,
  });

  if (!result.ok) {
    /* 422 covers both rustc compile failures and transport errors —
     * the worker surfaces the message verbatim into the freeform
     * run-result panel, so the learner sees the actual rustc
     * diagnostic. */
    return errorResponse(422, result.message);
  }

  /* Slice into a fresh ArrayBuffer so the Response body is exactly
   * the wasm bytes — the upstream Uint8Array may be a view into a
   * larger Node Buffer that the TypeScript Response body type
   * doesn't accept directly. */
  const wasmBuffer = result.wasm.slice().buffer;

  /* Tag responses with how long the compile took so we can observe
   * the cache-miss latency curve from the worker's stderr / logs. */
  return new Response(wasmBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/wasm",
      "X-Typeover-Compile-Seconds": result.elapsedSeconds.toFixed(2),
      /* The SW won't write this response into /compile-cache (it
       * can't reach static asset disk). The wasm shipped to the
       * client is single-use unless the learner re-submits the
       * same source, at which point the worker would re-hit this
       * endpoint. A future L2 (Vercel Blob) layer would cache here
       * — out of PoC scope. */
      "Cache-Control": "no-store",
    },
  });
}

/* Method gate for any non-POST callers. */
export async function GET(): Promise<Response> {
  return errorResponse(405, "POST only.");
}
