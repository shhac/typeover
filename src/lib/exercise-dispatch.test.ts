import { describe, expect, it } from "vitest";

import { pickExerciseDispatch } from "./exercise-dispatch";

/*
 * The dispatcher is the page-boundary that decides what to render
 * for each authored exercise. It owns three load-bearing rules:
 *
 *   1. The (target=rust, runtime=server) reshape — both freeform
 *      and fill-line variants — so the downstream component sees
 *      a concrete client runtime, not a placeholder.
 *   2. Skip-tokens with named reasons for any combination that
 *      can't render safely (missing oracle, runtime/type mismatch,
 *      none runtime on a runnable type). Without these the page
 *      would silently render nothing, which is worse than a
 *      diagnostic.
 *   3. The default-blanks fallback for fill-word (`blanks ?? []`)
 *      so an authored fill-word without explicit blanks still
 *      renders.
 *
 * A regression to any of these would silently drop content from
 * the curriculum without a typecheck failure — the schema can let
 * an exercise through that the dispatcher then quietly skips.
 */

describe("pickExerciseDispatch — freeform Rust reshape", () => {
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

  it("passes submissionShape through verbatim when authored", () => {
    const submissionShape = {
      mustStartWith: "fn main() {",
      mustEndWith: "}",
    };
    const out = pickExerciseDispatch({
      type: "freeform",
      target: "rust",
      runtime: "server",
      expectStdout: "ok\n",
      submissionShape,
    });
    expect(out).toMatchObject({ kind: "freeform", submissionShape });
  });
});

describe("pickExerciseDispatch — freeform passes through client runtimes", () => {
  it("passes yaegi through unchanged", () => {
    expect(
      pickExerciseDispatch({
        type: "freeform",
        target: "go",
        runtime: "yaegi",
        expectStdout: "go\n",
      }),
    ).toMatchObject({ kind: "freeform", runtime: "yaegi" });
  });

  it("passes zig through unchanged", () => {
    expect(
      pickExerciseDispatch({
        type: "freeform",
        target: "zig",
        runtime: "zig",
        expectStdout: "zig\n",
      }),
    ).toMatchObject({ kind: "freeform", runtime: "zig" });
  });
});

describe("pickExerciseDispatch — fill-line Rust reshape", () => {
  /* Mirror of the freeform reshape: (target=rust, runtime=server)
   * collapses to runtime="rust" so FillBlankLineInput's prop union
   * stays a concrete client-runtime id. Authored as runtime=server
   * to keep the schema vocabulary consistent across exercise types. */
  it("reshapes Rust server fill-line exercises to the Rust client runtime", () => {
    expect(
      pickExerciseDispatch({
        type: "fill-line",
        target: "rust",
        runtime: "server",
        expectStdout: "10\n",
        blanks: ["line"],
      }),
    ).toEqual({
      kind: "fill-line",
      runtime: "rust",
      expectStdout: "10\n",
      blanks: ["line"],
      alternateCanonicals: undefined,
      acceptedAnswers: undefined,
      knownAttempts: undefined,
    });
  });

  it("passes fill-line yaegi through unchanged", () => {
    expect(
      pickExerciseDispatch({
        type: "fill-line",
        target: "go",
        runtime: "yaegi",
        expectStdout: "go\n",
        blanks: ["expr"],
      }),
    ).toMatchObject({ kind: "fill-line", runtime: "yaegi" });
  });

  it("passes fill-line zig through unchanged", () => {
    expect(
      pickExerciseDispatch({
        type: "fill-line",
        target: "zig",
        runtime: "zig",
        expectStdout: "z\n",
        blanks: ["expr"],
      }),
    ).toMatchObject({ kind: "fill-line", runtime: "zig" });
  });

  it("preserves alternateCanonicals on the dispatch token", () => {
    /* alternateCanonicals only applies to fill-line — the schema
     * pins that scope. The dispatcher passes it through so the
     * fill-line component can grade-against-each. */
    const alternateCanonicals = ["alt1", "alt2"];
    const out = pickExerciseDispatch({
      type: "fill-line",
      target: "go",
      runtime: "yaegi",
      expectStdout: "ok\n",
      blanks: ["expr"],
      alternateCanonicals,
    });
    expect(out).toMatchObject({ kind: "fill-line", alternateCanonicals });
  });

  it("preserves acceptedAnswers and knownAttempts on the dispatch token", () => {
    const acceptedAnswers = [{ match: "foo * 2", prebake: true }];
    const knownAttempts = [
      {
        match: "foo + 2",
        outcome: "wrong-output" as const,
        stdout: "23\n",
        explain: "That adds instead of doubles.",
      },
    ];
    const out = pickExerciseDispatch({
      type: "fill-line",
      target: "rust",
      runtime: "server",
      expectStdout: "42\n",
      blanks: ["expr"],
      acceptedAnswers,
      knownAttempts,
    });
    expect(out).toMatchObject({ kind: "fill-line", acceptedAnswers, knownAttempts });
  });
});

describe("pickExerciseDispatch — skip branches", () => {
  /* Each skip carries a named reason so the page can either
   * surface it or silently no-op; tests pin the reason strings
   * so a runtime regression that started returning a different
   * skip reason would surface here. */

  it("skips a fill-line missing expectStdout", () => {
    expect(
      pickExerciseDispatch({
        type: "fill-line",
        target: "go",
        runtime: "yaegi",
      }),
    ).toEqual({ kind: "skip", reason: "fill-line missing expectStdout" });
  });

  it("skips a fill-line with an unsupported runtime", () => {
    /* runtime=none on a fill-line. The schema gates against this
     * at authoring time, but the dispatcher carries its own guard
     * — defense in depth. */
    const out = pickExerciseDispatch({
      type: "fill-line",
      target: "go",
      runtime: "none",
      expectStdout: "x\n",
    });
    expect(out).toMatchObject({ kind: "skip" });
    expect((out as { reason: string }).reason).toMatch(/yaegi\/zig\/rust runtime/);
  });

  it("skips a freeform with runtime=none", () => {
    expect(
      pickExerciseDispatch({
        type: "freeform",
        target: "go",
        runtime: "none",
        expectStdout: "x\n",
      }),
    ).toEqual({ kind: "skip", reason: "freeform requires a non-`none` runtime" });
  });

  it("skips a freeform missing expectStdout", () => {
    expect(
      pickExerciseDispatch({
        type: "freeform",
        target: "go",
        runtime: "yaegi",
      }),
    ).toEqual({ kind: "skip", reason: "freeform missing expectStdout" });
  });
});

describe("pickExerciseDispatch — trivial types", () => {
  it("dispatches mcq with the bare token", () => {
    expect(pickExerciseDispatch({ type: "mcq", target: "go", runtime: "none" })).toEqual({
      kind: "mcq",
    });
  });

  it("dispatches fill-word with blanks ?? []", () => {
    /* If blanks is omitted by the author, dispatch falls back to
     * [] so the component still renders (the schema separately
     * requires non-empty blanks for fill-word; this is the
     * dispatcher's defensive default). */
    expect(pickExerciseDispatch({ type: "fill-word", target: "go", runtime: "none" })).toEqual({
      kind: "fill-word",
      blanks: [],
    });
  });

  it("passes fill-word blanks through verbatim when authored", () => {
    expect(
      pickExerciseDispatch({
        type: "fill-word",
        target: "go",
        runtime: "none",
        blanks: ["op", "n"],
      }),
    ).toEqual({ kind: "fill-word", blanks: ["op", "n"] });
  });
});
