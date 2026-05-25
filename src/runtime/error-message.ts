/**
 * Coerce an `unknown` thrown value to a display string.
 *
 * Five call sites across the runtime + compile-service paths reach
 * for the same `err instanceof Error ? err.message : String(err)`
 * pattern. Co-locating it here makes the intent obvious — "give me
 * a learner-presentable message for whatever this catch caught" —
 * and means a future change (e.g. unwrap AggregateError, strip
 * stack traces, anonymise paths) lands in one place instead of
 * drifting across files.
 *
 * Lives under `src/runtime/` because four of its five importers
 * are inside this directory (wasi-run, compile-fetch, zig-compile,
 * plus api/compile/rust which is the server side of the same
 * pipeline). `lib/use-runtime-run.ts` reaches in for the same
 * coercion in its catch arms. Keeping the file here avoids a
 * `runtime → lib` import edge that would otherwise close a
 * subsystem cycle with `lib/client-runtime-descriptors`.
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
