import { z } from "zod";
import { GeneratorSchema } from "./generator";

/*
 * Plain-Zod content schemas. Kept out of `content.config.ts` so vitest
 * can test cross-field refinements without depending on `astro:content`.
 * content.config.ts wraps each one in `defineCollection`.
 *
 * Per design-docs/09 — these are the single source of truth for
 * exercise / theme / module shape. Edit here, never elsewhere.
 */

export const targetSchema = z.literal("go"); // future: z.enum(["go", "rust", ...])

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
  type: z.enum(["mcq", "fill-word", "fill-line", "freeform"]),
  order: z.number().int().positive(),
  prompt: z.string(),
  generator: GeneratorSchema,
  /** For fill-word / fill-line: which template vars to render as
   *  input slots instead of substituted text. Required (non-empty)
   *  when `type` is fill-word or fill-line; rejected for other
   *  types via the cross-field refinements below. */
  blanks: z.array(z.string()).optional(),
  hints: z.tuple([z.string(), z.string(), z.string()]),
  runtime: z.enum(["yaegi", "server", "none"]).default("none"),
  notes: z.string().optional(),
  /** Freeform exercises: the exact stdout we expect from running the
   *  learner's `package main`. Also opts a fill-line exercise into
   *  the input+Yaegi UX (see validateFillLineMode below). */
  expectStdout: z.string().optional(),
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
 *  template generator. Without this the component falls into the
 *  iter-4/6 vacuous-truth guard and renders an un-submittable
 *  exercise — catch at content-config time, not runtime. */
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

/** fill-line has TWO UX modes, distinguished by whether
 *  `expectStdout` is set:
 *
 *    MODE A (tile picker — legacy): no expectStdout. The component
 *      renders the picked vars[blank] value + generator.distractors
 *      as candidate tiles. distractors must be non-empty.
 *
 *    MODE B (input + Yaegi grading — the redesign): expectStdout
 *      present. The component renders a single line input; on Submit
 *      we substitute the user's text into the canonical, run via
 *      Yaegi, and check stdout matches expectStdout. runtime must
 *      be "yaegi" (server fallback isn't wired yet). distractors
 *      stay valid but optional — repurposable as a known-wrong-
 *      pattern bank for targeted feedback later. */
function validateFillLineMode(ex: Exercise, ctx: Ctx): void {
  if (ex.type !== "fill-line" || ex.generator.kind !== "template") return;
  if (ex.expectStdout !== undefined) {
    if (ex.runtime !== "yaegi") {
      ctx.addIssue({
        code: "custom",
        message: 'fill-line with `expectStdout` (input+Yaegi grading) requires `runtime: "yaegi"`.',
        path: ["runtime"],
      });
    }
    return;
  }
  /* MODE A — legacy tile picker. */
  if (!ex.generator.distractors || ex.generator.distractors.length === 0) {
    ctx.addIssue({
      code: "custom",
      message:
        "fill-line requires either `expectStdout` (input+Yaegi grading) or `generator.distractors` (legacy tile picker). Add one or the other.",
      path: ["generator", "distractors"],
    });
  }
}

/** MCQ exercises must have distractors in the generator — without
 *  them the option list collapses to one entry and the exercise
 *  renders as a single-option "quiz". */
function validateMcqDistractors(ex: Exercise, ctx: Ctx): void {
  if (ex.type !== "mcq") return;
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
 *  other than freeform / fill-line is meaningless (the fill-line
 *  opt-in to MODE B is handled by validateFillLineMode). */
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
        message: 'Freeform exercises need `runtime: "yaegi"` or `runtime: "server"`.',
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

export const exerciseSchema = z.object(exerciseFields).superRefine((ex, ctx) => {
  validateFillBlanks(ex, ctx);
  validateFillLineMode(ex, ctx);
  validateMcqDistractors(ex, ctx);
  validateBlanksOnlyForFill(ex, ctx);
  validateRunnableExpectStdout(ex, ctx);
});
