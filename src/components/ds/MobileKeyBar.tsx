import type { JSX } from "solid-js";
import { createSignal, For, onCleanup, onMount, Show, splitProps } from "solid-js";
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
 * Keyboard-overlap handling: on iOS Safari the soft keyboard
 * overlays the layout viewport, so a `bottom: 0` element lands
 * BEHIND the keyboard. `useKeyboardInset()` subscribes to
 * `visualViewport.resize` / `scroll` and tracks the bottom gap
 * between the layout viewport and the visual viewport — that gap
 * is exactly the keyboard height plus any toolbars below it.
 *
 * Chrome Android (default behaviour) shrinks the layout viewport
 * when the keyboard opens, so the bar already lands above the
 * keyboard with `bottom: 0`; the visualViewport gap is 0 in that
 * case, so the JS hook is a no-op. With
 * `navigator.virtualKeyboard.overlaysContent = true` opted in
 * elsewhere, Chrome Android matches iOS and the hook kicks in.
 *
 * Other browsers / no visualViewport API → graceful fallback to
 * the original `bottom: 0` behaviour.
 *
 * Real-device validation across iOS Safari + Chrome Android is
 * still pending the launch-checklist mobile QA pass; the structural
 * logic + jsdom-safe no-op fallback are verified.
 */

/** Reactive bottom-gap between layout viewport and visual
 *  viewport. 0 when there's no visual-viewport API (SSR, jsdom,
 *  older Safari) or when no keyboard is up. */
function useKeyboardInset(): () => number {
  const [inset, setInset] = createSignal(0);
  onMount(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const gap = window.innerHeight - (vv.offsetTop + vv.height);
      setInset(Math.max(0, Math.round(gap)));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    onCleanup(() => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    });
  });
  return inset;
}

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
  const inset = useKeyboardInset();

  /* In-flow spacer matches the bar's height so the fixed bar
   * doesn't overlap the page's natural bottom edge (Submit
   * button, RunResultPanel, …). lg:hidden — desktop doesn't
   * see the bar and doesn't need the spacer either.
   * design-docs/19 F-13. */
  return (
    <>
      <div aria-hidden="true" class="lg:hidden h-11" />
      <div
        {...rest}
        role="toolbar"
        aria-label="Code symbols"
        class={cn(
          "fixed left-0 right-0 z-50 lg:hidden",
          "bg-bg-elevated border-t border-border-strong overflow-x-auto",
          local.class,
        )}
        style={{ bottom: `${inset()}px` }}
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
    </>
  );
}
