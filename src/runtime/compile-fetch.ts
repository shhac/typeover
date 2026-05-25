/*
 * Compile-service POST + response unwrap.
 *
 * Lifted out of rust-worker.ts so it can be unit-tested without
 * importing the worker module (which calls `expose(api)` at
 * module-init time and crashes outside a Worker context).
 *
 * The fetch is what the service worker intercepts; L1 cache hits
 * never hit the Function. This helper doesn't know or care about
 * the SW — it just POSTs and parses the response shape.
 *
 * Response contract (matches src/api/compile/rust.ts):
 *   - 200 application/wasm: success, body is the wasm bytes.
 *   - 4xx/5xx application/json: failure, body is `{ error: string }`.
 *   - 4xx/5xx non-JSON body: failure with a status-derived message.
 *   - network throw: failure with `[transport] <msg>` prefix.
 *
 * Per design-docs/32.
 */

import { errorMessage } from "~/lib/error-message";

export type FetchCompiledResult =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; error: string };

/** Optional injection point for tests. Defaults to `globalThis.fetch`
 *  so the production worker path is unchanged. */
export interface FetchCompiledDeps {
  fetch?: typeof globalThis.fetch;
}

/** POST learner source to `/api/compile/<lang>` and unwrap the
 *  response into a binary-or-error result. */
export async function fetchCompiledWasm(
  language: "rust",
  code: string,
  deps: FetchCompiledDeps = {},
): Promise<FetchCompiledResult> {
  const doFetch = deps.fetch ?? globalThis.fetch.bind(globalThis);

  let res: Response;
  try {
    res = await doFetch(`/api/compile/${language}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: code }),
    });
  } catch (err) {
    /* Network failure / DNS / offline. The `[transport]` prefix
     * disambiguates from compile-failure messages (which are the
     * rustc diagnostics themselves) in the freeform UI. */
    return { ok: false, error: `[transport] ${errorMessage(err)}` };
  }

  if (!res.ok) {
    /* On L1 miss, the Function (or the SW's fallthrough) returns
     * 422 with `{ error: <rustc stderr> }`; transport-level 5xx
     * just has a status code. Try JSON first, fall back on parse
     * failure. */
    let message = `compile request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* non-JSON body — fall back to the status-derived message. */
    }
    return { ok: false, error: message };
  }

  return { ok: true, bytes: await res.arrayBuffer() };
}
