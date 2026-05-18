import { z } from "zod";
import { pickFrom, rngFromSeed, shuffle } from "./seed";

/*
 * Exercise generators.
 *
 * Schemas live here (single source of truth) and the TS types are
 * z.inferred from them so content.config.ts and runtime never drift.
 *
 * `template` is implemented. `variant` is implemented and
 * exercised by `foundations/variables/03.yaml` (the `const PI`
 * exercise) — among others; many themes ship a `03.yaml` so the
 * file path needs to be explicit. `procedural` is reserved for
 * the first content that needs it.
 *
 * The optional `blanks` argument to `generate()` engages the
 * fill-blank-word path: certain `${var}` placeholders in the
 * canonical are emitted as input slots rather than text.
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
type TemplateGenerator = z.infer<typeof TemplateSpec>;
type VariantGenerator = z.infer<typeof VariantSpec>;

/* ---------------- Runtime ---------------- */

export type FillSegment =
  | { kind: "text"; text: string }
  | { kind: "blank"; varName: string; expected: string };

export type ExerciseInstance = {
  /** The TS snippet shown in the prompt. */
  ts: string;
  /** The idiomatic Go answer. */
  canonical: string;
  /** For MCQs: the shuffled option list. `correctIndex` is the index
   *  of the canonical in this list. */
  options?: string[];
  correctIndex?: number;
  /** For fill-blank-word exercises: the canonical broken into text
   *  segments and named blank slots. Present only when generate() is
   *  called with a non-empty `blanks` option (template generator only). */
  blankSegments?: FillSegment[];
};

export type GenerateOptions = {
  /** Var names from the template to render as input slots instead of
   *  substituted text. Engages the fill-blank-word path. */
  blanks?: string[];
};

/**
 * Walk the canonical template, emitting segments. Vars listed in
 * `blanks` become input slots with their expected value; everything
 * else is substituted into text.
 *
 * The single source of truth for `${var}` parsing — `substitute` is
 * defined in terms of this so the placeholder grammar and the
 * unknown-var error live in one place.
 */
export function buildBlankSegments(
  canonical: string,
  values: Record<string, string>,
  blanks: readonly string[],
): FillSegment[] {
  const blankSet = new Set(blanks);
  const segments: FillSegment[] = [];
  let cursor = 0;
  for (const match of canonical.matchAll(/\$\{(\w+)\}/g)) {
    const [full, name] = match;
    if (match.index > cursor) {
      segments.push({ kind: "text", text: canonical.slice(cursor, match.index) });
    }
    const value = values[name];
    if (value === undefined) {
      throw new Error(`Template references unknown var \${${name}}`);
    }
    if (blankSet.has(name)) {
      segments.push({ kind: "blank", varName: name, expected: value });
    } else {
      segments.push({ kind: "text", text: value });
    }
    cursor = match.index + full.length;
  }
  if (cursor < canonical.length) {
    segments.push({ kind: "text", text: canonical.slice(cursor) });
  }
  return segments;
}

/** ${name} substitution against a value map. Throws on unknown vars.
 *  Implemented via buildBlankSegments with `blanks = []` so the
 *  placeholder grammar lives in one place. */
export function substitute(tmpl: string, values: Record<string, string>): string {
  let out = "";
  for (const seg of buildBlankSegments(tmpl, values, [])) {
    if (seg.kind === "text") out += seg.text;
  }
  return out;
}

/**
 * Build MCQ options from a canonical answer + distractor list, shuffled
 * deterministically by `rng`. Drops any distractor that renders to the
 * same text as the canonical.
 */
export function buildShuffledOptions(
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
  opts: GenerateOptions,
): ExerciseInstance {
  const rng = rngFromSeed(seed);
  const values: Record<string, string> = {};
  for (const [name, pool] of Object.entries(spec.vars)) {
    values[name] = pickFrom(rng, pool);
  }
  const ts = substitute(spec.ts, values);
  const canonical = substitute(spec.canonical, values);

  const instance: ExerciseInstance = { ts, canonical };

  if (opts.blanks && opts.blanks.length > 0) {
    instance.blankSegments = buildBlankSegments(
      spec.canonical,
      values,
      opts.blanks,
    );
  }

  if (spec.distractors && spec.distractors.length > 0) {
    const renderedDistractors = spec.distractors.map((d) =>
      substitute(d, values),
    );
    Object.assign(
      instance,
      buildShuffledOptions(rng, canonical, renderedDistractors),
    );
  }

  return instance;
}

function generateVariant(
  spec: VariantGenerator,
  seed: string,
  opts: GenerateOptions,
): ExerciseInstance {
  /* Variant fill-blank-word support deferred until needed; today
   * every shipped variant is MCQ. Surface mis-pairings loudly rather
   * than silently dropping the option. */
  if (opts.blanks && opts.blanks.length > 0) {
    throw new Error(
      "variant generators do not support `blanks` yet — author the exercise with a template generator, or extend generateVariant.",
    );
  }
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
  opts: GenerateOptions = {},
): ExerciseInstance {
  switch (spec.kind) {
    case "template":
      return generateTemplate(spec, seed, opts);
    case "variant":
      return generateVariant(spec, seed, opts);
    case "procedural":
      throw new Error(
        "Procedural generators not implemented yet (no exercises use them)",
      );
  }
}
