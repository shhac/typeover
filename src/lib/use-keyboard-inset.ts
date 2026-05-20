import { createSignal, onCleanup, onMount } from "solid-js";

/**
 * Reactive bottom-gap between the layout viewport and the visual
 * viewport — i.e. the height of the iOS soft-keyboard slice that
 * occludes content fixed to `bottom: 0`. Returns 0 when there's
 * no visual-viewport API (SSR, jsdom, older Safari) or when no
 * keyboard is up.
 *
 * Originally lived inline in `src/components/ds/MobileKeyBar.tsx`
 * — extracted here so the mobile keybar AND the run-result focus
 * scroll (design-docs/26 P11) can share one subscription without
 * a circular import between `~/components/ds` and `~/lib`.
 *
 * Subscribes to `visualViewport.resize` and `visualViewport.scroll`;
 * cleans up on owner disposal.
 */
export function useKeyboardInset(): () => number {
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
