import { createSignal, For, Show } from "solid-js";
import { Button } from "./Button";

interface HintButtonProps {
  hints: readonly [string, string, string];
  /** Called each time a hint is revealed (1, 2, or 3). For tracking. */
  onReveal?: (layer: 1 | 2 | 3) => void;
}

/**
 * HintButton: single button, three escalating reveals.
 *   click 1 → conceptual hint
 *   click 2 → structural hint
 *   click 3 → near-answer
 * Internally tracked; no visual penalty.
 */
export function HintButton(props: HintButtonProps) {
  const [revealed, setRevealed] = createSignal<0 | 1 | 2 | 3>(0);

  const next = () => {
    const r = revealed();
    if (r >= 3) return;
    const layer = (r + 1) as 1 | 2 | 3;
    setRevealed(layer);
    props.onReveal?.(layer);
  };

  const label = () => {
    const r = revealed();
    if (r === 0) return "Hint";
    if (r < 3) return "Another hint";
    return "No more hints";
  };

  const visible = () => props.hints.slice(0, revealed());

  return (
    <div class="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="md"
        onClick={next}
        disabled={revealed() >= 3}
        aria-label={`${label()} — currently showing ${revealed()} of 3`}
      >
        {label()}
      </Button>
      <Show when={revealed() > 0}>
        <ul
          class="flex flex-col gap-2 text-sm text-fg-secondary border-l-2 border-accent-amber/40 pl-4"
          aria-live="polite"
        >
          <For each={visible()}>
            {(hint, i) => (
              <li>
                <span class="text-fg-faint font-mono text-xs mr-2">
                  hint {i() + 1}
                </span>
                {hint}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
