import { createSignal, Show } from "solid-js";
import { useRuntimeRun } from "~/lib/use-runtime-run";
import { RunResetToolbar } from "./RunResetToolbar";
import { RunResultPanel } from "./RunResultPanel";

/*
 * Browser-side smoke island for the Yaegi worker. Exists purely to
 * verify the worker + Comlink + WASM chain end-to-end before
 * exercise components consume it. Mounted at /runtime-smoke for dev
 * inspection; not linked from any user-facing nav.
 *
 * Co-located with the exercise components it shares (RunResetToolbar
 * + RunResultPanel) — previously lived under `src/components/runtime/`
 * which created a `components/runtime → components/exercise` peer
 * dependency flagged by the seam audit. The probe IS exercise-shaped:
 * same lifecycle, same toolbar, same result panel.
 */

const DEFAULT_CODE = `package main

import "fmt"

func main() {
	fmt.Println("hello from yaegi (browser)")
	for i := 1; i <= 3; i++ {
		fmt.Printf("  i = %d\\n", i)
	}
}
`;

/* Expected stdout for the default snippet — used by RunResultPanel to
 * green-vs-red the stdout pane. The smoke probe isn't grading
 * anything; this is only visual feedback for "did the run produce
 * what we expected?". */
const DEFAULT_EXPECT = `hello from yaegi (browser)
  i = 1
  i = 2
  i = 3
`;

export function SmokeProbe() {
  const [code, setCode] = createSignal(DEFAULT_CODE);
  const yaegi = useRuntimeRun({ runtime: "yaegi", buildProgram: () => code() });

  return (
    <div class="flex flex-col gap-3">
      <textarea
        class="font-mono text-sm bg-bg-inset text-fg-primary p-3 rounded-sm border border-border-default min-h-[200px]"
        value={code()}
        onInput={(e) => setCode(e.currentTarget.value)}
      />
      <RunResetToolbar
        running={yaegi.running()}
        canRun={code().trim() !== ""}
        onRun={yaegi.run}
        onReset={yaegi.reset}
      />
      <Show when={yaegi.runResult()}>
        {(r) => <RunResultPanel result={r()} expectStdout={DEFAULT_EXPECT} />}
      </Show>
    </div>
  );
}
