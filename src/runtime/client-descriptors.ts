import type { Target } from "~/lib/content-schema";
import type { WorkerEvalResult } from "./types";
import {
  getRunner,
  getRustRunner,
  getZigRunner,
  terminateRunner,
  terminateRustRunner,
  terminateZigRunner,
} from "./index";

/** Client-side runtimes the hook actually drives. Each maps to a
 *  descriptor in `CLIENT_RUNTIME_DESCRIPTORS` below.
 *
 *  `rust` is the server-compile path — the worker POSTs source to
 *  /api/compile/rust and runs the returned wasm. From the hook's
 *  perspective the API surface is identical to a fully-local
 *  runtime; the SW intercepting that POST is the cache-aware part. */
export type ClientRuntime = "yaegi" | "zig" | "rust";

/** Wider runtime set the hook *accepts* — includes `"server"` as a
 *  schema-level placeholder for compile-routes that don't yet have
 *  a client-side worker (e.g. server-compile Go). The hook returns
 *  `canRun: false` for `"server"` and the consumer gates on it.
 *  The (target=rust, runtime=server) combo is reshaped to
 *  `runtime: "rust"` at the page boundary before reaching the
 *  hook. */
export type AcceptedRuntime = ClientRuntime | "server";

interface ClientRuntimeDescriptor {
  target: Target;
  label: string;
  get: () => {
    ready(): Promise<void>;
    eval(code: string): Promise<WorkerEvalResult>;
  };
  terminate: () => void;
}

/* One descriptor per client runtime — all the per-language wiring
 * collapses to a single row. Adding a fourth runtime is one entry
 * in this table; the hook body stays branch-free.
 *
 * - `target` drives the handle's `runtimeTarget` field plus the
 *   curriculum-target lookups (CodeMirror grammar, scaffold).
 * - `label` is the human-facing string (boot badge).
 * - `get` / `terminate` are the lazy worker singletons from
 *   src/runtime/index.ts.
 */
/* Per-runtime display labels. Duplicates the `LANG_DISPLAY` table
 * in `~/lib/lang` by value (both are "Go" / "Zig" / "Rust" today).
 * Inlining here keeps `runtime/` value-edge-free into `lib/`, so the
 * subsystem cycle the seam audit flagged is broken at the bundler
 * level. If you add a fourth language, update both tables — the
 * `Target` type-only import below ensures the typecheck catches a
 * missing descriptor row, but it cannot enforce label-string parity.
 *
 * If three places ever end up out of sync, lift LANG_DISPLAY into
 * a shared `src/types/lang.ts` that both `lib/` and `runtime/`
 * import from. Not justified at three entries. */
const LABEL_BY_RUNTIME = {
  yaegi: "Go",
  zig: "Zig",
  rust: "Rust",
} as const satisfies Record<ClientRuntime, string>;

export const CLIENT_RUNTIME_DESCRIPTORS: Record<ClientRuntime, ClientRuntimeDescriptor> = {
  yaegi: {
    target: "go",
    label: LABEL_BY_RUNTIME.yaegi,
    get: getRunner,
    terminate: terminateRunner,
  },
  zig: {
    target: "zig",
    label: LABEL_BY_RUNTIME.zig,
    get: getZigRunner,
    terminate: terminateZigRunner,
  },
  rust: {
    target: "rust",
    label: LABEL_BY_RUNTIME.rust,
    get: getRustRunner,
    terminate: terminateRustRunner,
  },
};

/** Map an `AcceptedRuntime` (which includes the `"server"`
 *  placeholder) to its curriculum target. Lets consumers thread
 *  the right target/scaffold without re-deriving the mapping in
 *  every freeform-like site. The `"server"` runtime resolves to
 *  Go today as a placeholder — that branch never actually runs
 *  (`canRun` is false), and the page boundary reshapes Rust's
 *  (target=rust, runtime=server) into runtime="rust" upstream of
 *  the hook. */
export function runtimeToTarget(runtime: AcceptedRuntime): Target {
  if (runtime === "server") return "go";
  return CLIENT_RUNTIME_DESCRIPTORS[runtime].target;
}
