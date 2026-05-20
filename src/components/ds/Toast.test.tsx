import { fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast, useToast, type ToastState } from "./Toast";

/*
 * Toast — short-lived status region with optional undo. Pins the
 * accessibility contract (role=status, aria-live=polite), the auto-
 * dismiss timer, and the pause-on-hover behaviour that lets a
 * keyboard user actually read the toast before it disappears.
 * design-docs/16 F-15.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const renderToast = (state: () => ToastState | null, onDismiss = vi.fn()) =>
  render(() => <Toast state={state} onDismiss={onDismiss} durationMs={4000} />);

describe("<Toast>", () => {
  it("renders nothing when state is null", () => {
    const [state] = createSignal<ToastState | null>(null);
    const { container } = renderToast(state);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders the message inside a polite status region", () => {
    const [state] = createSignal<ToastState | null>({ message: "Theme: Dark" });
    const { container } = renderToast(state);
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute("aria-live")).toBe("polite");
    expect(region!.textContent).toContain("Theme: Dark");
  });

  it("renders an undo button only when onUndo is supplied", () => {
    const [withUndo] = createSignal<ToastState | null>({
      message: "Theme: Dark",
      onUndo: () => {},
    });
    const { getByText, unmount } = renderToast(withUndo);
    expect(getByText("undo")).toBeTruthy();
    unmount();

    const [withoutUndo] = createSignal<ToastState | null>({ message: "Theme: Dark" });
    const { queryByText } = renderToast(withoutUndo);
    expect(queryByText("undo")).toBeNull();
  });

  it("undo fires the callback then dismisses", () => {
    const undo = vi.fn();
    const dismiss = vi.fn();
    const [state] = createSignal<ToastState | null>({ message: "x", onUndo: undo });
    const { getByText } = renderToast(state, dismiss);
    fireEvent.click(getByText("undo"));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses after the configured duration", () => {
    const dismiss = vi.fn();
    const [state] = createSignal<ToastState | null>({ message: "x" });
    renderToast(state, dismiss);
    expect(dismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3999);
    expect(dismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("hover pauses the auto-dismiss timer", () => {
    /* Without pause, a screen-reader user listening to the polite
     * announcement could miss it; this test pins the contract that
     * hovering — or focusing — the toast holds it open. */
    const dismiss = vi.fn();
    const [state] = createSignal<ToastState | null>({ message: "x" });
    const { container } = renderToast(state, dismiss);
    const region = container.querySelector('[role="status"]')!;
    vi.advanceTimersByTime(2000);
    fireEvent.mouseEnter(region);
    vi.advanceTimersByTime(5000); /* would have dismissed if not paused */
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(region);
    vi.advanceTimersByTime(2001); /* remaining ~2000ms + buffer */
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("dismiss button calls onDismiss", () => {
    const dismiss = vi.fn();
    const [state] = createSignal<ToastState | null>({ message: "x" });
    const { getByLabelText } = renderToast(state, dismiss);
    fireEvent.click(getByLabelText("Dismiss"));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe("useToast", () => {
  it("starts with null state", () => {
    const t = useToast();
    expect(t.state()).toBeNull();
  });

  it("emit replaces state; dismiss returns to null", () => {
    const t = useToast();
    t.emit({ message: "first" });
    expect(t.state()?.message).toBe("first");
    t.emit({ message: "second" });
    expect(t.state()?.message).toBe("second");
    t.dismiss();
    expect(t.state()).toBeNull();
  });
});
