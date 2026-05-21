import { Show } from "solid-js";
import { Button } from "../ds/Button";
import { Text } from "../ds/Text";
import type { RuntimeStatus } from "~/lib/use-runtime-run";

interface RunResetToolbarProps {
  running: boolean;
  /** When false the Run button is disabled (e.g. empty input). The
   *  hook's own `running` flag is added on top — consumers don't have
   *  to duplicate that guard. */
  canRun: boolean;
  onRun: () => void;
  onReset: () => void;
  /** Optional boot status. When supplied, surfaces a "Booting <lang>
   *  runtime…" indicator and gates Run while booting. Without it the
   *  toolbar behaves as before (back-compat for any future consumer
   *  that wants to skip the runtime UI). design-docs/16 F-4. */
  runtimeStatus?: RuntimeStatus;
  /** Human label for the runtime, used in the boot badge copy
   *  ("Booting <runtimeLabel> runtime…"). Defaults to "Go" for
   *  back-compat with callers that haven't started threading the
   *  hook's runtimeLabel through. */
  runtimeLabel?: string;
  /** Companion to `runtimeStatus`. Surfaces a boot failure message. */
  bootError?: string | null;
  /** True when boot has been stuck on "booting" past the stall
   *  threshold (5s). Escalates the badge copy and surfaces a
   *  "Retry runtime" button. design-docs/26 P12. */
  bootStalled?: boolean;
}

/*
 * Run + (Stop / reset runtime) buttons for Yaegi-graded exercise
 * components. Stop only surfaces while a run is in flight — the
 * intended use is recovering from a runaway loop in the learner's
 * code.
 *
 * Pulled out of Freeform + FillBlankLineInput where the same JSX
 * lived twice. Now also surfaces the Yaegi cold-start: a "Booting Go
 * runtime…" badge during the ~1.9 MB first-load WASM download
 * (design-docs/16 F-4). Without it a learner clicking Run on a slow
 * connection saw a frozen-looking button and assumed the site broke.
 */
export function RunResetToolbar(props: RunResetToolbarProps) {
  const booting = () => props.runtimeStatus === "booting";
  const bootFailed = () => props.runtimeStatus === "error";
  const runDisabled = () => props.running || !props.canRun || booting() || bootFailed();
  /* Keep the button label as the canonical action verb ("Run" /
   * "Running…"). The boot state lives in the adjacent badge so the
   * disabled reason is explained without smuggling a status word
   * into the action label — a screen reader user already gets the
   * disabled state from `aria-disabled`. */
  const runLabel = () => (props.running ? "Running…" : "Run");

  return (
    <div class="flex flex-row gap-2 items-center flex-wrap">
      <Button variant="secondary" onClick={props.onRun} disabled={runDisabled()}>
        {runLabel()}
      </Button>
      <Show when={props.running}>
        <Button variant="ghost" onClick={props.onReset}>
          Stop / reset runtime
        </Button>
      </Show>
      <Show when={booting() && !props.bootStalled}>
        <Text tone="muted" size="xs" family="mono">
          ↳ Booting {props.runtimeLabel ?? "Go"} runtime… one-time download
        </Text>
      </Show>
      <Show when={booting() && props.bootStalled}>
        {/* Escalated badge after BOOT_STALL_MS — surfaces an
         * actionable retry rather than letting the learner sit
         * on a frozen "Booting…" indefinitely. The Retry button
         * calls onReset, which terminates the worker + flips
         * status back to "uninit"; a subsequent Run triggers a
         * fresh preflight against a respawned worker. */}
        <Text size="xs" family="mono" class="text-error">
          ↳ Still downloading runtime — slow network?
        </Text>
        <Button variant="ghost" onClick={props.onReset}>
          Retry runtime
        </Button>
      </Show>
      <Show when={bootFailed()}>
        <Text size="xs" family="mono" class="text-error">
          ↳ Runtime boot failed{props.bootError ? ` · ${props.bootError}` : ""}
        </Text>
      </Show>
    </div>
  );
}
