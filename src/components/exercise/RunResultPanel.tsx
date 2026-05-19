import { Show } from "solid-js";
import { Text } from "../ds/Text";
import type { RunResult } from "~/lib/use-yaegi-run";

interface RunResultPanelProps {
  result: RunResult;
  /** The expected stdout to compare against. Used to colour the
   *  stdout pane (green on match, red on mismatch). The grading
   *  decision itself lives in the consumer's `isCorrect` predicate;
   *  the panel only mirrors the comparison visually. */
  expectStdout: string;
}

/*
 * Renders the {stdout, stderr, error, durationMs} produced by a
 * useYaegiRun.run() call. Shared between Freeform, FillBlankLineInput,
 * and the dev-only YaegiSmoke probe — used to be ~30 LOC of identical
 * <Show><pre>…</pre></Show> chains in each consumer.
 */
export function RunResultPanel(props: RunResultPanelProps) {
  return (
    <div class="flex flex-col gap-2 font-mono text-sm">
      <Text tone="faint" size="xs" family="mono">
        {props.result.durationMs.toFixed(1)} ms · expected{" "}
        <code class="text-fg-primary">{JSON.stringify(props.expectStdout)}</code>
      </Text>
      <Show when={props.result.stdout !== ""}>
        <pre
          class={
            "bg-bg-inset p-3 rounded-sm border whitespace-pre-wrap " +
            (props.result.stdout === props.expectStdout ? "border-success/40" : "border-error/40")
          }
        >
          <span class="text-fg-faint text-xs mr-2">stdout</span>
          {props.result.stdout}
        </pre>
      </Show>
      <Show when={props.result.stderr !== ""}>
        <pre class="bg-bg-inset p-3 rounded-sm border border-error/40 whitespace-pre-wrap">
          <span class="text-fg-faint text-xs mr-2">stderr</span>
          {props.result.stderr}
        </pre>
      </Show>
      <Show when={props.result.error !== ""}>
        <pre class="bg-error/5 p-3 rounded-sm border border-error/40 text-error whitespace-pre-wrap">
          <span class="text-fg-faint text-xs mr-2">error</span>
          {props.result.error}
        </pre>
      </Show>
    </div>
  );
}
