import { Show } from "solid-js";
import { FOCUS_RING_CLASS } from "../ds/_internal";
import { CodePane } from "../ds/CodePane";
import { Text } from "../ds/Text";
import { stdoutMatches, type RunResult } from "~/lib/use-runtime-run";

interface RunResultPanelProps {
  result: RunResult;
  /** The expected stdout to compare against. Used to colour the
   *  stdout pane (green on match, red on mismatch). The grading
   *  decision itself lives in the consumer's `isCorrect` predicate;
   *  the panel only mirrors the comparison visually. */
  expectStdout: string;
  /** Ref escape hatch so consumers (Freeform / FillBlankLineInput)
   *  can move focus to the panel after a Run completes — sighted
   *  keyboard users land on the result instead of losing focus to
   *  <body>, and screen-reader users land inside a labelled region
   *  rather than a generic <div>. The panel is `tabindex="-1"` so
   *  it's programmatically focusable but not in the tab order.
   *  Lighter variant of design-docs/24 P4. */
  ref?: (el: HTMLDivElement) => void;
}

/*
 * Renders the {stdout, stderr, error, durationMs} produced by a
 * useRuntimeRun.run() call. Shared between Freeform, FillBlankLineInput,
 * and the dev-only SmokeProbe.
 *
 * Two design decisions worth knowing (both per design-docs/16 F-14
 * + 18 F-11):
 *
 *   - "expected" and "actual" stdout render as parallel <pre>
 *     blocks (not as a one-line JSON-stringified header). A learner
 *     diffing N lines of output should see them in the same format.
 *
 *   - Empty stdout is a valid pane state, not a hidden one. When
 *     the canonical exercise expects empty output (the
 *     content:new-theme stubs all do), a successful run produces
 *     empty stdout and we render a placeholder "(no output)" pane
 *     so the learner gets visible confirmation, not silence.
 */
export function RunResultPanel(props: RunResultPanelProps) {
  const matches = () => stdoutMatches(props.result, props.expectStdout);
  const noOutput = <span class="text-fg-faint italic">(no output)</span>;

  return (
    <div
      ref={props.ref}
      role="region"
      aria-label="Run result"
      tabindex="-1"
      class={"flex flex-col gap-2 font-mono text-sm rounded-sm " + FOCUS_RING_CLASS}
    >
      <Text tone="faint" size="xs" family="mono">
        {props.result.durationMs.toFixed(1)} ms
      </Text>

      {/* Side-by-side stdout vs expected. Both render even when
       * one is empty — the placeholder reads "(no output)" so a
       * learner with empty expected stdout sees a green-bordered
       * confirmation pane on a passing run. */}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Text tone="faint" size="xs" family="mono" class="mb-1">
            what you got
          </Text>
          <CodePane tone={matches() ? "success" : "error"}>
            <Show when={props.result.stdout !== ""} fallback={noOutput}>
              {props.result.stdout}
            </Show>
          </CodePane>
        </div>
        <div>
          <Text tone="faint" size="xs" family="mono" class="mb-1">
            what we wanted
          </Text>
          <CodePane tone="neutral">
            <Show when={props.expectStdout !== ""} fallback={noOutput}>
              {props.expectStdout}
            </Show>
          </CodePane>
        </div>
      </div>

      <Show when={props.result.stderr !== ""}>
        <CodePane tone="error">
          <span class="text-fg-faint text-xs mr-2">stderr</span>
          {props.result.stderr}
        </CodePane>
      </Show>
      <Show when={props.result.error !== ""}>
        <CodePane tone="errorEmphatic">
          <span class="text-fg-faint text-xs mr-2">error</span>
          {props.result.error}
        </CodePane>
      </Show>
    </div>
  );
}
