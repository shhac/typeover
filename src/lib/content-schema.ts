import { z } from "zod";
import { extractTemplateVars, GeneratorSchema } from "./generator-schema";

/*
 * Plain-Zod content schemas. Kept out of `content.config.ts` so vitest
 * can test cross-field refinements without depending on `astro:content`.
 * content.config.ts wraps each one in `defineCollection`.
 *
 * Per design-docs/09 — these are the single source of truth for
 * exercise / theme / module shape. Edit here, never elsewhere.
 */

export const targetSchema = z.enum(["go", "zig", "rust"]);
export type Target = z.infer<typeof targetSchema>;

export const moduleSchema = z.object({
  target: targetSchema,
  title: z.string(),
  summary: z.string(),
  order: z.number().int().positive(),
});

export const themeSchema = z.object({
  target: targetSchema,
  moduleId: z.string(),
  title: z.string(),
  intro: z.string(),
  order: z.number().int().positive(),
  prerequisites: z.array(z.string()).default([]),
});

const exerciseFields = {
  target: targetSchema,
  themeId: z.string(),
  type: z.enum(["mcq", "mcq-explain", "fill-word", "fill-line", "freeform"]),
  order: z.number().int().positive(),
  prompt: z.string(),
  generator: GeneratorSchema,
  /** For fill-word / fill-line: which template vars to render as
   *  input slots instead of substituted text. Required (non-empty)
   *  when `type` is fill-word or fill-line; rejected for other
   *  types via the cross-field refinements below. */
  blanks: z.array(z.string()).optional(),
  hints: z.tuple([z.string(), z.string(), z.string()]),
  runtime: z.enum(["yaegi", "zig", "server", "none"]).default("none"),
  notes: z.string().optional(),
  /** Freeform exercises: the exact stdout we expect from running the
   *  learner's `package main`. Also opts a fill-line exercise into
   *  the input+Yaegi UX (see validateFillLineMode below). */
  expectStdout: z.string().optional(),
  /** Optional disclosure shown alongside the success message when
   *  the runnable canonical is INTENTIONALLY a step behind the
   *  modern idiom (e.g. typeover's Yaegi runtime can't yet run
   *  Go 1.21 generic-stdlib functions like `slices.Sort`, so the
   *  canonical uses `sort.Ints`). Keeps the learner honest about
   *  what they'd write in production. Markdown-inline via
   *  `formatInline`. */
  successNote: z.string().optional(),
  /** Fill-line only: alternative submission strings that grade as
   *  correct even when Yaegi can't run them (e.g. Go 1.21+
   *  generic-stdlib forms our Yaegi build doesn't support yet).
   *  Whitespace-normalised match. When a learner's submission
   *  matches one of these AND Yaegi's stdout check fails, the
   *  grader still passes them — paired with `successNote` so the
   *  UI explains why. */
  alternateCanonicals: z.array(z.string()).optional(),
  /** Fill-line only: exact learner submissions that should be
   *  accepted as correct in addition to the canonical blank value.
   *  Unlike legacy `alternateCanonicals`, entries are structured so
   *  build-time tooling can choose which alternatives to prebake. */
  acceptedAnswers: z
    .array(
      z.object({
        match: z.string(),
        prebake: z.boolean().default(false),
      }),
    )
    .optional(),
  /** Fill-line only: exact learner submissions we know are wrong.
   *  These short-circuit runtime execution and surface an authored
   *  RunResult, preserving the "I ran it" UX without burning a
   *  compile call on a predictable mistake. */
  knownAttempts: z
    .array(
      z.object({
        match: z.string(),
        outcome: z.enum(["does-not-compile", "wrong-output"]),
        stdout: z.string().default(""),
        stderr: z.string().default(""),
        error: z.string().default(""),
        explain: z.string(),
        durationMs: z.number().nonnegative().default(0),
      }),
    )
    .optional(),
  /** Freeform only — bookend constraints on the learner's
   *  submission. After trimming whitespace, the source must
   *  start with `mustStartWith` and end with `mustEndWith` (each
   *  is independent). Catches the "I deleted the main wrapper"
   *  case at grade time with a friendly hint instead of letting
   *  it surface as an opaque compile error, and saves a compile
   *  round-trip on obviously broken submissions. Layers on top
   *  of the per-language default in
   *  `src/lib/freeform-shape.ts` — set either field to override
   *  one end, or both to replace the whole shape (e.g. an
   *  exercise that requires a specific `use` statement). */
  submissionShape: z
    .object({
      mustStartWith: z.string().optional(),
      mustEndWith: z.string().optional(),
    })
    .optional(),
} as const;

type Exercise = z.infer<z.ZodObject<typeof exerciseFields>>;
type Ctx = z.RefinementCtx;

/* ─────────────────────────────────────────────────────────────────
 * Cross-field refinements. Each one is independent and individually
 * testable. The superRefine body below reads as a list of validator
 * calls — adding a new rule is appending one line + one function.
 * ───────────────────────────────────────────────────────────────── */

/** fill-word / fill-line must declare which template vars become
 *  input slots, and each blank must reference a declared var on a
 *  template generator. Without this the component would render an
 *  un-submittable exercise (empty blanks list triggers a
 *  vacuous-truth pass in the all-blanks-filled check) — catch at
 *  content-config time, not runtime. */
function validateFillBlanks(ex: Exercise, ctx: Ctx): void {
  if (ex.type !== "fill-word" && ex.type !== "fill-line") return;
  if (!ex.blanks || ex.blanks.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: `Exercise type "${ex.type}" requires a non-empty \`blanks\` array.`,
      path: ["blanks"],
    });
    return;
  }
  if (ex.generator.kind !== "template") {
    /* Today only template generators produce blankSegments
     * (generateVariant throws on `blanks` with length > 0). */
    ctx.addIssue({
      code: "custom",
      message: `Exercise type "${ex.type}" requires a template generator (got "${ex.generator.kind}").`,
      path: ["generator", "kind"],
    });
    return;
  }
  /* Each blank name must be a declared template var. */
  const declared = new Set(Object.keys(ex.generator.vars));
  ex.blanks.forEach((name, i) => {
    if (!declared.has(name)) {
      ctx.addIssue({
        code: "custom",
        message: `Blank "${name}" is not declared in generator.vars.`,
        path: ["blanks", i],
      });
    }
  });
}

/** fill-line is graded by running the substituted canonical through
 *  a runtime and comparing stdout. Same shape as freeform but with
 *  one blank line of user input embedded in the scaffold.
 *
 *  Requires `expectStdout` (the oracle) and a non-`"none"` runtime.
 *  `"yaegi"` is Go, `"zig"` is Zig, and `"server"` is the Rust
 *  compile-service path (reshaped to runtime=rust at the page
 *  boundary by exercise-dispatch). The legacy MCQ-as-tiles UX was
 *  retired once all fill-line exercises migrated to the input+runtime
 *  UX; the distractors field is kept on the generator schema as a
 *  known-wrong-pattern bank for targeted feedback. */
const FILL_LINE_RUNTIMES = ["yaegi", "zig", "server"] as const;
function validateFillLineMode(ex: Exercise, ctx: Ctx): void {
  if (ex.type !== "fill-line" || ex.generator.kind !== "template") return;
  if (ex.expectStdout === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "fill-line exercises require `expectStdout` (the stdout to match against).",
      path: ["expectStdout"],
    });
    return;
  }
  /* Array.includes on a `readonly` tuple narrows its arg to the
   * tuple's literal-union type, which forces an `as` cast on user
   * input. Widen to `readonly string[]` instead — the cast lands
   * on a known-good literal array rather than learner-supplied
   * runtime data. */
  if (!(FILL_LINE_RUNTIMES as readonly string[]).includes(ex.runtime)) {
    ctx.addIssue({
      code: "custom",
      message: `fill-line exercises require a client-side runtime (one of: ${FILL_LINE_RUNTIMES.map((r) => `"${r}"`).join(", ")}).`,
      path: ["runtime"],
    });
  }
}

/** MCQ exercises must have distractors in the generator — without
 *  them the option list collapses to one entry and the exercise
 *  renders as a single-option "quiz". Applies to both `mcq`
 *  (code-translation answers) and `mcq-explain` (prose
 *  explanation answers) — both flavours share the same shuffled-
 *  options shape. */
function validateMcqDistractors(ex: Exercise, ctx: Ctx): void {
  if (ex.type !== "mcq" && ex.type !== "mcq-explain") return;
  if (ex.generator.kind === "template") {
    if (!ex.generator.distractors || ex.generator.distractors.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "MCQ template generator requires non-empty `distractors`.",
        path: ["generator", "distractors"],
      });
    }
    return;
  }
  if (ex.generator.kind === "variant") {
    ex.generator.variants.forEach((v, i) => {
      if (!v.distractors || v.distractors.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `MCQ variant "${v.id}" requires non-empty \`distractors\`.`,
          path: ["generator", "variants", i, "distractors"],
        });
      }
    });
  }
}

/** `blanks` on a non-fill exercise is meaningless and probably an
 *  authoring mistake — e.g. MCQ accidentally inheriting blanks from
 *  a copy-pasted template. */
function validateBlanksOnlyForFill(ex: Exercise, ctx: Ctx): void {
  if (!ex.blanks || ex.blanks.length === 0) return;
  if (ex.type === "fill-word" || ex.type === "fill-line") return;
  ctx.addIssue({
    code: "custom",
    message: `\`blanks\` is only valid for fill-word / fill-line; got type "${ex.type}".`,
    path: ["blanks"],
  });
}

/** Freeform requires expectStdout AND a non-"none" runtime — without
 *  expectStdout Submit has no oracle, and without a runtime there's
 *  nothing to execute against. Mirror rule: expectStdout on any type
 *  other than freeform / fill-line is meaningless — the fill-line
 *  requirement is enforced separately by validateFillLineMode. */
function validateRunnableExpectStdout(ex: Exercise, ctx: Ctx): void {
  if (ex.type === "freeform") {
    if (ex.expectStdout === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Freeform exercises require `expectStdout` (the stdout to match against).",
        path: ["expectStdout"],
      });
    }
    if (ex.runtime === "none") {
      ctx.addIssue({
        code: "custom",
        message:
          'Freeform exercises need a non-"none" runtime (e.g. `"yaegi"`, `"zig"`, or `"server"`).',
        path: ["runtime"],
      });
    }
    return;
  }
  if (ex.expectStdout !== undefined && ex.type !== "fill-line") {
    ctx.addIssue({
      code: "custom",
      message: `\`expectStdout\` is only valid for freeform or fill-line exercises; got type "${ex.type}".`,
      path: ["expectStdout"],
    });
  }
}

/** `alternateCanonicals` is graded by whitespace-normalised string
 *  match against the learner's typed submission — that only makes
 *  sense on fill-line, which renders ONE input line. MCQ/fill-word
 *  use selection/per-blank grading; freeform compares whole-program
 *  stdout. Reject elsewhere so an author doesn't add the field on
 *  the wrong type and silently see no effect. */
function validateAlternateCanonicalsScope(ex: Exercise, ctx: Ctx): void {
  if (!ex.alternateCanonicals || ex.alternateCanonicals.length === 0) return;
  if (ex.type === "fill-line") return;
  ctx.addIssue({
    code: "custom",
    message: `\`alternateCanonicals\` is only valid for fill-line exercises; got type "${ex.type}".`,
    path: ["alternateCanonicals"],
  });
}

function validateAcceptedAnswersScope(ex: Exercise, ctx: Ctx): void {
  if (!ex.acceptedAnswers || ex.acceptedAnswers.length === 0) return;
  if (ex.type === "fill-line") return;
  ctx.addIssue({
    code: "custom",
    message: `\`acceptedAnswers\` is only valid for fill-line exercises; got type "${ex.type}".`,
    path: ["acceptedAnswers"],
  });
}

function validateKnownAttemptsScope(ex: Exercise, ctx: Ctx): void {
  if (!ex.knownAttempts || ex.knownAttempts.length === 0) return;
  if (ex.type === "fill-line") return;
  ctx.addIssue({
    code: "custom",
    message: `\`knownAttempts\` is only valid for fill-line exercises; got type "${ex.type}".`,
    path: ["knownAttempts"],
  });
}

function validateFillLineAttemptTemplateRefs(ex: Exercise, ctx: Ctx): void {
  if (ex.type !== "fill-line" || ex.generator.kind !== "template") return;
  const declared = new Set(Object.keys(ex.generator.vars));
  const check = (value: string, path: (string | number)[]) => {
    for (const ref of extractTemplateVars(value)) {
      if (!declared.has(ref)) {
        ctx.addIssue({
          code: "custom",
          message: `Template references undeclared var "\${${ref}}".`,
          path,
        });
      }
    }
  };
  ex.acceptedAnswers?.forEach((answer, i) => check(answer.match, ["acceptedAnswers", i, "match"]));
  ex.knownAttempts?.forEach((attempt, i) => check(attempt.match, ["knownAttempts", i, "match"]));
}

/** submissionShape is the bookend contract on a learner's freeform
 *  submission. Only freeform exercises have a learner-supplied
 *  source to constrain — fill-word / fill-line submit single tokens
 *  or lines, and MCQ doesn't submit source at all. */
function validateSubmissionShapeScope(ex: Exercise, ctx: Ctx): void {
  if (!ex.submissionShape) return;
  if (ex.type === "freeform") return;
  ctx.addIssue({
    code: "custom",
    message: `\`submissionShape\` is only valid for freeform exercises; got type "${ex.type}".`,
    path: ["submissionShape"],
  });
}

/** `mcq-explain` differs from `mcq` in what the options ARE:
 *  prose explanations of behaviour rather than code translations.
 *  The generator MAY author a `source:` field — the target-
 *  language code the prompt asks ABOUT. When present, the shell
 *  renders it as a second tab next to the TS reference; when
 *  absent (purely conceptual prose-MCQs), the shell falls back to
 *  TS-only. No structural check needed beyond the MCQ distractor
 *  shape already enforced by `validateMcqDistractors`. */

/** `source` is currently scoped to mcq-explain only. If another
 *  exercise type ever genuinely wants to author target-language
 *  source separately from the canonical, widen this check. Until
 *  then, rejecting the field on other types catches authoring
 *  mistakes early. */
function validateSourceScope(ex: Exercise, ctx: Ctx): void {
  if (ex.type === "mcq-explain") return;
  const has =
    ex.generator.kind === "template"
      ? ex.generator.source !== undefined
      : ex.generator.kind === "variant"
        ? ex.generator.variants.some((v) => v.source !== undefined)
        : false;
  if (has) {
    ctx.addIssue({
      code: "custom",
      message: `generator \`source:\` is only valid for mcq-explain exercises; got type "${ex.type}".`,
      path: ["generator", "source"],
    });
  }
}

export const exerciseSchema = z.object(exerciseFields).superRefine((ex, ctx) => {
  validateFillBlanks(ex, ctx);
  validateFillLineMode(ex, ctx);
  validateMcqDistractors(ex, ctx);
  validateSourceScope(ex, ctx);
  validateBlanksOnlyForFill(ex, ctx);
  validateRunnableExpectStdout(ex, ctx);
  validateAlternateCanonicalsScope(ex, ctx);
  validateAcceptedAnswersScope(ex, ctx);
  validateKnownAttemptsScope(ex, ctx);
  validateFillLineAttemptTemplateRefs(ex, ctx);
  validateSubmissionShapeScope(ex, ctx);
});
