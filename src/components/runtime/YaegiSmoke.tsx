import { createSignal, Show } from "solid-js";
import { getRunner } from "~/runtime";

/*
 * Browser-side smoke island for the Yaegi worker. Exists purely to
 * verify the worker + Comlink + WASM chain end-to-end before the
 * freeform exercise component lands. Mounted at /runtime-smoke for
 * dev inspection; not linked from the curriculum.
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

interface RunOutcome {
  stdout: string;
  stderr: string;
  error: string;
  durationMs: number;
}

export function YaegiSmoke() {
  const [code, setCode] = createSignal(DEFAULT_CODE);
  const [running, setRunning] = createSignal(false);
  const [outcome, setOutcome] = createSignal<RunOutcome | null>(null);

  async function run() {
    setRunning(true);
    setOutcome(null);
    const t0 = performance.now();
    try {
      const runner = getRunner();
      const r = await runner.eval(code());
      setOutcome({
        stdout: r.stdout,
        stderr: r.stderr,
        error: r.error,
        durationMs: performance.now() - t0,
      });
    } catch (e) {
      setOutcome({
        stdout: "",
        stderr: "",
        error: e instanceof Error ? e.message : String(e),
        durationMs: performance.now() - t0,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div class="flex flex-col gap-3">
      <textarea
        class="font-mono text-sm bg-bg-inset text-fg-primary p-3 rounded-sm border border-border-default min-h-[200px]"
        value={code()}
        onInput={(e) => setCode(e.currentTarget.value)}
      />
      <button
        type="button"
        onClick={run}
        disabled={running()}
        class="h-11 px-4 self-start rounded-sm bg-accent-amber text-bg-base font-medium disabled:opacity-50"
      >
        {running() ? "Running…" : "Run"}
      </button>
      <Show when={outcome()}>
        {(r) => (
          <div class="flex flex-col gap-2 font-mono text-sm">
            <div class="text-fg-faint text-xs">{r().durationMs.toFixed(1)}ms</div>
            <Show when={r().stdout}>
              <pre class="bg-bg-inset p-3 rounded-sm border border-success/30">{r().stdout}</pre>
            </Show>
            <Show when={r().stderr}>
              <pre class="bg-bg-inset p-3 rounded-sm border border-error/30">{r().stderr}</pre>
            </Show>
            <Show when={r().error}>
              <pre class="bg-error/5 p-3 rounded-sm border border-error/40 text-error">
                {r().error}
              </pre>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
