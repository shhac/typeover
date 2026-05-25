/*
 * Cross-runtime type primitives shared by every worker + the
 * client-descriptor that exposes them to the hook layer.
 *
 * Lives as a leaf module (zero `import` statements) so any other
 * runtime file can pull in the shape without dragging compile/asset
 * code along — important for `client-descriptors.ts`, which must
 * stay value-edge-free from `lib/` to keep the seam-audit cycle
 * fix in place.
 *
 * The interface used to be re-declared four times under different
 * names (YaegiResult, ZigResult, WasiRunResult, plus an inline
 * shape on the descriptor) — same fields, slight risk of one
 * worker silently adding a field the descriptor doesn't surface.
 */

/** What every worker's `eval(code)` resolves to. `error` is empty
 *  on a clean compile + clean exit; compile errors, runtime traps,
 *  and non-zero exits all land there. */
export interface WorkerEvalResult {
  stdout: string;
  stderr: string;
  error: string;
}
