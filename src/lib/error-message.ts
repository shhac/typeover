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
 * Used by:
 *   - src/runtime/wasi-run.ts          (compile / trap fallthrough)
 *   - src/runtime/rust-worker.ts       (network + JSON errors)
 *   - src/runtime/zig-worker.ts        (compile + run outcomes)
 *   - src/lib/use-runtime-run.ts       (boot + run failure surface)
 *   - src/api/compile/rust.ts          (transport throws)
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
