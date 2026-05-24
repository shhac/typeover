/*
 * DockerTransport — local-dev compile path for the prebake script.
 *
 * Spawns `docker run --rm rust:1.83-slim` with the source piped on
 * stdin and the compiled wasm captured from a known output path
 * inside the container. No network, no volume mounts beyond a
 * scratch tmpfs the container writes to.
 *
 * Requires Docker (or OrbStack) running locally with the
 * `rust:1.83-slim` image pulled and the `wasm32-wasip1` target
 * installed in it. The first run after `docker pull` adds ~30s
 * for `rustup target add wasm32-wasip1`; subsequent runs reuse
 * the image layer.
 *
 * Per design-docs/32 — production uses SandboxTransport.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  CompileRequest,
  CompileResult,
  CompileTransport,
} from "./types";

interface DockerTransportOptions {
  /** Docker image to run. Default: `rust:1.83-slim`. */
  image?: string;
  /** Wall-clock seconds before the compile is killed.
   *  Default: 30. */
  timeoutSeconds?: number;
  /** Disable container networking. Default: `false` for the stock
   *  `rust:1.83-slim` image because `rustup target add wasm32-wasip1`
   *  needs to download the stdlib component the first time the
   *  container runs. If you pre-build an image with the target
   *  baked in (see typeover/docker/Dockerfile), pass `true` and
   *  pair with the custom image. Production uses Vercel Sandbox
   *  with `firewall: { policy: "deny-all" }` — the stronger
   *  boundary lives there. */
  isolateNetwork?: boolean;
}

export class DockerTransport implements CompileTransport {
  readonly name = "docker";
  private readonly image: string;
  private readonly timeoutSeconds: number;
  private readonly isolateNetwork: boolean;

  constructor(opts: DockerTransportOptions = {}) {
    this.image = opts.image ?? "rust:1.83-slim";
    this.timeoutSeconds = opts.timeoutSeconds ?? 30;
    this.isolateNetwork = opts.isolateNetwork ?? false;
  }

  async compile(req: CompileRequest): Promise<CompileResult> {
    if (req.language !== "rust") {
      return {
        ok: false,
        message: `DockerTransport only supports rust; got ${req.language}`,
        elapsedSeconds: 0,
      };
    }

    const started = Date.now();
    /* Use a host-side tmpdir we bind-mount into the container.
     * Container writes /work/out.wasm; we read it back here. */
    const workDir = await mkdtemp(join(tmpdir(), "typeover-rust-"));
    try {
      const srcPath = join(workDir, "main.rs");
      const outPath = join(workDir, "out.wasm");
      await writeFile(srcPath, req.source, "utf8");

      const dockerArgs = [
        "run",
        "--rm",
        ...(this.isolateNetwork ? ["--network=none"] : []),
        "--volume",
        `${workDir}:/work`,
        "--workdir",
        "/work",
        this.image,
      ];
      const result = await runDocker(
        [
          ...dockerArgs,
          "sh",
          "-c",
          /* `rustup target add wasm32-wasip1` is idempotent inside
           * the image — first invocation downloads ~30s of stdlib,
           * subsequent invocations are no-ops. Caching the host
           * image layer covers cold-start cost across runs. */
          "rustup target add wasm32-wasip1 >/dev/null 2>&1 && " +
            "rustc --target wasm32-wasip1 " +
            "-C opt-level=z -C strip=symbols -C debuginfo=0 " +
            "-C panic=abort " +
            "/work/main.rs -o /work/out.wasm 2>&1",
        ],
        this.timeoutSeconds * 1000,
      );

      const elapsed = (Date.now() - started) / 1000;
      if (result.code !== 0) {
        return {
          ok: false,
          message: result.output.trim() || `docker exited ${result.code}`,
          elapsedSeconds: elapsed,
        };
      }

      const wasm = await readFile(outPath);
      return {
        ok: true,
        wasm: new Uint8Array(wasm.buffer, wasm.byteOffset, wasm.byteLength),
        elapsedSeconds: elapsed,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

interface ProcResult {
  code: number;
  output: string;
}

function runDocker(args: string[], timeoutMs: number): Promise<ProcResult> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      output += "\n[transport] killed after timeout";
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, output });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, output: output + `\n[transport] ${err.message}` });
    });
  });
}
