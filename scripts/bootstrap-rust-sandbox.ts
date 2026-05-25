/*
 * Pre-warm the Rust compiler sandbox pool.
 *
 * Runs `Sandbox.getOrCreate` once per pool shard against the
 * `rust-compiler-pool-N` names the SandboxTransport rotates over.
 * First creation triggers the rustup install in `onCreate`; that
 * filesystem state lands in the persistent snapshot the sandbox
 * auto-takes on stop. Subsequent production traffic resumes from
 * snapshot in milliseconds.
 *
 * Run once per Vercel project (or after a Rust toolchain bump).
 * Requires a `.env.local` with the Vercel OIDC token — run
 * `pnpm dlx vercel env pull` first.
 *
 * Usage:
 *   pnpm bootstrap:rust-sandbox          # default pool of 3
 *   POOL_SIZE=5 pnpm bootstrap:rust-sandbox
 *
 * Per design-docs/32.
 */

import { Sandbox } from "@vercel/sandbox";

import {
  RUST_RUNTIME,
  RUST_SANDBOX_NETWORK_ALLOW,
  rustInstallCommand,
} from "../src/lib/compile-service/transports/sandbox-config.ts";

/* Env loading: the npm script runs node with
 * `--env-file-if-exists=.env.local` so `vercel env pull` output is
 * picked up automatically. Inside Vercel's CI the env is already
 * in scope. No dotenv dependency needed. */

const POOL_NAME = process.env.POOL_NAME ?? "rust-compiler-pool";
const POOL_SIZE = Number(process.env.POOL_SIZE ?? "3");

async function warmShard(shardIndex: number): Promise<void> {
  const name = `${POOL_NAME}-${shardIndex}`;
  console.log(`[bootstrap] warming ${name} ...`);
  const started = Date.now();

  let installRan = false;
  const sandbox = await Sandbox.getOrCreate({
    name,
    runtime: RUST_RUNTIME,
    networkPolicy: { allow: [...RUST_SANDBOX_NETWORK_ALLOW] },
    /* Generous one-time install budget. After this run, the
     * sandbox's auto-snapshot captures the toolchain. */
    timeout: 10 * 60 * 1000,
    onCreate: async (sbx) => {
      installRan = true;
      console.log(`  [${name}] fresh sandbox — installing rustup + wasm32-wasip1`);
      /* Run the shared install command, then echo the resulting
       * rustc + target inventory so the bootstrap log shows what
       * the snapshot actually contains. */
      const installArgs = rustInstallCommand().args;
      const cmd = await sbx.runCommand({
        cmd: "bash",
        args: [
          "-lc",
          installArgs[1] +
            " && ~/.cargo/bin/rustc --version " +
            "&& ~/.cargo/bin/rustup target list --installed",
        ],
      });
      if (cmd.exitCode !== 0) {
        const stderr = await cmd.stderr();
        throw new Error(
          `rustup install failed in ${name} (exit ${cmd.exitCode}):\n${stderr}`,
        );
      }
      const stdout = await cmd.stdout();
      console.log(stdout.split("\n").map((l) => `      ${l}`).join("\n"));
    },
  });

  /* Sanity check: ensure rustc is present on resume. If the
   * sandbox was already warm from a previous run, onCreate didn't
   * fire — verify the snapshot still has the toolchain. */
  if (!installRan) {
    const check = await sandbox.runCommand({
      cmd: "bash",
      args: ["-lc", "~/.cargo/bin/rustc --version"],
    });
    if (check.exitCode !== 0) {
      throw new Error(
        `${name} resumed from snapshot but rustc is missing — ` +
          `delete this sandbox and re-run bootstrap`,
      );
    }
    const ver = (await check.stdout()).trim();
    console.log(`  [${name}] already warm · ${ver}`);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  [${name}] ready in ${elapsed}s`);
}

console.log(
  `[bootstrap] pool="${POOL_NAME}" size=${POOL_SIZE} ` +
    `runtime=node24`,
);

for (let i = 0; i < POOL_SIZE; i++) {
  await warmShard(i);
}

console.log(
  `[bootstrap] done · ${POOL_SIZE} shards warm. ` +
    `Production /api/compile/rust will resume these on demand.`,
);
