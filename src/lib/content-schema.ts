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

export const exerciseSchema = z
  .object({
    target: targetSchema,
    themeId: z.string(),
    type: z.enum(["mcq", "fill-word", "fill-line", "freeform"]),
    order: z.number().int().positive(),
    prompt: z.string(),
    generator: GeneratorSchema,
    /** For fill-word / fill-line: which template vars to render as
     *  input slots instead of substituted text. Required (non-empty)
     *  when `type` is fill-word or fill-line; rejected for other
     *  types via the cross-field refinement below. */
    blanks: z.array(z.string()).optional(),
    hints: z.tuple([z.string(), z.string(), z.string()]),
    runtime: z.enum(["yaegi", "server", "none"]).default("none"),
    notes: z.string().optional(),
    /** Freeform exercises: the exact stdout we expect from running the
     *  learner's `package main`. Required for `type: freeform`, rejected
     *  for other types via the cross-field refinement below. v0 is
     *  exact-string match; whitespace / trailing-newline normalisation
     *  is a follow-up if authors find it too strict. */
    expectStdout: z.string().optional(),
  })
  .superRefine((ex, ctx) => {
    /* fill-word / fill-line must declare which template vars render
     * as input slots. Without this the component falls into the
     * iter-4/6 vacuous-truth guard and renders an un-submittable
     * exercise. Catch it at content-config time, not runtime. */
    if (ex.type === "fill-word" || ex.type === "fill-line") {
      if (!ex.blanks || ex.blanks.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `Exercise type "${ex.type}" requires a non-empty \`blanks\` array.`,
          path: ["blanks"],
        });
      } else if (ex.generator.kind !== "template") {
        /* Today only template generators produce blankSegments
         * (generateVariant throws on `blanks` with length > 0). */
        ctx.addIssue({
          code: "custom",
          message: `Exercise type "${ex.type}" requires a template generator (got "${ex.generator.kind}").`,
          path: ["generator", "kind"],
        });
      } else {
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
    }
    /* fill-line shows a tile picker — the candidates are the blank's
     * substituted value (the correct tile) PLUS generator.distractors
     * (the wrong tiles). Without distractors the tile pool is just
     * the one correct option, which renders as a trivial single-tile
     * "quiz". Catch the misauthoring at build time.
     *
     * fill-word is NOT subject to this rule — it's a free-text input,
     * not a picker. */
    if (ex.type === "fill-line" && ex.generator.kind === "template") {
      if (!ex.generator.distractors || ex.generator.distractors.length === 0) {
        ctx.addIssue({
          code: "custom",
          message:
            "fill-line exercises require `generator.distractors` (the wrong-tile pool). Add the alternative lines there; keep `vars.<blank>` for the correct line only.",
          path: ["generator", "distractors"],
        });
      }
    }
    /* MCQ exercises must have distractors in the generator —
     * without them the option list collapses to one entry and the
     * exercise renders as a single-option "quiz". */
    if (ex.type === "mcq") {
      if (ex.generator.kind === "template") {
        if (!ex.generator.distractors || ex.generator.distractors.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "MCQ template generator requires non-empty `distractors`.",
            path: ["generator", "distractors"],
          });
        }
      } else if (ex.generator.kind === "variant") {
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
    /* `blanks` on a non-fill exercise is meaningless and probably an
     * authoring mistake — e.g. MCQ accidentally inheriting blanks
     * from a copy-pasted template. */
    if (ex.blanks && ex.blanks.length > 0 && ex.type !== "fill-word" && ex.type !== "fill-line") {
      ctx.addIssue({
        code: "custom",
        message: `\`blanks\` is only valid for fill-word / fill-line; got type "${ex.type}".`,
        path: ["blanks"],
      });
    }
    /* Freeform requires expectStdout — without it Submit has no oracle
     * and the exercise can't grade. Conversely, expectStdout on a
     * non-freeform exercise is meaningless. */
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
    } else if (ex.expectStdout !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: `\`expectStdout\` is only valid for freeform exercises; got type "${ex.type}".`,
        path: ["expectStdout"],
      });
    }
  });
