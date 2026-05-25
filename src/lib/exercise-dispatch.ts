/*
 * Type-safe dispatch helper for the exercise route.
 *
 * The Astro page at `src/pages/[lang]/[module]/[theme]/[index].astro`
 * renders one of four Solid components based on `ex.type`. The
 * conditional ladder used to be four naked
 * `{ex.type === "..." && (...)}` clauses with no exhaustiveness
 * check — adding a fifth exercise type to the schema would ship
 * silently. This helper turns the discriminator into a
 * `{ kind, ...props }` tagged union with an `assertUnreachable`
 * default, and lifts the page-boundary `runtime` reshape out of
 * JSX into a named function.
 *
 * Per design-docs/32 (which introduced the (target=rust,
 * runtime=server) reshape) and design-docs/31's exercise-type
 * dispatch finding.
 */

import { assertUnreachable } from "./assert-unreachable";
import type { AcceptedAnswer, KnownAttempt } from "./fill-line-attempts";
import type { SubmissionShape } from "./freeform-shape";

/* Shape of the data the page hands us. The Astro file's `ex` is
 * typed via Astro's content-collection inference; we re-declare
 * the minimum surface we read so this helper is decoupled and
 * unit-testable without dragging the `astro:content` module in. */
interface ExerciseInput {
  type: "mcq" | "fill-word" | "fill-line" | "freeform";
  target: "go" | "zig" | "rust";
  runtime: "yaegi" | "zig" | "server" | "none";
  expectStdout?: string;
  blanks?: string[];
  alternateCanonicals?: string[];
  acceptedAnswers?: AcceptedAnswer[];
  knownAttempts?: KnownAttempt[];
  submissionShape?: SubmissionShape;
}

type FreeformRuntime = "yaegi" | "zig" | "rust" | "server";
type FillLineRuntime = "yaegi" | "zig" | "rust";

interface DispatchMcq {
  kind: "mcq";
}
interface DispatchFillWord {
  kind: "fill-word";
  blanks: string[];
}
interface DispatchFillLine {
  kind: "fill-line";
  blanks: string[];
  runtime: FillLineRuntime;
  expectStdout: string;
  alternateCanonicals?: string[];
  acceptedAnswers?: AcceptedAnswer[];
  knownAttempts?: KnownAttempt[];
}
interface DispatchFreeform {
  kind: "freeform";
  runtime: FreeformRuntime;
  expectStdout: string;
  submissionShape?: SubmissionShape;
}
/** Exercise that the page should silently skip — typically a
 *  freeform/fill-line authored without the expected runtime or
 *  oracle. Different from "unknown type" — that's the
 *  unreachable default. */
interface DispatchSkip {
  kind: "skip";
  reason: string;
}

export type ExerciseDispatch =
  | DispatchMcq
  | DispatchFillWord
  | DispatchFillLine
  | DispatchFreeform
  | DispatchSkip;

/* Resolve the runtime a freeform component should receive.
 *
 * The schema's `runtime: "server"` is a placeholder for compile
 * routes that don't have a client-side worker — but for Rust we
 * DO have a worker (it proxies to /api/compile/rust). Reshape
 * the (target=rust, runtime=server) combo at the page boundary
 * so Freeform's runtime prop is concrete. Other (server, *)
 * combos pass through; Freeform disables Run for them via
 * `canRun`.
 *
 * The `"none"` case is handled by the caller in
 * `pickExerciseDispatch` before this helper is invoked, so the
 * Freeform-runtime union doesn't need to include `"none"`. */
function resolveFreeformRuntime(ex: ExerciseInput): FreeformRuntime {
  if (ex.target === "rust" && ex.runtime === "server") return "rust";
  if (ex.runtime === "none") {
    /* Defensive — unreachable under the dispatcher's gating. */
    return "server";
  }
  return ex.runtime;
}

/** Turn an exercise content entry into a typed dispatch token.
 *  The Astro page then switches on `kind` and renders the right
 *  Solid component with the typed props attached. */
export function pickExerciseDispatch(ex: ExerciseInput): ExerciseDispatch {
  switch (ex.type) {
    case "mcq":
      return { kind: "mcq" };
    case "fill-word":
      return { kind: "fill-word", blanks: ex.blanks ?? [] };
    case "fill-line": {
      if (ex.expectStdout === undefined) {
        return { kind: "skip", reason: "fill-line missing expectStdout" };
      }
      /* Reshape (target=rust, runtime=server) → "rust" at the
       * page boundary, mirroring the freeform path. The FillLine
       * component drives the same useRuntimeRun hook as Freeform;
       * accepts the concrete client-side runtime ids. */
      const fillLineRuntime: FillLineRuntime | null =
        ex.target === "rust" && ex.runtime === "server"
          ? "rust"
          : ex.runtime === "yaegi" || ex.runtime === "zig"
            ? ex.runtime
            : null;
      if (!fillLineRuntime) {
        return {
          kind: "skip",
          reason: `fill-line requires yaegi/zig/rust runtime, got ${ex.runtime} (target=${ex.target})`,
        };
      }
      return {
        kind: "fill-line",
        blanks: ex.blanks ?? [],
        runtime: fillLineRuntime,
        expectStdout: ex.expectStdout,
        alternateCanonicals: ex.alternateCanonicals,
        acceptedAnswers: ex.acceptedAnswers,
        knownAttempts: ex.knownAttempts,
      };
    }
    case "freeform": {
      if (ex.expectStdout === undefined) {
        return { kind: "skip", reason: "freeform missing expectStdout" };
      }
      if (ex.runtime === "none") {
        return { kind: "skip", reason: "freeform requires a non-`none` runtime" };
      }
      return {
        kind: "freeform",
        runtime: resolveFreeformRuntime(ex),
        expectStdout: ex.expectStdout,
        submissionShape: ex.submissionShape,
      };
    }
    default:
      /* Widening the schema's `type` enum without a matching
       * case fails typecheck here. */
      return assertUnreachable(ex.type);
  }
}
