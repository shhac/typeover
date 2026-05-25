/*
 * Input validation for /api/compile/rust.
 *
 * Cheap pre-filter run before the SandboxTransport. The microVM
 * boundary is the security guarantee; this just bounces the
 * obvious abuse vectors and shapes structured errors the Function
 * can return verbatim.
 *
 * Extracted from api/compile/rust.ts so the validation is testable
 * without standing up the Sandbox SDK or a fake Request.
 *
 * Per design-docs/32.
 */

export const MAX_SOURCE_BYTES = 8 * 1024;

/** Pattern set that rejects submissions reaching for filesystem,
 *  network, process, unsafe, raw asm, file-inclusion macros, or
 *  nightly features. None of these are needed for typeover's
 *  learner-track exercises. Adding a token doesn't tighten the
 *  security boundary (the microVM does that) — it just keeps the
 *  Function from accepting submissions we'd compile in vain. */
export const FORBIDDEN_PATTERNS: readonly RegExp[] = [
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

export interface ValidateOk {
  ok: true;
  source: string;
}

export interface ValidateError {
  ok: false;
  status: number;
  message: string;
}

export type ValidateResult = ValidateOk | ValidateError;

/** Shape of the JSON body the Function accepts. `source` is the
 *  only field; everything else is ignored. */
interface RawBody {
  source?: unknown;
}

/** Validate a parsed JSON body. Returns either a typed `source`
 *  string ready to hand to the transport, or a `{ status, message }`
 *  the caller turns into an error response. */
export function validateRustSource(body: unknown): ValidateResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, status: 400, message: "Body must be a JSON object." };
  }
  const { source } = body as RawBody;
  if (typeof source !== "string") {
    return { ok: false, status: 400, message: "`source` must be a string." };
  }
  if (source.length === 0) {
    return { ok: false, status: 400, message: "`source` is empty." };
  }
  const sourceBytes = new TextEncoder().encode(source).byteLength;
  if (sourceBytes > MAX_SOURCE_BYTES) {
    return {
      ok: false,
      status: 413,
      message: `source exceeds ${MAX_SOURCE_BYTES} bytes`,
    };
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      return {
        ok: false,
        status: 422,
        message:
          "Source contains a token typeover doesn't permit in the " +
          "freeform sandbox (process / env / fs / net / unsafe / asm / " +
          "include / nightly features). The learner-track exercises " +
          "don't need these.",
      };
    }
  }
  return { ok: true, source };
}
