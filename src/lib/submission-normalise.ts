/**
 * Single source of truth for "are these two fill-line submissions
 * the same line, modulo trivial editing variations?". Used by:
 *  - wrong-pattern matching (a learner's typo of a known wrong line
 *    should still trigger the targeted explain),
 *  - alternate-canonical matching (a learner's perfect modern form
 *    grades correct even when Yaegi can't run it).
 *
 * Normalisation collapses interior whitespace runs to a single
 * space, trims edges, lowercases. Case-folding catches the most
 * common typo class from TS habits (`Var doubled = …`,
 * `User := …`). Loosens only the *match* axis — authored text and
 * correctness oracles are unaffected. design-docs/19 F-16.
 */
export function normaliseSubmission(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}
