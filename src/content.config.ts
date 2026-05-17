import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { GeneratorSchema } from "~/lib/generator";

/*
 * Content collections for typeover. All target-aware (currently "go"
 * only). Paths are flat within each collection; IDs reflect filesystem
 * hierarchy so URLs can mirror the curriculum tree.
 *
 * The generator schema is owned by src/lib/generator.ts so the runtime
 * and the content-validation layer can never drift.
 */

const target = z.literal("go"); // future: z.enum(["go", "rust", ...])

const moduleCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/modules" }),
  schema: z.object({
    target,
    title: z.string(),
    summary: z.string(),
    order: z.number().int().positive(),
  }),
});

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

const exerciseCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/exercises" }),
  schema: z.object({
    target,
    themeId: z.string(),
    type: z.enum(["mcq", "fill-word", "fill-line", "freeform"]),
    order: z.number().int().positive(),
    prompt: z.string(),
    generator: GeneratorSchema,
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
