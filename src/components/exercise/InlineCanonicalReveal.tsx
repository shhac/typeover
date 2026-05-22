import { createEffect, createSignal, Show } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { DiffView } from "./DiffView";

interface InlineCanonicalRevealProps {
  /** What the learner typed. Accessor so a reveal-after-edit
   *  re-renders the diff. Empty string is treated as
   *  "no submission yet" and the reveal shows plain canonical. */
  submission: () => string;
  /** The reference answer for the slot the learner is filling. */
  canonical: string;
  /** Diff grain. fill-line is one line → "word"; freeform is a
   *  multi-line program → "line". */
  mode: "word" | "line";
  /** Code-language label for the canonical-only fallback block. */
  lang?: "go" | "ts";
  /** Called once each time the learner reveals. Per design-docs/12
   *  P1 — reveal records the failure. */
  onReveal?: () => void;
  /** When this accessor flips to true (e.g. the wrong-phase "Reveal
   *  correct" button has been clicked), force the panel open even
   *  if the learner never clicked the local toggle. Lets the two
   *  reveal entry points share one visual surface. */
  forceOpen?: () => boolean;
}

/*
 * Component-owned "Show answer / Hide answer" toggle. Replaces
 * the shell-footer RevealButton for fill-line and freeform — design-
 * docs/06 + the user's 2026-05-19 redesign place this *next to the
 * input line* rather than detached in a button row at the bottom.
 *
 * On reveal: if the learner has typed something, render a diff
 * (DiffView). If the field is empty, render the plain answer
 * (CodeBlock) — same content the legacy RevealButton showed.
 *
 * onReveal fires once per reveal (not once per Hide / Show toggle).
 */
export function InlineCanonicalReveal(props: InlineCanonicalRevealProps) {
  const [shown, setShown] = createSignal(false);
  const [hasRevealed, setHasRevealed] = createSignal(false);

  /* External force-open: if the wrong-phase "Reveal correct" button
   * flipped the parent's reveal flag, open the panel here too. */
  createEffect(() => {
    if (props.forceOpen?.() && !shown()) setShown(true);
  });

  const toggle = () => {
    const next = !shown();
    setShown(next);
    if (next && !hasRevealed()) {
      setHasRevealed(true);
      props.onReveal?.();
    }
  };

  const hasSubmission = () => props.submission().trim() !== "";
  const isForced = () => props.forceOpen?.() ?? false;

  return (
    <div class="flex flex-col gap-2">
      <Show when={!isForced()}>
        <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={shown()}>
          {shown() ? "Hide answer" : "Show answer"}
        </Button>
      </Show>
      <Show when={shown()}>
        <Show
          when={hasSubmission()}
          fallback={
            <CodeBlock lang={props.lang ?? "go"} filename="answer">
              {props.canonical}
            </CodeBlock>
          }
        >
          <DiffView submission={props.submission()} canonical={props.canonical} mode={props.mode} />
        </Show>
      </Show>
    </div>
  );
}
