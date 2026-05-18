import { describe, expect, it } from "vitest";
import { inputCellState } from "./BlankInput";

/*
 * Truth table for the FillBlankWord input resolver.
 *
 * Axes are (value === expected) × submitted × revealed (8 rows total).
 * The shape diverges from McqOption/CandidateTile (no `selected` axis)
 * because every input continuously holds a value.
 */

type Row = {
  match: boolean;
  submitted: boolean;
  revealed: boolean;
  expected:
    | "correctRevealed"
    | "incorrectRevealed"
    | "correctSubmitted"
    | "incorrectSubmitted"
    | "neutral";
};

const F = false;
const T = true;

const TABLE: Row[] = [
  /* not submitted, not revealed → neutral regardless of match */
  { match: F, submitted: F, revealed: F, expected: "neutral" },
  { match: T, submitted: F, revealed: F, expected: "neutral" },

  /* submitted, not revealed → match decides */
  { match: F, submitted: T, revealed: F, expected: "incorrectSubmitted" },
  { match: T, submitted: T, revealed: F, expected: "correctSubmitted" },

  /* revealed (with or without submission) → reveal classes win */
  { match: F, submitted: F, revealed: T, expected: "incorrectRevealed" },
  { match: T, submitted: F, revealed: T, expected: "correctRevealed" },
  { match: F, submitted: T, revealed: T, expected: "incorrectRevealed" },
  { match: T, submitted: T, revealed: T, expected: "correctRevealed" },
];

describe("inputCellState — 8-row truth table", () => {
  for (const row of TABLE) {
    const tag = `match=${row.match ? 1 : 0} sub=${row.submitted ? 1 : 0} rev=${row.revealed ? 1 : 0}`;
    it(`${tag} → ${row.expected}`, () => {
      const value = row.match ? "go" : "ts";
      expect(
        inputCellState({
          value,
          expected: "go",
          submitted: row.submitted,
          revealed: row.revealed,
        }),
      ).toBe(row.expected);
    });
  }
});
