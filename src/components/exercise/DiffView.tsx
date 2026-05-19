import { For } from "solid-js";
import { diffLines, diffWordsWithSpace, type Change } from "diff";

interface DiffViewProps {
  /** What the learner submitted / typed. May be empty (e.g. they
   *  haven't typed anything yet) — the consumer should normally
   *  show the canonical-only path in that case, not a diff. */
  submission: string;
  /** The reference answer. */
  canonical: string;
  /** Grain of the diff:
   *    "word"  — preserve whitespace, diff word-by-word; best for
   *              single-line content like fill-line.
   *    "line"  — diff line-by-line; best for multi-line freeform code.
   */
  mode: "word" | "line";
}

/*
 * Inline reveal-diff renderer. Diffs the learner's submission against
 * the canonical and renders a single-pane visualisation with
 * "what the learner had wrong" (red strikethrough — submission-only
 * tokens) and "what the canonical has that they didn't" (green
 * underline — canonical-only tokens). Common tokens render plain.
 *
 * Why single-pane and not side-by-side: short content (one line of
 * Go) reads better with inline highlights; multi-line code is rare
 * enough in M1 freeforms that a unified diff is plenty. If we later
 * teach a 30-line refactor we'll revisit.
 *
 * Why `diffLines` for "line" mode: line-level grain matches how a
 * reader scans code. Word-level on multi-line code would chase
 * whitespace differences and read as noise.
 *
 * Why `diffWordsWithSpace` for "word" mode: spaces stay in their
 * tokens so `a, b := 1, 2` doesn't reflow weirdly on a partial
 * match like `a, b = 1, 2`.
 */
export function DiffView(props: DiffViewProps) {
  const parts = (): Change[] => {
    if (props.mode === "line") {
      return diffLines(props.submission, props.canonical);
    }
    return diffWordsWithSpace(props.submission, props.canonical);
  };

  return (
    <div class="bg-bg-inset rounded-sm border border-border-default p-3 font-mono text-sm text-fg-primary whitespace-pre-wrap leading-relaxed">
      <For each={parts()}>
        {(part) => {
          if (part.added) {
            /* Canonical-only — what the learner missed. */
            return (
              <span class="bg-success/15 text-success border-b border-success/60">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            /* Submission-only — what the learner had that shouldn't be there. */
            return (
              <span class="bg-error/15 text-error line-through decoration-error/60">
                {part.value}
              </span>
            );
          }
          return <span>{part.value}</span>;
        }}
      </For>
    </div>
  );
}
