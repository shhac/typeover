import { describe, expect, it } from "vitest";

import { pickExerciseDispatch } from "./exercise-dispatch";

describe("pickExerciseDispatch", () => {
  it("reshapes Rust server freeform exercises to the Rust client runtime", () => {
    expect(
      pickExerciseDispatch({
        type: "freeform",
        target: "rust",
        runtime: "server",
        expectStdout: "ok\n",
      }),
    ).toEqual({
      kind: "freeform",
      runtime: "rust",
      expectStdout: "ok\n",
      submissionShape: undefined,
    });
  });

  it("leaves non-Rust server freeform exercises as server runtime", () => {
    expect(
      pickExerciseDispatch({
        type: "freeform",
        target: "go",
        runtime: "server",
        expectStdout: "ok\n",
      }),
    ).toMatchObject({ kind: "freeform", runtime: "server" });
  });
});
