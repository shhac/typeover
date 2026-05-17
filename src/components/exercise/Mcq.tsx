import { createSignal, Match, Show, Switch, For } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { Feedback } from "../ds/Feedback";
import { HintButton } from "../ds/HintButton";
import { RevealButton } from "../ds/RevealButton";
import { Stack } from "../ds/Stack";
import { Text } from "../ds/Text";
import { type GeneratorSpec } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import {
  recordHintUsed,
  recordInstanceFailed,
  recordInstancePassed,
} from "~/lib/progress";
import { McqOption } from "./McqOption";

interface McqProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  hints: readonly [string, string, string];
}

type Phase = "picking" | "wrong" | "right";

export function Mcq(props: McqProps) {
  const { instance, another } = useExerciseInstance(
    props.exerciseId,
    props.generator,
  );

  const [selected, setSelected] = createSignal<number | null>(null);
  const [submitted, setSubmitted] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);

  const options = () => instance().options ?? [];
  const correctIndex = () => instance().correctIndex ?? -1;
  const isCorrect = () => selected() === correctIndex();

  const phase = (): Phase => {
    if (!submitted()) return "picking";
    return isCorrect() ? "right" : "wrong";
  };

  function submit() {
    if (selected() === null || submitted()) return;
    setSubmitted(true);
    if (isCorrect()) recordInstancePassed(props.exerciseId);
  }

  function nextInstance() {
    another();
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
          {(opt, idx) => (
            <McqOption
              groupName={`mcq-${props.exerciseId}`}
              index={idx()}
              text={opt}
              selected={selected() === idx()}
              submitted={submitted()}
              revealed={revealed()}
              isCorrect={correctIndex() === idx()}
              onSelect={() => setSelected(idx())}
            />
          )}
        </For>
      </fieldset>

      <Show when={phase() !== "picking"}>
        <Feedback status={phase() === "right" ? "correct" : "incorrect"}>
          <Show
            when={phase() === "right"}
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
        <Switch>
          <Match when={phase() === "picking"}>
            <Button
              variant="primary"
              onClick={submit}
              disabled={selected() === null}
            >
              Submit
            </Button>
          </Match>
          <Match when={phase() === "wrong"}>
            <Button variant="secondary" onClick={tryAgain}>
              Try again
            </Button>
            <Button variant="ghost" onClick={nextInstance}>
              Different exercise
            </Button>
            <Show when={!revealed()}>
              <Button variant="ghost" onClick={revealCorrect}>
                Reveal correct
              </Button>
            </Show>
          </Match>
          <Match when={phase() === "right"}>
            <Button variant="primary" onClick={nextInstance}>
              Another
            </Button>
          </Match>
        </Switch>
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
