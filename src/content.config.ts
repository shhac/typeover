import { defineCollection, z, reference } from "astro:content";
import { glob } from "astro/loaders";

/*
 * Content collections for typeover. All target-aware (currently "go"
 * only). Paths are flat within each collection; IDs reflect filesystem
 * hierarchy so URLs can mirror the curriculum tree.
 */

const target = z.literal("go"); // future: z.enum(["go", "rust", ...])

/* ---------- Modules ---------- */

const moduleCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/modules" }),
  schema: z.object({
    target,
    title: z.string(),
    summary: z.string(),
    order: z.number().int().positive(),
  }),
});

/* ---------- Themes ---------- */

const themeCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/themes" }),
  schema: z.object({
    target,
    moduleId: z.string(),
    title: z.string(),
    intro: z.string(),
    order: z.number().int().positive(),
    prerequisites: z.array(z.string()).default([]),
  }),
});

/* ---------- Exercises ---------- */

/*
 * Generator specs. The "template" kind is implemented in v0;
 * variant + procedural land alongside their first author needs.
 */
const TemplateGenerator = z.object({
  kind: z.literal("template"),
  /** Map of variable name to value pool. Generator picks one from each. */
  vars: z.record(z.string(), z.array(z.string())),
  /** TS snippet shown in the prompt, with ${name} placeholders. */
  ts: z.string(),
  /** Idiomatic Go answer template, with same placeholders. */
  canonical: z.string(),
  /**
   * MCQ-specific: distractor templates. Each uses the same vars as the
   * canonical so the *only* meaningful difference is the syntax under
   * test.
   */
  distractors: z.array(z.string()).optional(),
});

const VariantGenerator = z.object({
  kind: z.literal("variant"),
  variants: z.array(
    z.object({
      id: z.string(),
      ts: z.string(),
      canonical: z.string(),
      distractors: z.array(z.string()).optional(),
    }),
  ),
});

const ProceduralGenerator = z.object({
  kind: z.literal("procedural"),
  /** Module path relative to the exercise file. Must export `generate(seed)`. */
  module: z.string(),
});

const Generator = z.discriminatedUnion("kind", [
  TemplateGenerator,
  VariantGenerator,
  ProceduralGenerator,
]);

const exerciseCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/exercises" }),
  schema: z.object({
    target,
    themeId: z.string(),
    type: z.enum(["mcq", "fill-word", "fill-line", "freeform"]),
    order: z.number().int().positive(),
    prompt: z.string(),
    generator: Generator,
    hints: z.tuple([z.string(), z.string(), z.string()]),
    runtime: z.enum(["yaegi", "server", "none"]).default("none"),
    notes: z.string().optional(),
  }),
});

export const collections = {
  modules: moduleCollection,
  themes: themeCollection,
  exercises: exerciseCollection,
};
