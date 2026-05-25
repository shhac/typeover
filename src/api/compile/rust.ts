/*
 * /api/compile/rust — Vercel Function endpoint.
 *
 * Cache-miss fallback path for the freeform compile-service. The SW
 * intercepts the worker's POST and short-circuits L1 cache hits
 * directly from /compile-cache/rust/<hash>.wasm static assets; only
 * genuinely novel learner source ever reaches this Function.
 *
 * Pipeline:
 *   1. Validate the JSON body via `validateRustSource` (length cap +
 *      forbidden-token filter — see src/lib/compile-service/
 *      validate-rust-source.ts for the rule set and its tests).
 *   2. Hand off to the SandboxTransport, which round-robins across
 *      the warm sandbox pool and returns the compiled wasm bytes.
 *   3. Stream the bytes back as `application/wasm`.
 *
 * Auth: the @vercel/sandbox SDK reads VERCEL_OIDC_TOKEN from the
 * Function's environment automatically — no manual token handling.
 *
 * Sources live under `src/api/compile/`; this file is bundled by
 * `scripts/build-api.mjs` into `api/compile/rust.mjs` at the project
 * root, which Vercel auto-detects as a Serverless Function. The
 * bundle is self-contained — Vercel never runs `tsc` on the
 * source, so the `moduleResolution: nodenext` extension-policing
 * doesn't apply and we keep the regular Astro/TS import style
 * everywhere. design-docs/32.
 */

import { SandboxTransport } from "../../lib/compile-service/transports/sandbox";
import type { CompileTransport } from "../../lib/compile-service/transports/types";
import { validateRustSource } from "../../lib/compile-service/validate-rust-source";
import { errorMessage } from "../../lib/error-message";

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* Each helper returns an `ok`-tagged envelope so the handler is a
 * flat chain of early-returns rather than a stack of `let x; try { x
 * = ... } catch { ... }` blocks. The catch arm of `try/await` only
 * needs to construct the Response once, and the success arm can
 * narrow cleanly through the discriminator. */

type ParseResult =
  | { ok: true; body: unknown }
  | { ok: false; response: Response };

async function parseJsonBody(request: Request): Promise<ParseResult> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: errorResponse(400, "Body must be JSON.") };
  }
}

type CompileResult =
  | { ok: true; wasm: Uint8Array; elapsedSeconds: number }
  | { ok: false; response: Response };

async function runCompile(
  transport: CompileTransport,
  source: string,
): Promise<CompileResult> {
  try {
    const result = await transport.compile({ language: "rust", source });
    if (!result.ok) {
      /* 422 covers both rustc compile failures and transport errors —
       * the worker surfaces the message verbatim into the freeform
       * run-result panel, so the learner sees the actual rustc
       * diagnostic. */
      return { ok: false, response: errorResponse(422, result.message) };
    }
    return { ok: true, wasm: result.wasm, elapsedSeconds: result.elapsedSeconds };
  } catch (e) {
    return { ok: false, response: errorResponse(422, errorMessage(e)) };
  }
}

export function createRustCompilePostHandler(transport: CompileTransport) {
  return async function POST(request: Request): Promise<Response> {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const validation = validateRustSource(parsed.body);
    if (!validation.ok) {
      return errorResponse(validation.status, validation.message);
    }

    const result = await runCompile(transport, validation.source);
    if (!result.ok) return result.response;

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
  };
}

/* One transport instance per Function cold-start — keeps the
 * per-request shard counter alive across invocations the same
 * Function process handles. */
const transport = new SandboxTransport();

export const POST = createRustCompilePostHandler(transport);

/* Method gate for any non-POST callers. */
export async function GET(): Promise<Response> {
  return errorResponse(405, "POST only.");
}
