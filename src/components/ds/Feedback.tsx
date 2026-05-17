import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

type Status = "idle" | "correct" | "incorrect" | "pending";

interface FeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  status: Status;
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
  const [local, rest] = splitProps(props, ["status", "class", "children"]);
  return (
    <div
      {...rest}
      role="status"
      aria-live="polite"
      class={cn(
        "border rounded-sm px-4 py-3 font-mono text-sm",
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
