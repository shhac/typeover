import { Show } from "solid-js";
import { Button } from "../ds/Button";

interface RunResetToolbarProps {
  running: boolean;
  /** When false the Run button is disabled (e.g. empty input). The
   *  hook's own `running` flag is added on top — consumers don't have
   *  to duplicate that guard. */
  canRun: boolean;
  onRun: () => void;
  onReset: () => void;
}

/*
 * Run + (Stop / reset runtime) buttons for Yaegi-graded exercise
 * components. Stop only surfaces while a run is in flight — the
 * intended use is recovering from a runaway loop in the learner's
 * code.
 *
 * Pulled out of Freeform + FillBlankLineInput where the same JSX
 * lived twice.
 */
export function RunResetToolbar(props: RunResetToolbarProps) {
  return (
    <div class="flex flex-row gap-2">
      <Button variant="secondary" onClick={props.onRun} disabled={props.running || !props.canRun}>
        {props.running ? "Running…" : "Run"}
      </Button>
      <Show when={props.running}>
        <Button variant="ghost" onClick={props.onReset}>
          Stop / reset runtime
        </Button>
      </Show>
    </div>
  );
}
