/*
 * SandboxTransport — production compile path inside Vercel.
 *
 * STATUS: scaffolded but not finalized against the live
 * @vercel/sandbox 2.x SDK. The freeform PoC's happy path is the L1
 * static cache; this transport only fires for genuinely novel
 * canonical inputs in production, which doesn't happen until after a
 * real deploy + snapshot bootstrap. Finishing the wiring is a clean
 * follow-up — design-docs/32 outlines what needs to land.
 *
 * The intended pipeline:
 *   1. Sandbox.getOrCreate({ name, source: { type: "snapshot",
 *      snapshotId } }) — resumes a warm microVM from the snapshot
 *      produced by scripts/bootstrap-rust-sandbox.ts.
 *   2. sandbox.writeFiles([{ path: "/tmp/main.rs", content: source }])
 *   3. sandbox.runCommand("rustc", ["--target", "wasm32-wasip1",
 *      "-C", "opt-level=z", "-C", "strip=symbols", ...])
 *   4. sandbox.readFile({ path: "/tmp/out.wasm" }) → bytes.
 *   5. networkPolicy locked down: rustc has no need for egress in
 *      the canonical-or-edit single-file flow.
 *
 * Per design-docs/32. Local dev uses DockerTransport instead.
 */

import type {
  CompileRequest,
  CompileResult,
  CompileTransport,
} from "./types";

interface SandboxTransportOptions {
  /** Vercel Sandbox snapshot ID — produced by the bootstrap
   *  script. Stored as RUST_TOOLCHAIN_SNAPSHOT in env. */
  snapshotId: string;
  /** Stable name prefix for sandbox pooling. The actual sandbox
   *  name is `${pool}-${shard}` where shard is request-derived.
   *  Default: `rust-compiler-pool`. */
  poolName?: string;
  /** Max number of warm sandboxes in the pool. Default: 3. */
  poolSize?: number;
  /** Compile timeout in seconds. Default: 20. */
  timeoutSeconds?: number;
}

export class SandboxTransport implements CompileTransport {
  readonly name = "vercel-sandbox";
  private readonly snapshotId: string;
  private readonly poolName: string;
  private readonly poolSize: number;
  private readonly timeoutSeconds: number;

  constructor(opts: SandboxTransportOptions) {
    this.snapshotId = opts.snapshotId;
    this.poolName = opts.poolName ?? "rust-compiler-pool";
    this.poolSize = opts.poolSize ?? 3;
    this.timeoutSeconds = opts.timeoutSeconds ?? 20;
  }

  async compile(_req: CompileRequest): Promise<CompileResult> {
    /* See header — wiring against @vercel/sandbox 2.x is a clean
     * follow-up. Returning a failure here is the right behavior
     * until the deploy-side bootstrap lands, because the Function
     * caller will translate it into a 503 the learner can act on
     * ("compile transport unavailable") rather than a silent hang. */
    void this.snapshotId;
    void this.poolName;
    void this.poolSize;
    void this.timeoutSeconds;
    return {
      ok: false,
      message:
        "Sandbox transport not yet wired. Pre-bake canonical solutions " +
        "via `pnpm cache:prebake` and rely on the L1 cache until the " +
        "production transport lands. See design-docs/32.",
      elapsedSeconds: 0,
    };
  }
}
