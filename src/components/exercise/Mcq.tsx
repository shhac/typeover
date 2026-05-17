import { createMemo, createSignal, Show, For } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { Feedback } from "../ds/Feedback";
import { HintButton } from "../ds/HintButton";
import { RevealButton } from "../ds/RevealButton";
import { Stack } from "../ds/Stack";
import { Text } from "../ds/Text";
import { generate, type GeneratorSpec } from "~/lib/generator";
import {
  recordHintUsed,
  recordInstanceFailed,
  recordInstancePassed,
  recordInstanceSeen,
} from "~/lib/progress";

interface McqProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  hints: readonly [string, string, string];
}

export function Mcq(props: McqProps) {
  const [attempt, setAttempt] = createSignal(0);
  const [selected, setSelected] = createSignal<number | null>(null);
  const [submitted, setSubmitted] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);

  const seed = () => `${props.exerciseId}::${attempt()}`;
  const instance = createMemo(() => {
    const inst = generate(props.generator, seed());
    recordInstanceSeen(props.exerciseId);
    return inst;
  });

  const options = () => instance().options ?? [];
  const correctIndex = () => instance().correctIndex ?? -1;
  const isCorrect = () => selected() === correctIndex();
  const status = () => {
    if (!submitted()) return "idle" as const;
    return isCorrect() ? ("correct" as const) : ("incorrect" as const);
  };

  function submit() {
    if (selected() === null || submitted()) return;
    setSubmitted(true);
    if (isCorrect()) recordInstancePassed(props.exerciseId);
  }

  function another() {
    setAttempt((a) => a + 1);
    setSelected(null);
    setSubmitted(false);
    setRevealed(false);
  }

  function tryAgain() {
    setSelected(null);
    setSubmitted(false);
    setRevealed(false);
  }

  function revealCorrect() {
    setRevealed(true);
    recordInstanceFailed(props.exerciseId);
  }

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Text tone="secondary" size="sm" family="mono">
          {props.prompt}
        </Text>
        <CodeBlock lang="ts" filename="typescript">
          {instance().ts}
        </CodeBlock>
      </Stack>

      <fieldset class="flex flex-col gap-2 m-0 p-0 border-0">
        <legend class="sr-only">Pick the idiomatic Go translation</legend>
        <For each={options()}>
          {(opt, idx) => {
            const isThis = () => selected() === idx();
            const isCorrectOpt = () => correctIndex() === idx();
            const stateClass = () => {
              if (submitted() && isCorrectOpt()) {
                return "border-success/60 bg-success/5";
              }
              if (submitted() && isThis() && !isCorrectOpt()) {
                return "border-error/60 bg-error/5";
              }
              if (revealed() && isCorrectOpt()) {
                return "border-success/60 bg-success/5";
              }
              if (isThis()) {
                return "border-accent-amber bg-accent-amber/5";
              }
              return "border-border-default hover:border-border-strong";
            };
            return (
              <label
                class={`flex items-start gap-3 p-3 border rounded-sm cursor-pointer transition-colors ${stateClass()}`}
              >
                <input
                  type="radio"
                  name={`mcq-${props.exerciseId}`}
                  value={idx()}
                  checked={isThis()}
                  disabled={submitted()}
                  onChange={() => setSelected(idx())}
                  class="mt-1.5 accent-accent-amber"
                  aria-describedby={`opt-${idx()}-text`}
                />
                <pre
                  id={`opt-${idx()}-text`}
                  class="font-mono text-sm text-fg-primary whitespace-pre-wrap leading-relaxed"
                >
                  <code>{opt}</code>
                </pre>
              </label>
            );
          }}
        </For>
      </fieldset>

      <Show when={status() !== "idle"}>
        <Feedback status={status()}>
          <Show
            when={isCorrect()}
            fallback={
              <span>
                Not quite. Try again with the same instance, ask for a hint,
                grab a different exercise, or reveal the correct option.
              </span>
            }
          >
            <span>Correct — and idiomatic.</span>
          </Show>
        </Feedback>
      </Show>

      <Stack direction="row" gap="sm" wrap>
        <Show when={!submitted()}>
          <Button
            variant="primary"
            onClick={submit}
            disabled={selected() === null}
          >
            Submit
          </Button>
        </Show>
        <Show when={submitted() && !isCorrect()}>
          <Button variant="secondary" onClick={tryAgain}>
            Try again
          </Button>
          <Button variant="ghost" onClick={another}>
            Different exercise
          </Button>
          <Show when={!revealed()}>
            <Button variant="ghost" onClick={revealCorrect}>
              Reveal correct
            </Button>
          </Show>
        </Show>
        <Show when={submitted() && isCorrect()}>
          <Button variant="primary" onClick={another}>
            Another
          </Button>
        </Show>
      </Stack>

      <Stack direction="row" gap="lg" wrap>
        <HintButton
          hints={props.hints}
          onReveal={() => recordHintUsed(props.exerciseId)}
        />
        <RevealButton canonical={instance().canonical} lang="go" />
      </Stack>
    </Stack>
  );
}
