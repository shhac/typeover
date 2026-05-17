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
