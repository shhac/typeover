import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { exerciseSchema, moduleSchema, themeSchema } from "~/lib/content-schema";

/*
 * Astro content-collection bindings. Schemas live in
 * `~/lib/content-schema` so vitest can exercise cross-field
 * refinements without pulling in `astro:content` at test time.
 */

const moduleCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/modules" }),
  schema: moduleSchema,
});

const themeCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/themes" }),
  schema: themeSchema,
});

const exerciseCollection = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/exercises" }),
  schema: exerciseSchema,
});

export const collections = {
  modules: moduleCollection,
  themes: themeCollection,
  exercises: exerciseCollection,
};
