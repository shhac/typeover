import { createSignal, Show } from "solid-js";
import { Button } from "./Button";
import { CodeBlock } from "./CodeBlock";

interface RevealButtonProps {
  canonical: string;
  lang?: "go" | "ts";
  /** Called when the learner reveals. */
  onReveal?: () => void;
}

/**
 * RevealButton: persistent "Show canonical" toggle. Available before
 * and after submission. Reveals the idiomatic answer for comparison.
 *
 * onReveal fires once per component instance — toggling closed and
 * back open does NOT re-fire. Consumers that record this as
 * progress (ExerciseShell wires it to recordHintUsed per design-
 * docs/19 F-15) get one hint-equivalent per peek session, not one
 * per click.
 */
export function RevealButton(props: RevealButtonProps) {
  const [shown, setShown] = createSignal(false);
  let alreadyReported = false;

  const toggle = () => {
    const next = !shown();
    setShown(next);
    if (next && !alreadyReported) {
      alreadyReported = true;
      props.onReveal?.();
    }
  };

  return (
    <div class="flex flex-col gap-3">
      <Button variant="ghost" size="md" onClick={toggle} aria-expanded={shown()}>
        {shown() ? "Hide canonical" : "Show canonical"}
      </Button>
      <Show when={shown()}>
        <CodeBlock lang={props.lang ?? "go"} filename="canonical">
          {props.canonical}
        </CodeBlock>
      </Show>
    </div>
  );
}
