import { describe, expect, it } from "vitest";
import { optionCellState } from "./McqOption";

/*
 * 16-row truth table over {selected, submitted, revealed, isCorrect}.
 * Pins iter-6's "learner controls reveal" fix (commit 0ebb26c) — a
 * regression to the old behaviour (auto-revealing the canonical on wrong
 * submit) would fail the `submitted && !selected && isCorrect → neutral`
 * row.
 */

type Bool = boolean;
type Row = {
  selected: Bool;
  submitted: Bool;
  revealed: Bool;
  isCorrect: Bool;
  expected: "showCorrect" | "showIncorrect" | "selected" | "neutral";
};

const F = false;
const T = true;

const TABLE: Row[] = [
  /* picking phase — nothing submitted, nothing revealed */
  { selected: F, submitted: F, revealed: F, isCorrect: F, expected: "neutral" },
  { selected: F, submitted: F, revealed: F, isCorrect: T, expected: "neutral" },
  { selected: T, submitted: F, revealed: F, isCorrect: F, expected: "selected" },
  { selected: T, submitted: F, revealed: F, isCorrect: T, expected: "selected" },

  /* submitted, not revealed */
  { selected: F, submitted: T, revealed: F, isCorrect: F, expected: "neutral" },
  /* iter-6 fix: canonical NOT auto-lit on wrong submit */
  { selected: F, submitted: T, revealed: F, isCorrect: T, expected: "neutral" },
  { selected: T, submitted: T, revealed: F, isCorrect: F, expected: "showIncorrect" },
  { selected: T, submitted: T, revealed: F, isCorrect: T, expected: "showCorrect" },

  /* revealed, not submitted (reachable only if learner reveals before
   * submitting — guarded against by the UI, but the resolver still
   * defines an answer) */
  { selected: F, submitted: F, revealed: T, isCorrect: F, expected: "neutral" },
  { selected: F, submitted: F, revealed: T, isCorrect: T, expected: "showCorrect" },
  { selected: T, submitted: F, revealed: T, isCorrect: F, expected: "selected" },
  { selected: T, submitted: F, revealed: T, isCorrect: T, expected: "showCorrect" },

  /* submitted AND revealed (post-wrong-submit reveal path) */
  { selected: F, submitted: T, revealed: T, isCorrect: F, expected: "neutral" },
  { selected: F, submitted: T, revealed: T, isCorrect: T, expected: "showCorrect" },
  { selected: T, submitted: T, revealed: T, isCorrect: F, expected: "showIncorrect" },
  { selected: T, submitted: T, revealed: T, isCorrect: T, expected: "showCorrect" },
];

describe("optionCellState — 16-row truth table", () => {
  for (const row of TABLE) {
    const tag = `s=${row.selected ? 1 : 0} sub=${row.submitted ? 1 : 0} rev=${row.revealed ? 1 : 0} ok=${row.isCorrect ? 1 : 0}`;
    it(`${tag} → ${row.expected}`, () => {
      expect(
        optionCellState({
          selected: row.selected,
          submitted: row.submitted,
          revealed: row.revealed,
          isCorrect: row.isCorrect,
        }),
      ).toBe(row.expected);
    });
  }
});
