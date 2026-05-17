import { pickFrom, rngFromSeed, shuffle } from "./seed";

/*
 * Exercise generators. Takes a generator spec (from a content
 * collection entry) plus a seed; returns a deterministic concrete
 * instance.
 *
 * The "template" kind is implemented. Variant + procedural land
 * alongside the first content that needs them.
 */

export type ExerciseInstance = {
  /** The TS snippet shown in the prompt. */
  ts: string;
  /** The idiomatic Go answer. */
  canonical: string;
  /** For MCQs: the shuffled option list. The first entry is the
   *  correct one *before* shuffling, but we shuffle and track which
   *  rendered index is correct in `correctIndex`. */
  options?: string[];
  correctIndex?: number;
};

type TemplateSpec = {
  kind: "template";
  vars: Record<string, string[]>;
  ts: string;
  canonical: string;
  distractors?: string[];
};

type VariantSpec = {
  kind: "variant";
  variants: Array<{
    id: string;
    ts: string;
    canonical: string;
    distractors?: string[];
  }>;
};

type ProceduralSpec = {
  kind: "procedural";
  module: string;
};

export type GeneratorSpec = TemplateSpec | VariantSpec | ProceduralSpec;

/** ${name} substitution against a value map. */
function substitute(tmpl: string, values: Record<string, string>): string {
  return tmpl.replace(/\$\{(\w+)\}/g, (_, name) => {
    const v = values[name];
    if (v === undefined) {
      throw new Error(`Template references unknown var \${${name}}`);
    }
    return v;
  });
}

function generateTemplate(
  spec: TemplateSpec,
  seed: string,
): ExerciseInstance {
  const rng = rngFromSeed(seed);
  const values: Record<string, string> = {};
  for (const [name, pool] of Object.entries(spec.vars)) {
    values[name] = pickFrom(rng, pool);
  }
  const ts = substitute(spec.ts, values);
  const canonical = substitute(spec.canonical, values);

  if (!spec.distractors) {
    return { ts, canonical };
  }

  const renderedDistractors = spec.distractors.map((d) =>
    substitute(d, values),
  );
  // Shuffle options including the canonical; track its index in the
  // shuffled list so the MCQ knows which to mark correct.
  const optionsWithIndex = shuffle(rng, [
    { text: canonical, correct: true },
    ...renderedDistractors.map((text) => ({ text, correct: false })),
  ]);
  const options = optionsWithIndex.map((o) => o.text);
  const correctIndex = optionsWithIndex.findIndex((o) => o.correct);

  return { ts, canonical, options, correctIndex };
}

function generateVariant(
  spec: VariantSpec,
  seed: string,
): ExerciseInstance {
  const rng = rngFromSeed(seed);
  const variant = pickFrom(rng, spec.variants);

  if (!variant.distractors) {
    return { ts: variant.ts, canonical: variant.canonical };
  }

  const optionsWithIndex = shuffle(rng, [
    { text: variant.canonical, correct: true },
    ...variant.distractors.map((text) => ({ text, correct: false })),
  ]);
  return {
    ts: variant.ts,
    canonical: variant.canonical,
    options: optionsWithIndex.map((o) => o.text),
    correctIndex: optionsWithIndex.findIndex((o) => o.correct),
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
