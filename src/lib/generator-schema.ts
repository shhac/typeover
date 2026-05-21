import { z } from "zod";

/*
 * Exercise-generator SCHEMAS. The build-time half of `generator.ts`,
 * split per design-docs/20 FW-2. Used by:
 *
 *   - src/lib/content-schema.ts to validate authored YAML at
 *     `getCollection()` time
 *   - the runtime half (./generator-runtime.ts) for the inferred
 *     types and the distractor helpers
 *
 * Schemas live here so consumers that only need validation (content
 * pipeline, tests) don't pull the runtime instantiation code, and
 * vice-versa. The barrel at ./generator.ts re-exports both halves
 * so existing import sites — components, exercise-instance,
 * fill-blank, wrong-pattern — keep working with no change.
 */

/** `${name}` placeholders. Negative lookbehind `(?<!\\)` excludes
 *  ESCAPED placeholders (`\${name}`) from matching — authors can use
 *  the escape when they want to show a literal `${name}` in `ts:` /
 *  `canonical:` fields (commonly: TypeScript template literals like
 *  `` `got ${got}` ``). The runtime substitute pass strips the
 *  leading `\` from the rendered output. */
export const PLACEHOLDER_RE = /(?<!\\)\$\{(\w+)\}/g;

/** Extract `${name}` references from a template string. Shared between
 *  the runtime substitution path and the build-time schema refinements
 *  so the placeholder grammar lives in one place. Escaped `\${name}`
 *  occurrences are skipped. */
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

export const TemplateSpec = z
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

export const VariantSpec = z
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

export const ProceduralSpec = z.object({
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
