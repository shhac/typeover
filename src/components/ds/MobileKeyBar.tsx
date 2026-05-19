import type { JSX } from "solid-js";
import { For, Show, splitProps } from "solid-js";
import { cn } from "./_internal";

/*
 * MobileKeyBar — sticky Go-symbol bar docked above the mobile
 * software keyboard. design-docs/08 + 99.
 *
 * Why this exists: every Go symbol (`{`, `}`, `:=`, `&`, `*`,
 * `\t`) is 2-3 taps deep on stock iOS/Android keyboards. The bar
 * surfaces them as one-tap inserts so freeform code editing on a
 * phone is actually usable, not theoretically supported.
 *
 * Two ergonomic decisions worth knowing:
 *
 *   1. `onPointerDown` with `preventDefault()` on every key —
 *      without this, iOS Safari blurs the originating textarea
 *      and the software keyboard collapses on tap. With it the
 *      textarea stays focused and the caret survives.
 *
 *   2. `position: fixed; bottom: 0` + `lg:hidden` — the bar is
 *      a mobile-only surface. Desktop users with hardware
 *      keyboards have all symbols one tap away already.
 *
 * Open follow-up: iOS Safari's visual viewport overlays the
 * layout viewport when the soft keyboard is up, so a
 * `bottom: 0` element actually lands BEHIND the keyboard. The
 * fix is to subscribe to `visualViewport.resize` and translate
 * the bar by `(window.innerHeight - visualViewport.height)`.
 * Not built here; requires real-device verification rather than
 * simulator-based testing. Marked in design-docs/99.
 */

export interface KeySpec {
  /** Visible label on the button. */
  label: string;
  /** Text to inject at the caret when the key is tapped. */
  insert: string;
  /** Accessible name when the label is symbolic. */
  ariaLabel?: string;
}

/** Default key set for Go-on-mobile. Authors don't reinvent it
 *  per caller — they can override via the `keys` prop when a
 *  different surface (e.g. a future SQL editor) wants its own. */
export const GO_KEYS: readonly KeySpec[] = [
  { label: "Tab", insert: "  ", ariaLabel: "tab (two spaces)" },
  { label: "{", insert: "{", ariaLabel: "open brace" },
  { label: "}", insert: "}", ariaLabel: "close brace" },
  { label: "(", insert: "(", ariaLabel: "open paren" },
  { label: ")", insert: ")", ariaLabel: "close paren" },
  { label: "[", insert: "[", ariaLabel: "open bracket" },
  { label: "]", insert: "]", ariaLabel: "close bracket" },
  { label: "<", insert: "<", ariaLabel: "less than" },
  { label: ">", insert: ">", ariaLabel: "greater than" },
  { label: ":=", insert: ":=", ariaLabel: "short assign" },
  { label: "=", insert: "=", ariaLabel: "equals" },
  { label: "*", insert: "*", ariaLabel: "asterisk" },
  { label: "&", insert: "&", ariaLabel: "ampersand" },
  { label: '"', insert: '"', ariaLabel: "double quote" },
  { label: ";", insert: ";", ariaLabel: "semicolon" },
  { label: "⏎", insert: "\n", ariaLabel: "newline" },
];

interface MobileKeyBarProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Override the key set. Defaults to GO_KEYS. */
  keys?: readonly KeySpec[];
  /** Called with the `insert` string when a key is tapped. The
   *  caller forwards to `insertAtSelection(textarea, text)` (or
   *  whatever the focused surface needs). */
  onInsert: (text: string) => void;
  /** Optional Run shortcut docked on the right edge. */
  onRun?: () => void;
}

export function MobileKeyBar(props: MobileKeyBarProps) {
  const [local, rest] = splitProps(props, ["keys", "onInsert", "onRun", "class"]);
  const keys = () => local.keys ?? GO_KEYS;

  return (
    <div
      {...rest}
      role="toolbar"
      aria-label="Code symbols"
      class={cn(
        "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
        "bg-bg-elevated border-t border-border-strong overflow-x-auto",
        local.class,
      )}
      data-mobile-key-bar
    >
      <div class="flex flex-row min-h-11">
        <For each={keys()}>
          {(k) => (
            <button
              type="button"
              aria-label={k.ariaLabel ?? k.label}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => local.onInsert(k.insert)}
              class="font-mono text-sm text-fg-primary min-w-11 min-h-11 px-3 hover:bg-bg-panel transition-colors border-r border-border-default last:border-r-0 flex items-center justify-center"
            >
              {k.label}
            </button>
          )}
        </For>
        <Show when={local.onRun}>
          <button
            type="button"
            aria-label="Run"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => local.onRun?.()}
            class="font-mono text-sm font-medium text-bg-base bg-accent-amber min-w-11 min-h-11 px-4 ml-auto flex items-center justify-center hover:bg-accent-amber/90 transition-colors"
          >
            Run
          </button>
        </Show>
      </div>
    </div>
  );
}
