import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { Button } from "../ds/Button";
import { CodeBlock } from "../ds/CodeBlock";
import { Feedback } from "../ds/Feedback";
import { HintButton } from "../ds/HintButton";
import { RevealButton } from "../ds/RevealButton";
import { Stack } from "../ds/Stack";
import { Text } from "../ds/Text";
import { cn } from "../ds/_internal";
import { type GeneratorSpec, type FillSegment } from "~/lib/generator";
import { useExerciseInstance } from "~/lib/exercise-instance";
import {
  recordHintUsed,
  recordInstanceFailed,
  recordInstancePassed,
} from "~/lib/progress";

interface FillBlankWordProps {
  exerciseId: string;
  prompt: string;
  generator: GeneratorSpec;
  blanks: string[];
  hints: readonly [string, string, string];
}

type Phase = "picking" | "wrong" | "right";

export function FillBlankWord(props: FillBlankWordProps) {
  const { instance, another } = useExerciseInstance(
    props.exerciseId,
    props.generator,
    { blanks: props.blanks },
  );

  // One input value per blank slot, keyed by an index across the
  // segments array. The same blank var may legitimately appear more
  // than once in the canonical (e.g. printing a name twice), so we
  // key on slot index, not var name.
  const [inputs, setInputs] = createSignal<Record<number, string>>({});
  const [submitted, setSubmitted] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);

  const segments = () => instance().blankSegments ?? [];

  const blankPositions = createMemo<Array<{ idx: number; seg: FillSegment & { kind: "blank" } }>>(() =>
    segments().reduce<Array<{ idx: number; seg: FillSegment & { kind: "blank" } }>>(
      (acc, seg, idx) => {
        if (seg.kind === "blank") acc.push({ idx, seg });
        return acc;
      },
      [],
    ),
  );

  const allFilled = () =>
    blankPositions().every((b) => (inputs()[b.idx] ?? "") !== "");

  const allCorrect = () =>
    blankPositions().every(
      (b) => (inputs()[b.idx] ?? "") === b.seg.expected,
    );

  const phase = (): Phase => {
    if (!submitted()) return "picking";
    return allCorrect() ? "right" : "wrong";
  };

  function submit() {
    if (!allFilled() || submitted()) return;
    setSubmitted(true);
    if (allCorrect()) recordInstancePassed(props.exerciseId);
  }

  function nextInstance() {
    another();
    setInputs({});
    setSubmitted(false);
    setRevealed(false);
  }

  function tryAgain() {
    setSubmitted(false);
    setRevealed(false);
    // Keep partial inputs — the learner is iterating, not restarting.
  }

  function clearInputs() {
    setInputs({});
    setSubmitted(false);
    setRevealed(false);
  }

  function revealCorrect() {
    setRevealed(true);
    recordInstanceFailed(props.exerciseId);
  }

  function inputClass(slotIdx: number, expected: string): string {
    const value = inputs()[slotIdx] ?? "";
    if (revealed()) {
      return value === expected
        ? "border-success/60 bg-success/5 text-success"
        : "border-error/60 bg-error/5 text-error";
    }
    if (submitted()) {
      return value === expected
        ? "border-success/60 bg-success/5"
        : "border-error/60 bg-error/5";
    }
    return "border-border-strong focus-within:border-accent-amber";
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

      <div class="border border-border-default rounded-sm overflow-hidden">
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-border-default bg-accent-go/5">
          <span class="font-mono text-[11px] text-fg-muted">your turn — fill the blanks</span>
          <span class="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border rounded-sm text-accent-go border-accent-go/40">
            GO
          </span>
        </div>
        <pre class="px-4 py-3 overflow-x-auto bg-bg-inset text-fg-primary font-mono text-[13px] leading-relaxed">
          <code>
            <For each={segments()}>
              {(seg, idx) => {
                if (seg.kind === "text") return <span>{seg.text}</span>;
                const slotIdx = idx();
                return (
                  <input
                    type="text"
                    autocomplete="off"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck={false}
                    disabled={submitted() && allCorrect()}
                    value={inputs()[slotIdx] ?? ""}
                    aria-label={`fill-in blank ${seg.varName}`}
                    onInput={(e) =>
                      setInputs((prev) => ({
                        ...prev,
                        [slotIdx]: e.currentTarget.value,
                      }))
                    }
                    class={cn(
                      "inline-block px-1.5 py-0.5 bg-bg-base font-mono text-[13px]",
                      "border rounded-sm outline-none align-baseline",
                      "min-w-[3ch] w-[var(--w,_auto)]",
                      inputClass(slotIdx, seg.expected),
                    )}
                    style={{
                      width: `${Math.max(seg.expected.length + 1, 3)}ch`,
                    }}
                  />
                );
              }}
            </For>
          </code>
        </pre>
      </div>

      <Show when={phase() !== "picking"}>
        <Feedback status={phase() === "right" ? "correct" : "incorrect"}>
          <Show
            when={phase() === "right"}
            fallback={
              <span>
                One or more blanks are off. Try again, clear and start over,
                grab a different exercise, or reveal the correct answer.
              </span>
            }
          >
            <span>Correct — every blank matches.</span>
          </Show>
        </Feedback>
      </Show>

      <Stack direction="row" gap="sm" wrap>
        <Switch>
          <Match when={phase() === "picking"}>
            <Button
              variant="primary"
              onClick={submit}
              disabled={!allFilled()}
            >
              Submit
            </Button>
            <Show when={Object.keys(inputs()).length > 0}>
              <Button variant="ghost" onClick={clearInputs}>
                Clear
              </Button>
            </Show>
          </Match>
          <Match when={phase() === "wrong"}>
            <Button variant="secondary" onClick={tryAgain}>
              Try again
            </Button>
            <Button variant="ghost" onClick={clearInputs}>
              Clear
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
