import { createSignal, For, Show } from "solid-js";
import { Button } from "./Button";
import { formatInline } from "~/lib/format-inline";

interface HintButtonProps {
  hints: readonly [string, string, string];
  /** Resolved instance values for placeholder substitution. When present,
   *  any `${name}` in a hint is replaced with `values[name]` before
   *  formatInline runs. Lenient — unknown placeholders are left as-is
   *  so a hint copy-pasted from a sibling exercise doesn't crash the
   *  render, just renders with the placeholder visible (authoring
   *  smell that the author will spot). */
  values?: Record<string, string>;
  /** Called each time a hint is revealed. For tracking; the layer
   *  index is captured internally via `revealed()` if a future consumer
   *  needs per-layer stats — today's consumer only counts totals. */
  onReveal?: () => void;
}

/** Replace `${name}` occurrences with `values[name]` when known, leave
 *  the placeholder intact when unknown. Used only for hint substitution
 *  — template parsing uses the strict `substitute()` in generator.ts. */
function resolveHint(hint: string, values: Record<string, string> | undefined): string {
  if (!values) return hint;
  return hint.replace(/\$\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
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
    setRevealed((r + 1) as 1 | 2 | 3);
    props.onReveal?.();
  };

  const label = () => (revealed() === 0 ? "Hint" : "Another hint");
  const exhausted = () => revealed() >= 3;

  const visible = () => props.hints.slice(0, revealed());

  /* After the third hint is revealed the button collapses to a quiet
   * "all three shown" caption. The earlier "No more hints" label was
   * a permanent dead button that read as punitive — design-docs/16
   * F-5. The RevealButton in the shell handles the canonical from
   * here. */
  return (
    <div class="flex flex-col gap-3">
      <Show
        when={!exhausted()}
        fallback={
          <span class="font-mono text-xs text-fg-faint">all three hints shown</span>
        }
      >
        <Button
          variant="ghost"
          size="md"
          onClick={next}
          aria-label={`${label()} — currently showing ${revealed()} of 3`}
        >
          {label()}
        </Button>
      </Show>
      <Show when={revealed() > 0}>
        <ul
          class="flex flex-col gap-2 text-sm text-fg-secondary border-l-2 border-accent-amber/40 pl-4"
          aria-live="polite"
        >
          <For each={visible()}>
            {(hint, i) => (
              <li>
                <span class="text-fg-faint font-mono text-xs mr-2">hint {i() + 1}</span>
                <span innerHTML={formatInline(resolveHint(hint, props.values))} />
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
