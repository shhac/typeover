import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Status = "idle" | "correct" | "incorrect" | "pending";

interface FeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  status: Status;
  /** Optional ref escape hatch so ExerciseShell can move focus to
   *  the panel after a Submit (sighted keyboard users land on the
   *  feedback message rather than losing focus to <body>; screen
   *  readers still get the aria-live announcement on top). */
  ref?: (el: HTMLDivElement) => void;
}

const statusClass: Record<Status, string> = {
  idle: "hidden",
  correct: "bg-success/10 border-success/40 text-success",
  incorrect: "bg-error/10 border-error/40 text-error",
  pending: "bg-bg-elevated border-border-default text-fg-secondary",
};

const statusLabel: Record<Status, string> = {
  idle: "",
  correct: "Correct",
  incorrect: "Not quite",
  pending: "Checking",
};

/**
 * Feedback: aria-live region for correctness messaging. Screen readers
 * announce status changes; visual style reflects state.
 */
export function Feedback(props: ParentProps<FeedbackProps>) {
  const [local, rest] = splitProps(props, ["status", "class", "children", "ref"]);
  return (
    <div
      {...rest}
      ref={local.ref}
      role="status"
      aria-live="polite"
      tabindex="-1"
      class={cn(
        "border rounded-sm px-4 py-3 font-mono text-sm",
        "focus:outline-2 focus:outline-accent-amber focus:outline-offset-2",
        statusClass[local.status],
        local.class,
      )}
    >
      <span class="font-semibold mr-2 uppercase tracking-wider text-xs">
        {statusLabel[local.status]}
      </span>
      {local.children}
    </div>
  );
}
