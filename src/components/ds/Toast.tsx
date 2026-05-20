import { createSignal, onCleanup, Show, type JSX } from "solid-js";
import { cn } from "./_internal";

/*
 * Toast — short-lived status-region anchored bottom-center. Used by
 * the settings page to acknowledge a setter that would otherwise be
 * silent ("Theme: dark · undo"). aria-live=polite so screen readers
 * announce the change without stealing focus.
 *
 * design-docs/16 F-15. The original complaint: changing a theme on
 * /settings was silent — no confirmation, no undo. Toast carries
 * both: the message names the new state; the optional `onUndo`
 * surface restores the previous value if the change was a mis-pick.
 *
 * Auto-dismiss is intentionally short (4s) — the toast competes with
 * the preview pane, which is the real confirmation; toast is the
 * secondary, time-bounded channel. Hover and focus pause the timer
 * so a keyboard user can read it before it fades.
 *
 * Renders nothing when `message()` is null — the parent owns the
 * signal lifecycle. Use `useToast()` for the canonical timer +
 * dismiss helper.
 */

export interface ToastState {
  message: string;
  onUndo?: () => void;
}

interface ToastProps {
  state: () => ToastState | null;
  onDismiss: () => void;
  /** Auto-dismiss after this many milliseconds. Default 4000. */
  durationMs?: number;
}

export function Toast(props: ToastProps) {
  return (
    <Show when={props.state()}>
      {(state) => <ToastBody state={state()} onDismiss={props.onDismiss} duration={props.durationMs ?? 4000} />}
    </Show>
  );
}

interface ToastBodyProps {
  state: ToastState;
  onDismiss: () => void;
  duration: number;
}

function ToastBody(props: ToastBodyProps): JSX.Element {
  const [paused, setPaused] = createSignal(false);
  let remaining = props.duration;
  let startedAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleDismiss = (ms: number) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(props.onDismiss, ms);
  };
  scheduleDismiss(remaining);

  const pause = () => {
    if (paused()) return;
    setPaused(true);
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
  };
  const resume = () => {
    if (!paused()) return;
    setPaused(false);
    startedAt = performance.now();
    scheduleDismiss(remaining);
  };

  onCleanup(() => {
    if (timer !== null) clearTimeout(timer);
  });

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusIn={pause}
      onFocusOut={resume}
      class={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex flex-row items-center gap-3",
        "bg-bg-elevated text-fg-primary border border-border-strong rounded-sm",
        "px-4 py-2 font-mono text-xs shadow-panel",
      )}
    >
      <span>{props.state.message}</span>
      <Show when={props.state.onUndo}>
        {(undo) => (
          <button
            type="button"
            onClick={() => {
              undo()();
              props.onDismiss();
            }}
            class="text-accent-amber hover:underline focus-visible:outline-2 focus-visible:outline-accent-amber rounded-sm uppercase tracking-widest"
          >
            undo
          </button>
        )}
      </Show>
      <button
        type="button"
        onClick={props.onDismiss}
        aria-label="Dismiss"
        class="text-fg-muted hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-accent-amber rounded-sm w-4 h-4 flex items-center justify-center leading-none"
      >
        ×
      </button>
    </div>
  );
}

/** Convenience hook bundling the toast state + emitter. Each call to
 *  `emit` replaces the current toast (last-write-wins — a learner
 *  flipping three settings quickly sees only the latest). */
export function useToast() {
  const [state, setState] = createSignal<ToastState | null>(null);
  return {
    state,
    emit: (next: ToastState) => setState(next),
    dismiss: () => setState(null),
  };
}
