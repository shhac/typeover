/*
 * SandboxTransport — production compile path inside Vercel.
 *
 * Calls `@vercel/sandbox` 2.x to compile Rust source against a
 * pre-warmed pool of named sandboxes. The pool pattern relies on
 * Vercel's persistent-sandbox semantics: a sandbox addressed by
 * stable `name` auto-snapshots its filesystem on stop and resumes
 * from snapshot on the next request. First-time creation runs
 * `onCreate` (rustup install + wasm32-wasip1 target); subsequent
 * resumes are millisecond-scale.
 *
 * Why pool + getOrCreate rather than explicit snapshot IDs: avoids
 * a separate bootstrap step (the first request to a never-used pool
 * shard performs the install lazily) and removes the env-var
 * coupling between bootstrap and production. The cost is one slow
 * first request per shard — typeover absorbs this via the L1 cache
 * (build-time prebake), so the install only fires on a true
 * cache-miss against a cold shard.
 *
 * Local dev uses DockerTransport. Per design-docs/32.
 */

import type {
  CompileRequest,
  CompileResult,
  CompileTransport,
} from "./types";
import {
  RUST_RUNTIME,
  RUST_SANDBOX_NETWORK_ALLOW,
  rustInstallCommand,
  rustcCompileArgs,
} from "./sandbox-config.ts";

/* The static SDK type. Each `compile()` call dynamic-imports
 * @vercel/sandbox; this type alias just sharpens the local
 * signatures. The interface below intentionally surfaces the
 * minimum surface the transport uses, decoupled from the SDK so
 * future SDK shape changes only touch the seam. */
interface SandboxLike {
  writeFiles(files: Array<{ path: string; content: string | Uint8Array }>): Promise<unknown>;
  runCommand(
    command: string,
    args?: string[],
  ): Promise<{ exitCode: number; stderr: () => Promise<string> }>;
  runCommand(params: {
    cmd: string;
    args?: string[];
    env?: Record<string, string>;
  }): Promise<{ exitCode: number; stderr: () => Promise<string> }>;
  readFileToBuffer(file: { path: string }): Promise<Buffer | null>;
}

interface SandboxTransportOptions {
  /** Stable name prefix for sandbox pooling. The actual sandbox
   *  name is `${pool}-${shard}` where shard rotates per request.
   *  Default: `rust-compiler-pool`. */
  poolName?: string;
  /** Max number of warm sandboxes in the pool. Default: 3. */
  poolSize?: number;
  /** Compile timeout in seconds. Default: 20. */
  timeoutSeconds?: number;
  /** Sandbox runtime image. Sandbox v2 defaults to `node24` which
   *  is fine — we don't run Node code, we just run rustc. */
  runtime?: string;
}

export class SandboxTransport implements CompileTransport {
  readonly name = "vercel-sandbox";
  private readonly poolName: string;
  private readonly poolSize: number;
  private readonly timeoutSeconds: number;
  private readonly runtime: string;
  private nextShard = 0;

  constructor(opts: SandboxTransportOptions = {}) {
    this.poolName = opts.poolName ?? "rust-compiler-pool";
    this.poolSize = opts.poolSize ?? 3;
    this.timeoutSeconds = opts.timeoutSeconds ?? 20;
    this.runtime = opts.runtime ?? RUST_RUNTIME;
  }

  async compile(req: CompileRequest): Promise<CompileResult> {
    if (req.language !== "rust") {
      return {
        ok: false,
        message: `SandboxTransport only supports rust; got ${req.language}`,
        elapsedSeconds: 0,
      };
    }

    const started = Date.now();
    const name = this.nextShardName();
    try {
      const sandbox = await this.getOrCreateRustSandbox(name);
      return await runRustc(sandbox, req.source, started);
    } catch (err) {
      return {
        ok: false,
        message: `[sandbox transport] ${(err as Error).message}`,
        elapsedSeconds: (Date.now() - started) / 1000,
      };
    }
  }

  /* Round-robin shard selection. Pure — exposed as a private
   * method so tests (and a future debugger) can inspect the
   * counter without poking instance state. */
  private nextShardName(): string {
    const shard = this.nextShard % this.poolSize;
    this.nextShard = (this.nextShard + 1) % this.poolSize;
    return `${this.poolName}-${shard}`;
  }

  /* Resume a warm sandbox by name, or create one on first contact
   * (running `onCreate` to install the toolchain). Dynamic import
   * keeps this transport importable from contexts where
   * @vercel/sandbox isn't installed — e.g. the local prebake
   * script using DockerTransport. */
  private async getOrCreateRustSandbox(name: string): Promise<SandboxLike> {
    const { Sandbox } = await import("@vercel/sandbox");
    return (await Sandbox.getOrCreate({
      name,
      runtime: this.runtime,
      /* Restrict egress to the Rust toolchain hosts so rustup +
       * cargo can pull stdlib + the wasm target on first creation.
       * After the install lands in the snapshot, subsequent
       * resumes never re-touch the network. rustc itself runs
       * fully offline. Shared with the bootstrap + docker
       * transports via sandbox-config.ts. */
      networkPolicy: { allow: [...RUST_SANDBOX_NETWORK_ALLOW] },
      timeout: this.timeoutSeconds * 1000,
      onCreate: async (sbx) => {
        /* First-time install — runs once per sandbox name, ever.
         * Snapshot captures the toolchain so resumes skip this. */
        await sbx.runCommand(rustInstallCommand());
      },
    })) as unknown as SandboxLike;
  }
}

/** Write the source, invoke rustc, decode the result. Pure
 *  result-decoder (modulo the sandbox handle). Independently
 *  testable against a `SandboxLike` mock without touching the
 *  Sandbox SDK. */
export async function runRustc(
  sandbox: SandboxLike,
  source: string,
  startedAt: number,
): Promise<CompileResult> {
  await sandbox.writeFiles([{ path: "/tmp/main.rs", content: source }]);

  /* `~/.cargo/bin/rustc` because rustup installed into HOME, not
   * a system path. Wrap in bash so PATH is sourced. Args shared
   * with the docker transport via `rustcCompileArgs`. */
  const args = rustcCompileArgs("/tmp/main.rs", "/tmp/out.wasm");
  const result = await sandbox.runCommand({
    cmd: "bash",
    args: ["-lc", `~/.cargo/bin/rustc ${args.join(" ")}`],
  });

  const elapsed = (Date.now() - startedAt) / 1000;
  if (result.exitCode !== 0) {
    const stderr = await result.stderr();
    return {
      ok: false,
      message: stderr.trim() || `rustc exited ${result.exitCode}`,
      elapsedSeconds: elapsed,
    };
  }

  const buf = await sandbox.readFileToBuffer({ path: "/tmp/out.wasm" });
  if (!buf) {
    return {
      ok: false,
      message: "rustc reported success but /tmp/out.wasm is missing",
      elapsedSeconds: elapsed,
    };
  }
  return {
    ok: true,
    wasm: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
    elapsedSeconds: elapsed,
  };
}

/* Re-exported for tests so they don't need to traffic in the
 * SDK type. */
export type { SandboxLike };
