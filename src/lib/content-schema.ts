import { z } from "zod";
import { GeneratorSchema } from "./generator-schema";
import {
  validateFillBlanks,
  validateFillLineMode,
  validateMcqDistractors,
  validateSourceScope,
  validateBlanksOnlyForFill,
  validateRunnableExpectStdout,
  validateFillLineOnlyField,
  validateFillLineAttemptTemplateRefs,
  validateSubmissionShapeScope,
} from "./content-schema-validators";

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

export const exerciseFields = {
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

export const exerciseSchema = z.object(exerciseFields).superRefine((ex, ctx) => {
  validateFillBlanks(ex, ctx);
  validateFillLineMode(ex, ctx);
  validateMcqDistractors(ex, ctx);
  validateSourceScope(ex, ctx);
  validateBlanksOnlyForFill(ex, ctx);
  validateRunnableExpectStdout(ex, ctx);
  validateFillLineOnlyField(ex, ctx, "alternateCanonicals", ex.alternateCanonicals);
  validateFillLineOnlyField(ex, ctx, "acceptedAnswers", ex.acceptedAnswers);
  validateFillLineOnlyField(ex, ctx, "knownAttempts", ex.knownAttempts);
  validateFillLineAttemptTemplateRefs(ex, ctx);
  validateSubmissionShapeScope(ex, ctx);
});
