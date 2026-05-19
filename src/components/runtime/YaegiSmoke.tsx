import { createSignal, Show } from "solid-js";
import { useYaegiRun } from "~/lib/use-yaegi-run";
import { RunResetToolbar } from "../exercise/RunResetToolbar";
import { RunResultPanel } from "../exercise/RunResultPanel";

/*
 * Browser-side smoke island for the Yaegi worker. Exists purely to
 * verify the worker + Comlink + WASM chain end-to-end before
 * exercise components consume it. Mounted at /runtime-smoke for dev
 * inspection; not linked from any user-facing nav.
 *
 * Shares useYaegiRun + RunResetToolbar + RunResultPanel with the
 * production exercise surfaces — same lifecycle, same visual
 * vocabulary.
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

export function YaegiSmoke() {
  const [code, setCode] = createSignal(DEFAULT_CODE);
  const yaegi = useYaegiRun({ buildProgram: () => code() });

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
