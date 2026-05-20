import { distractorExplain, distractorMatchText, type DistractorEntry } from "./generator";

/**
 * Match a learner's fill-line submission against the exercise's
 * authored distractor bank. Returns the structured entry's
 * `explain` string when the submission matches a known wrong
 * pattern, or null when nothing matches (or when the matching
 * entry was a bare string with no explanation).
 *
 * Whitespace is normalised on both sides — `var  doubled = count*2`
 * matches `var doubled = count * 2`. Catches the small typing
 * variations a learner makes without splintering the bank into
 * dozens of near-duplicates.
 *
 * design-docs/99 — targeted wrong-pattern feedback.
 */

/** Collapse interior whitespace runs to a single space, trim
 *  edges, lowercase. Mirrors what authors visually consider "the
 *  same line"; case-folding catches the most common typo class
 *  learners pick up from TS habits (`Var doubled = …`,
 *  `User := …`). Authored distractor text is still surfaced verbatim
 *  in the explain message — this only loosens the *match* axis, not
 *  the correctness oracle. design-docs/19 F-16. */
function normalise(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function matchWrongPattern(
  submission: string,
  distractors: readonly DistractorEntry[] | undefined,
): { explain: string } | null {
  if (!distractors || distractors.length === 0) return null;
  const target = normalise(submission);
  if (target === "") return null;
  for (const entry of distractors) {
    if (normalise(distractorMatchText(entry)) !== target) continue;
    const explain = distractorExplain(entry);
    if (explain !== null) return { explain };
    /* The bare-string entries are matched (for completeness — a
     * matched bare distractor IS a known wrong pattern), but they
     * have no explanation to surface. Return null so the caller
     * falls back to the generic wrong message rather than showing
     * an empty explainer. */
    return null;
  }
  return null;
}
