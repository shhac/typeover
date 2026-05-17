import { z } from "zod";
import { pickFrom, rngFromSeed, shuffle } from "./seed";

/*
 * Exercise generators.
 *
 * Schemas live here (single source of truth) and the TS types are
 * z.inferred from them so content.config.ts and runtime never drift.
 *
 * `template` is implemented. `variant` is implemented but unused by
 * v0 content. `procedural` is reserved for the first content that
 * needs it.
 */

/* ---------------- Schemas ---------------- */

const TemplateSpec = z.object({
  kind: z.literal("template"),
  /** Map of variable name to value pool. Generator picks one from each. */
  vars: z.record(z.string(), z.array(z.string())),
  /** TS snippet shown in the prompt, with ${name} placeholders. */
  ts: z.string(),
  /** Idiomatic Go answer template, with the same placeholders. */
  canonical: z.string(),
  /**
   * MCQ-specific: distractor templates. Each uses the same vars as the
   * canonical so the *only* meaningful difference is the syntax under
   * test.
   */
  distractors: z.array(z.string()).optional(),
});

const VariantSpec = z.object({
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

const ProceduralSpec = z.object({
  kind: z.literal("procedural"),
  /** Module path relative to the exercise file. Must export `generate(seed)`. */
  module: z.string(),
});

export const GeneratorSchema = z.discriminatedUnion("kind", [
  TemplateSpec,
  VariantSpec,
  ProceduralSpec,
]);

export type GeneratorSpec = z.infer<typeof GeneratorSchema>;
export type TemplateGenerator = z.infer<typeof TemplateSpec>;
export type VariantGenerator = z.infer<typeof VariantSpec>;

/* ---------------- Runtime ---------------- */

export type ExerciseInstance = {
  /** The TS snippet shown in the prompt. */
  ts: string;
  /** The idiomatic Go answer. */
  canonical: string;
  /** For MCQs: the shuffled option list. `correctIndex` is the index
   *  of the canonical in this list. */
  options?: string[];
  correctIndex?: number;
};

/** ${name} substitution against a value map. Throws on unknown vars. */
function substitute(tmpl: string, values: Record<string, string>): string {
  return tmpl.replace(/\$\{(\w+)\}/g, (_, name) => {
    const v = values[name];
    if (v === undefined) {
      throw new Error(`Template references unknown var \${${name}}`);
    }
    return v;
  });
}

/**
 * Build MCQ options from a canonical answer + distractor list, shuffled
 * deterministically by `rng`. Drops any distractor that renders to the
 * same text as the canonical (silent-correctness bug: clicking a
 * duplicate-text option marked `correct: false` would be told it's
 * wrong while looking identical to the correct one).
 */
function buildShuffledOptions(
  rng: () => number,
  canonical: string,
  distractors: readonly string[],
): { options: string[]; correctIndex: number } {
  const deduped = distractors.filter((d) => d !== canonical);
  const tagged = shuffle(rng, [
    { text: canonical, correct: true },
    ...deduped.map((text) => ({ text, correct: false })),
  ]);
  return {
    options: tagged.map((o) => o.text),
    correctIndex: tagged.findIndex((o) => o.correct),
  };
}

function generateTemplate(
  spec: TemplateGenerator,
  seed: string,
): ExerciseInstance {
  const rng = rngFromSeed(seed);
  const values: Record<string, string> = {};
  for (const [name, pool] of Object.entries(spec.vars)) {
    values[name] = pickFrom(rng, pool);
  }
  const ts = substitute(spec.ts, values);
  const canonical = substitute(spec.canonical, values);

  if (!spec.distractors || spec.distractors.length === 0) {
    return { ts, canonical };
  }
  const renderedDistractors = spec.distractors.map((d) =>
    substitute(d, values),
  );
  return {
    ts,
    canonical,
    ...buildShuffledOptions(rng, canonical, renderedDistractors),
  };
}

function generateVariant(
  spec: VariantGenerator,
  seed: string,
): ExerciseInstance {
  const rng = rngFromSeed(seed);
  const variant = pickFrom(rng, spec.variants);

  if (!variant.distractors || variant.distractors.length === 0) {
    return { ts: variant.ts, canonical: variant.canonical };
  }
  return {
    ts: variant.ts,
    canonical: variant.canonical,
    ...buildShuffledOptions(rng, variant.canonical, variant.distractors),
  };
}

export function generate(
  spec: GeneratorSpec,
  seed: string,
): ExerciseInstance {
  switch (spec.kind) {
    case "template":
      return generateTemplate(spec, seed);
    case "variant":
      return generateVariant(spec, seed);
    case "procedural":
      throw new Error(
        "Procedural generators not implemented yet (no exercises use them)",
      );
  }
}
