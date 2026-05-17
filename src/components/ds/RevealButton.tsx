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
 */
export function RevealButton(props: RevealButtonProps) {
  const [shown, setShown] = createSignal(false);

  const toggle = () => {
    const next = !shown();
    setShown(next);
    if (next) props.onReveal?.();
  };

  return (
    <div class="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="md"
        onClick={toggle}
        aria-expanded={shown()}
      >
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
