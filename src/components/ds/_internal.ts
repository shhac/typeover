/**
 * DS-internal helpers shared across design-system components. Not
 * exported from index.ts — these are implementation details, not
 * primitives.
 */

type ClassPart = string | false | null | undefined;

/**
 * Filter+join class fragments. Accepts strings, falsy values, and
 * undefined; returns a single space-separated class string.
 *
 *   cn("a", false, undefined, "b", local.class)
 *   // → "a b" (if local.class is undefined) or "a b foo" (if "foo")
 *
 * Lets us replace the per-component template-literal concat that was
 * scattered across 11 DS files, including the awkward
 * `${local.x ? cls[local.x] : ""}` empty-string fallthroughs.
 */
export function cn(...parts: ClassPart[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Focus-ring class used by primitives that act as programmatic
 * focus targets (Feedback panel, RunResultPanel region). The ring
 * paints in the accent-primary token so the visual style follows
 * the active palette automatically.
 *
 * Use this on any `tabindex="-1"` surface that consumers focus via
 * a ref — without the ring, sighted keyboard users lose the visual
 * landmark when focus moves there.
 */
export const FOCUS_RING_CLASS =
  "focus:outline-2 focus:outline-accent-primary focus:outline-offset-2";
