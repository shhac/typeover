import type { Target } from "./content-schema";

/*
 * SubmissionShape — bookend constraints on a freeform submission.
 *
 * Two purposes:
 *   1. Catch the "I deleted the main wrapper" failure mode at
 *      grade time with a friendly hint, instead of letting it
 *      reach the compiler / runtime as an opaque error.
 *   2. Save Sandbox CPU on obviously broken submissions — the
 *      pre-check happens before we POST the source to the
 *      compile-service, so an empty editor or a learner who
 *      accidentally erased `fn main` never burns a compile.
 *
 * Language defaults live below; an exercise can override either
 * end via the `submissionShape` field on its YAML — useful for
 * teaching that involves changing the wrapper (e.g. an exercise
 * that asks the learner to add a specific `use` statement).
 *
 * design-docs/32.
 */

export interface SubmissionShape {
  /** After trimming leading/trailing whitespace, the submission
   *  must start with this. Empty / undefined disables the check. */
  mustStartWith?: string;
  /** After trimming leading/trailing whitespace, the submission
   *  must end with this. Empty / undefined disables the check. */
  mustEndWith?: string;
}

/* Language defaults. Picked to catch the "no wrapper" case
 * without being so specific they reject valid alternative
 * structures (e.g. helper functions before main). */
export const LANGUAGE_SUBMISSION_SHAPE: Record<Target, SubmissionShape> = {
  go: { mustStartWith: "package main", mustEndWith: "}" },
  zig: { mustStartWith: "const std", mustEndWith: "}" },
  rust: { mustStartWith: "fn main", mustEndWith: "}" },
};

/** Resolve the effective shape for a freeform submission by
 *  layering an exercise-level override on top of the language
 *  default. Either end can be overridden independently; setting
 *  it to `""` explicitly disables that check. */
export function resolveSubmissionShape(
  target: Target,
  override: SubmissionShape | undefined,
): SubmissionShape {
  const base = LANGUAGE_SUBMISSION_SHAPE[target];
  if (!override) return base;
  return {
    mustStartWith: override.mustStartWith ?? base.mustStartWith,
    mustEndWith: override.mustEndWith ?? base.mustEndWith,
  };
}

export interface ShapeValidation {
  ok: boolean;
  /** Empty when ok. Otherwise a learner-facing one-line hint
   *  about what the submission is missing. */
  message: string;
}

const SHAPE_OK: ShapeValidation = { ok: true, message: "" };

/** Validate that `source` starts and ends with the required
 *  bookends, after trimming whitespace. Empty bookends are
 *  no-ops. Returns the first failure found (start before end). */
export function validateSubmissionShape(
  source: string,
  shape: SubmissionShape,
): ShapeValidation {
  const trimmed = source.trim();
  if (trimmed === "") {
    return {
      ok: false,
      message: "Your program is empty. Write something to Run.",
    };
  }
  const head = shape.mustStartWith;
  if (typeof head === "string" && head !== "" && !trimmed.startsWith(head)) {
    return {
      ok: false,
      message: `Your program should start with \`${head}\`.`,
    };
  }
  const tail = shape.mustEndWith;
  if (typeof tail === "string" && tail !== "" && !trimmed.endsWith(tail)) {
    return {
      ok: false,
      message: `Your program should end with \`${tail}\`.`,
    };
  }
  return SHAPE_OK;
}

/* Per-target default scaffold the freeform editor seeds with.
 * Pairs with the submission-shape defaults above: the scaffold
 * is shaped so a learner who hits Run without editing produces
 * something that at least passes the bookend checks. */
export const LANGUAGE_FREEFORM_SCAFFOLD: Record<Target, string> = {
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n\t// implement here\n\t_ = fmt.Println\n}\n`,
  zig: `const std = @import("std");\n\npub fn main(init: std.process.Init) !void {\n    // implement here\n    _ = init;\n}\n`,
  rust: `fn main() {\n    // implement here\n}\n`,
};
