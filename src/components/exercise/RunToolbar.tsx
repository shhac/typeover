import type { JSX } from "solid-js";
import type { RuntimeRunHandle } from "~/lib/use-runtime-run";
import { RunResetToolbar } from "./RunResetToolbar";

/*
 * Bundles the standard Run/Reset toolbar wiring + an optional
 * "Submit is gated" nudge slot. Wraps `<RunResetToolbar>` with the
 * runner accessors pre-threaded so consumers don't hand-write the
 * nine-prop spread each time.
 *
 * Used by Freeform + FillBlankLineInput — the JSX was identical
 * between them apart from the canRun source (input-presence vs.
 * runner.canRun) and the nudge string. Both diverge knobs are
 * lifted onto this wrapper's props.
 *
 * Adding a fourth runner-driven surface (e.g. the dev SmokeProbe)
 * lands a single import + three lines of JSX instead of a third
 * copy of the spread.
 */

interface RunToolbarProps {
  /** The hook handle. The wrapper spreads its accessors into
   *  `<RunResetToolbar>`. */
  runner: RuntimeRunHandle;
  /** Override the canRun source. Defaults to `runner.canRun`.
   *  Fill-line surfaces compute it from input-presence; freeform
   *  takes the hook's value verbatim. */
  canRun?: boolean;
  /** Optional explanatory text rendered next to the toolbar (the
   *  "↳ Run your code first to enable Submit" hint). The caller
   *  owns the `<Show>` visibility predicate and the message — the
   *  wrapper just provides the slot. */
  nudge?: JSX.Element;
}

export function RunToolbar(props: RunToolbarProps) {
  return (
    <div class="flex flex-row gap-3 items-center flex-wrap">
      <RunResetToolbar
        running={props.runner.running()}
        canRun={props.canRun ?? props.runner.canRun}
        onRun={props.runner.run}
        onReset={props.runner.reset}
        runtimeStatus={props.runner.runtimeStatus()}
        runtimeLabel={props.runner.runtimeLabel}
        bootError={props.runner.bootError()}
        bootStalled={props.runner.bootStalled()}
      />
      {props.nudge}
    </div>
  );
}
