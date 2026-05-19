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

const PLACEHOLDER_RE = /\$\{(\w+)\}/g;

/** Extract `${name}` references from a template string. Shared between
 *  the runtime substitution path and the build-time schema refinements
 *  so the placeholder grammar lives in one place. */
export function extractTemplateVars(tmpl: string): string[] {
  return Array.from(tmpl.matchAll(PLACEHOLDER_RE), (m) => m[1]!);
}

/**
 * One entry in a `distractors` list. The bare-string form is the
 * original v0 shape — kept for back-compat with shipped MCQ +
 * fill-line YAMLs. The `{match, explain}` form is the targeted-
 * feedback shape (design-docs/99) — fill-line surfaces the explain
 * string when a learner's submission matches the `match` (mod
 * whitespace).
 *
 * MCQ uses `match` (or the bare string) as the option text. The
 * `explain` field is unused on MCQ — there's no need to explain
 * a distractor that the learner *picked* because the canonical is
 * adjacent and the learner can compare directly.
 */
export const DistractorEntrySpec = z.union([
  z.string(),
  z.object({
    match: z.string(),
    explain: z.string(),
  }),
]);
export type DistractorEntry = z.infer<typeof DistractorEntrySpec>;

/** Pull the matchable text out of a distractor entry. */
export function distractorMatchText(entry: DistractorEntry): string {
  return typeof entry === "string" ? entry : entry.match;
}

/** Pull the explanation out of an entry, or null if the entry
 *  is a bare string (no explanation authored). */
export function distractorExplain(entry: DistractorEntry): string | null {
  return typeof entry === "string" ? null : entry.explain;
}

const TemplateSpec = z
  .object({
    kind: z.literal("template"),
    /** Map of variable name to value pool. Generator picks one from each. */
    vars: z.record(z.string(), z.array(z.string())),
    /** TS snippet shown in the prompt, with ${name} placeholders. */
    ts: z.string(),
    /** Idiomatic Go answer template, with the same placeholders. */
    canonical: z.string(),
    /**
     * Distractor entries. Bare strings for MCQ option text and v0
     * fill-line bank. The structured `{match, explain}` form
     * supports targeted wrong-pattern feedback on fill-line —
     * design-docs/99.
     */
    distractors: z.array(DistractorEntrySpec).optional(),
  })
  .superRefine((spec, ctx) => {
    /* Every declared pool must be non-empty — pickFrom crashes on []. */
    for (const [name, pool] of Object.entries(spec.vars)) {
      if (pool.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `Template var pool "${name}" is empty; pickFrom needs ≥1 value.`,
          path: ["vars", name],
        });
      }
    }
    /* Every ${ref} in ts / canonical / distractors must be declared
     * in `vars`. Catches the most common authoring footgun before it
     * hits the runtime (where substitute() throws). */
    const declared = new Set(Object.keys(spec.vars));
    const checkRefs = (template: string, path: (string | number)[]) => {
      for (const ref of extractTemplateVars(template)) {
        if (!declared.has(ref)) {
          ctx.addIssue({
            code: "custom",
            message: `Template references undeclared var "\${${ref}}".`,
            path,
          });
        }
      }
    };
    checkRefs(spec.ts, ["ts"]);
    checkRefs(spec.canonical, ["canonical"]);
    (spec.distractors ?? []).forEach((d, i) =>
      /* For structured `{match, explain}` entries, the `match`
       * field is the templated text (it's the substituted-against-
       * vars string a learner's submission is compared to). The
       * `explain` field is plain prose — no ${vars} expected. */
      checkRefs(distractorMatchText(d), ["distractors", i]),
    );
  });

const VariantSpec = z
  .object({
    kind: z.literal("variant"),
    variants: z.array(
      z.object({
        id: z.string(),
        ts: z.string(),
        canonical: z.string(),
        distractors: z.array(DistractorEntrySpec).optional(),
      }),
    ),
  })
  .superRefine((spec, ctx) => {
    if (spec.variants.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Variant generator must declare at least one variant.",
        path: ["variants"],
      });
    }
    /* IDs are how learners would (eventually) be told which variant
     * they're on; clashing IDs make that pointer useless. */
    const seen = new Map<string, number>();
    spec.variants.forEach((v, i) => {
      const prior = seen.get(v.id);
      if (prior !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate variant id "${v.id}" (also at index ${prior}).`,
          path: ["variants", i, "id"],
        });
      } else {
        seen.set(v.id, i);
      }
    });
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

  if (!variant.distractors || variant.distractors.length === 0) {
    return { ts: variant.ts, canonical: variant.canonical };
  }
  return {
    ts: variant.ts,
    canonical: variant.canonical,
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
  }
}
