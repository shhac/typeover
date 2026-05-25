import type { z } from "zod";
import { extractTemplateVars } from "./generator-schema";
import type { exerciseFields } from "./content-schema";

type Exercise = z.infer<z.ZodObject<typeof exerciseFields>>;
type Ctx = z.RefinementCtx;

const FILL_LINE_RUNTIMES = ["yaegi", "zig", "server"] as const;

export function validateFillBlanks(ex: Exercise, ctx: Ctx): void {
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
    ctx.addIssue({
      code: "custom",
      message: `Exercise type "${ex.type}" requires a template generator (got "${ex.generator.kind}").`,
      path: ["generator", "kind"],
    });
    return;
  }
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

export function validateFillLineMode(ex: Exercise, ctx: Ctx): void {
  if (ex.type !== "fill-line" || ex.generator.kind !== "template") return;
  if (ex.expectStdout === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "fill-line exercises require `expectStdout` (the stdout to match against).",
      path: ["expectStdout"],
    });
    return;
  }
  if (!(FILL_LINE_RUNTIMES as readonly string[]).includes(ex.runtime)) {
    ctx.addIssue({
      code: "custom",
      message: `fill-line exercises require a client-side runtime (one of: ${FILL_LINE_RUNTIMES.map((r) => `"${r}"`).join(", ")}).`,
      path: ["runtime"],
    });
  }
}

export function validateMcqDistractors(ex: Exercise, ctx: Ctx): void {
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

export function validateBlanksOnlyForFill(ex: Exercise, ctx: Ctx): void {
  if (!ex.blanks || ex.blanks.length === 0) return;
  if (ex.type === "fill-word" || ex.type === "fill-line") return;
  ctx.addIssue({
    code: "custom",
    message: `\`blanks\` is only valid for fill-word / fill-line; got type "${ex.type}".`,
    path: ["blanks"],
  });
}

export function validateRunnableExpectStdout(ex: Exercise, ctx: Ctx): void {
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

export function validateFillLineOnlyField(
  ex: Exercise,
  ctx: Ctx,
  fieldName: string,
  value: unknown[] | undefined,
): void {
  if (!value || value.length === 0) return;
  if (ex.type === "fill-line") return;
  ctx.addIssue({
    code: "custom",
    message: `\`${fieldName}\` is only valid for fill-line exercises; got type "${ex.type}".`,
    path: [fieldName],
  });
}

export function validateFillLineAttemptTemplateRefs(ex: Exercise, ctx: Ctx): void {
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

export function validateSubmissionShapeScope(ex: Exercise, ctx: Ctx): void {
  if (!ex.submissionShape) return;
  if (ex.type === "freeform") return;
  ctx.addIssue({
    code: "custom",
    message: `\`submissionShape\` is only valid for freeform exercises; got type "${ex.type}".`,
    path: ["submissionShape"],
  });
}

export function validateSourceScope(ex: Exercise, ctx: Ctx): void {
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
