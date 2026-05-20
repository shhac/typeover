/*
 * Barrel re-exporting the two halves of the exercise-generator
 * module — schemas (build-time validation) and runtime (per-seed
 * instance construction). design-docs/20 FW-2.
 *
 * The split lets `content-schema.ts` import only the Zod schemas
 * and lets the four exercise-component islands pull only the
 * runtime types / functions, while preserving the existing
 * `import { ... } from "~/lib/generator"` surface every consumer
 * already uses. New code with stronger conceptual coupling can
 * import the more specific file directly:
 *
 *   import { GeneratorSchema } from "~/lib/generator-schema";
 *   import { generate, type ExerciseInstance } from "~/lib/generator-runtime";
 */

export * from "./generator-schema";
export * from "./generator-runtime";
