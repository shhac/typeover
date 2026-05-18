import { describe, expect, it } from "vitest";
import { tileState } from "./CandidateTile";

/*
 * 16-row truth table for the fill-blank-line candidate-tile resolver.
 * Mirror of McqOption.test.ts's table — pins the same learner-controls-
 * reveal principle (canonical NOT auto-lit on wrong submit).
 *
 * Outcome vocabulary differs from optionCellState (correctRevealed +
 * correct/incorrect-Submitted) but the branch logic is identical: a
 * regression in either resolver should fail the same rows.
 */

type Row = {
  selected: boolean;
  submitted: boolean;
  revealed: boolean;
  isCorrect: boolean;
  expected:
    | "correctSubmitted"
    | "incorrectSubmitted"
    | "correctRevealed"
    | "selected"
    | "neutral";
};

const F = false;
const T = true;

const TABLE: Row[] = [
  /* picking phase */
  { selected: F, submitted: F, revealed: F, isCorrect: F, expected: "neutral" },
  { selected: F, submitted: F, revealed: F, isCorrect: T, expected: "neutral" },
  { selected: T, submitted: F, revealed: F, isCorrect: F, expected: "selected" },
  { selected: T, submitted: F, revealed: F, isCorrect: T, expected: "selected" },

  /* submitted, not revealed */
  { selected: F, submitted: T, revealed: F, isCorrect: F, expected: "neutral" },
  /* learner-controls-reveal: canonical NOT auto-lit on wrong submit */
  { selected: F, submitted: T, revealed: F, isCorrect: T, expected: "neutral" },
  { selected: T, submitted: T, revealed: F, isCorrect: F, expected: "incorrectSubmitted" },
  { selected: T, submitted: T, revealed: F, isCorrect: T, expected: "correctSubmitted" },

  /* revealed, not submitted */
  { selected: F, submitted: F, revealed: T, isCorrect: F, expected: "neutral" },
  { selected: F, submitted: F, revealed: T, isCorrect: T, expected: "correctRevealed" },
  { selected: T, submitted: F, revealed: T, isCorrect: F, expected: "selected" },
  { selected: T, submitted: F, revealed: T, isCorrect: T, expected: "correctRevealed" },

  /* submitted AND revealed */
  { selected: F, submitted: T, revealed: T, isCorrect: F, expected: "neutral" },
  { selected: F, submitted: T, revealed: T, isCorrect: T, expected: "correctRevealed" },
  { selected: T, submitted: T, revealed: T, isCorrect: F, expected: "incorrectSubmitted" },
  { selected: T, submitted: T, revealed: T, isCorrect: T, expected: "correctRevealed" },
];

describe("tileState — 16-row truth table", () => {
  for (const row of TABLE) {
    const tag = `s=${row.selected ? 1 : 0} sub=${row.submitted ? 1 : 0} rev=${row.revealed ? 1 : 0} ok=${row.isCorrect ? 1 : 0}`;
    it(`${tag} → ${row.expected}`, () => {
      expect(
        tileState({
          selected: row.selected,
          submitted: row.submitted,
          revealed: row.revealed,
          isCorrect: row.isCorrect,
        }),
      ).toBe(row.expected);
    });
  }
});
