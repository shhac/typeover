import { pickFrom, rngFromSeed, shuffle } from "./seed";
import { assertUnreachable } from "./assert-unreachable";
import {
  distractorMatchText,
  PLACEHOLDER_RE,
  type GeneratorSpec,
  type TemplateGenerator,
  type VariantGenerator,
} from "./generator-schema";

/*
 * Exercise-generator RUNTIME. The instantiate-an-exercise half of
 * the original `generator.ts`, split per design-docs/20 FW-2. Used
 * by:
 *
 *   - src/lib/exercise-instance.ts (`generate()` per seed)
 *   - src/lib/fill-blank.ts (`substitute()`, `FillSegment`,
 *     `ExerciseInstance`)
 *   - the four exercise component islands (type-only — `GeneratorSpec`)
 *
 * The schemas + their refinements live in ./generator-schema.ts.
 * This file imports the inferred types and the discriminator
 * helpers but never the Zod runtime, so component bundles don't
 * pay for `superRefine`/issue-construction code.
 *
 * `template` is implemented. `variant` is implemented and
 * exercised by `foundations/variables/03.yaml` (the `const PI`
 * exercise) — among others. `procedural` is reserved for the
 * first content that needs it.
 *
 * The optional `blanks` argument to `generate()` engages the
 * fill-blank-word path: certain `${var}` placeholders in the
 * canonical are emitted as input slots rather than text.
 */

export type FillSegment =
  | { kind: "text"; text: string }
  | { kind: "blank"; varName: string; expected: string };

export type ExerciseInstance = {
  /** The TS snippet shown in the prompt. */
  ts: string;
  /** The idiomatic Go answer. */
  canonical: string;
  /** Optional target-language source the exercise asks ABOUT. Set
   *  only for generators that authored a `source:` field (mcq-
   *  explain exercises). Template generators substitute the same
   *  way as `ts`/`canonical`. The language is whatever the
   *  exercise's `target:` field declared (go/zig/rust). */
  source?: string;
  /** For MCQs: the shuffled option list. `correctIndex` is the index
   *  of the canonical in this list. */
  options?: string[];
  correctIndex?: number;
  /** For fill-blank-word exercises: the canonical broken into text
   *  segments and named blank slots. Present only when generate() is
   *  called with a non-empty `blanks` option (template generator only). */
  blankSegments?: FillSegment[];
  /** The resolved variable values for this instance. Present only for
   *  template generators; variants and procedurals have no values
   *  map (their `ts`/`canonical` aren't substituted). Consumers use
   *  this to re-substitute *other* strings against the same instance,
   *  e.g. hint text containing `${name}`. */
  values?: Record<string, string>;
};

export type GenerateOptions = {
  /** Var names from the template to render as input slots instead of
   *  substituted text. Engages the fill-blank-word path. */
  blanks?: string[];
};

/** Strip the escape backslash from literal `\${name}` sequences in
 *  rendered text. Pairs with PLACEHOLDER_RE's negative lookbehind:
 *  the parser skips matching, this pass removes the escape so the
 *  display shows the intended `${name}`. */
function unescapePlaceholders(s: string): string {
  return s.replace(/\\(\$\{)/g, "$1");
}

/**
 * Walk the canonical template, emitting segments. Vars listed in
 * `blanks` become input slots with their expected value; everything
 * else is substituted into text. Escaped `\${name}` is left alone
 * by the matcher and unescaped to literal `${name}` in the text
 * segments emitted.
 *
 * The single source of truth for `${var}` parsing — `substitute` is
 * defined in terms of this so the placeholder grammar and the
 * unknown-var error live in one place. PLACEHOLDER_RE is re-imported
 * from generator-schema so the regex is genuinely shared.
 */
export function buildBlankSegments(
  canonical: string,
  values: Record<string, string>,
  blanks: readonly string[],
): FillSegment[] {
  const blankSet = new Set(blanks);
  const segments: FillSegment[] = [];
  const pushText = (text: string) => {
    if (text !== "") segments.push({ kind: "text", text: unescapePlaceholders(text) });
  };
  let cursor = 0;
  for (const match of canonical.matchAll(PLACEHOLDER_RE)) {
    const [full, name] = match;
    if (match.index > cursor) {
      pushText(canonical.slice(cursor, match.index));
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
    pushText(canonical.slice(cursor));
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

/**
 * Pick one value from each declared var pool, deterministically by
 * `rng`. The returned map is the substitution context used for ts /
 * canonical / distractors and is also surfaced on `ExerciseInstance.values`
 * so consumers (HintButton, FillBlankLineInput) can re-substitute
 * other strings against the same instance.
 *
 * Extracted from generateTemplate so the values contract is
 * independently visible and the orchestrator function reads
 * top-down: resolve → substitute → blanks → mcq → assemble.
 */
export function resolveTemplateValues(
  spec: TemplateGenerator,
  rng: () => number,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, pool] of Object.entries(spec.vars)) {
    values[name] = pickFrom(rng, pool);
  }
  return values;
}

function generateTemplate(
  spec: TemplateGenerator,
  seed: string,
  opts: GenerateOptions,
): ExerciseInstance {
  const rng = rngFromSeed(seed);
  const values = resolveTemplateValues(spec, rng);
  const ts = substitute(spec.ts, values);
  const canonical = substitute(spec.canonical, values);
  const source = spec.source !== undefined ? substitute(spec.source, values) : undefined;

  const blankSegments =
    opts.blanks && opts.blanks.length > 0
      ? buildBlankSegments(spec.canonical, values, opts.blanks)
      : undefined;

  const mcq =
    spec.distractors && spec.distractors.length > 0
      ? buildShuffledOptions(
          rng,
          canonical,
          /* Extract the matchable text from each entry. MCQ doesn't
           * surface `.explain`; the fill-line wrong-pattern path
           * reads from the raw `spec.distractors` directly. */
          spec.distractors.map((d) => substitute(distractorMatchText(d), values)),
        )
      : undefined;

  return {
    ts,
    canonical,
    values,
    ...(source !== undefined ? { source } : {}),
    ...(blankSegments ? { blankSegments } : {}),
    ...mcq,
  };
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

  const sourceFields = variant.source !== undefined ? { source: variant.source } : {};
  if (!variant.distractors || variant.distractors.length === 0) {
    return { ts: variant.ts, canonical: variant.canonical, ...sourceFields };
  }
  return {
    ts: variant.ts,
    canonical: variant.canonical,
    ...sourceFields,
    ...buildShuffledOptions(rng, variant.canonical, variant.distractors.map(distractorMatchText)),
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
      throw new Error("Procedural generators not implemented yet (no exercises use them)");
    default:
      /* Widening GeneratorSpec without a matching case fails at
       * typecheck rather than slipping past the existing
       * "procedural throws" runtime catch. */
      return assertUnreachable(spec);
  }
}
