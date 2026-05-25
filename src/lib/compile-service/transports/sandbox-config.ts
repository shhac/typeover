/*
 * Shared Rust toolchain configuration consumed by:
 *   - SandboxTransport (production /api/compile/rust path)
 *   - scripts/bootstrap-rust-sandbox.ts (pool pre-warmer)
 *   - DockerTransport (local-dev prebake)
 *
 * Toolchain bumps or allowlist additions land here once, not three
 * times. Per design-docs/32.
 */

/** Vercel Sandbox runtime image. The Sandbox itself never runs
 *  Node code — `rustc` is the workload — but the runtime selects
 *  the underlying microVM base. Node 24 is the v2.x SDK default
 *  and matches the project's broader Node-24 preference. */
export const RUST_RUNTIME = "node24";

/** Egress allowlist for the production Sandbox. Only the Rust
 *  toolchain hosts the `onCreate` install reaches out to — rustc
 *  itself runs offline. Adding a new host (e.g. a cargo registry
 *  mirror) lands in one place. */
export const RUST_SANDBOX_NETWORK_ALLOW: readonly string[] = [
  "*.rust-lang.org",
  "static.rust-lang.org",
  "sh.rustup.rs",
  "static.crates.io",
  "*.crates.io",
];

/** Shell command to install rustup + the wasm32-wasip1 target on
 *  a fresh sandbox or docker container. Returns the cmd + args
 *  pair so callers can hand it to either `sandbox.runCommand` or
 *  `child_process.spawn` without re-typing. */
export function rustInstallCommand(): { cmd: string; args: string[] } {
  return {
    cmd: "bash",
    args: [
      "-lc",
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs " +
        "| sh -s -- -y --default-toolchain stable -t wasm32-wasip1 " +
        "--profile minimal",
    ],
  };
}

/** rustc invocation that produces the wasm32-wasip1 binary we ship
 *  to learners. Optimization flags drop debug info + symbols (the
 *  typical canonical solution is ~50 KB), and `panic=abort` keeps
 *  the wasm self-contained without an unwinder. */
export function rustcCompileArgs(srcPath: string, outPath: string): string[] {
  return [
    "--target",
    "wasm32-wasip1",
    "-C",
    "opt-level=z",
    "-C",
    "strip=symbols",
    "-C",
    "debuginfo=0",
    "-C",
    "panic=abort",
    srcPath,
    "-o",
    outPath,
  ];
}
