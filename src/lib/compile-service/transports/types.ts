/*
 * CompileTransport — the abstraction the prebake script and the
 * Vercel Function both call to turn Rust source into a `.wasm`
 * byte buffer. Two implementations today:
 *
 *   DockerTransport   — local dev, runs rust:1.83-slim via OrbStack
 *   SandboxTransport  — production on Vercel, Firecracker microVM
 *
 * A future StubTransport (logs "would compile" and returns a tiny
 * placeholder) would let CI runs without docker still complete the
 * prebake step.
 *
 * Per design-docs/32.
 */

export type CompileLanguage = "rust";

export interface CompileRequest {
  language: CompileLanguage;
  /** Composed source to feed to the compiler. The prebake passes
   *  the canonical solution; the Function passes
   *  skeleton-before + learner-edit + skeleton-after. */
  source: string;
  /** Optional ID for logging / cache namespacing. The Function
   *  uses exercise IDs; the prebake passes the exercise slug. */
  label?: string;
}

export interface CompileSuccess {
  ok: true;
  wasm: Uint8Array;
  /** Wall-clock seconds the transport spent producing the wasm.
   *  Used by callers to log slow compiles. */
  elapsedSeconds: number;
}

export interface CompileFailure {
  ok: false;
  /** Compiler stderr (or transport error). The Function may surface
   *  this to the learner; the prebake should fail the build. */
  message: string;
  elapsedSeconds: number;
}

export type CompileResult = CompileSuccess | CompileFailure;

export interface CompileTransport {
  /** Human-readable transport name for logging. */
  readonly name: string;
  /** Compile `source` to a `wasm32-wasip1` binary. Must not retain
   *  any per-request state — pure function from request to bytes. */
  compile(req: CompileRequest): Promise<CompileResult>;
}
