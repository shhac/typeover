/**
 * Web Share / Clipboard fallback cascade.
 *
 * Pure decision logic — no DOM rendering, no Solid signals. Lives
 * in `lib/` rather than alongside its only current caller
 * (ModuleCompleteCard) so future share affordances (footer "Share
 * typeover", track-complete cards) can import it without crossing a
 * component boundary.
 *
 * Returns the next ShareOutcome the caller should surface:
 *   - "shared"  — Web Share success
 *   - "copied"  — clipboard fallback success
 *   - "idle"    — user cancelled the share sheet (AbortError per the
 *                 Web Share spec; benign, reset to idle)
 *   - "error"   — Navigator is undefined, both APIs missing, OR a
 *                 non-cancellation throw
 *
 * design-docs/16 F-7 + design-docs/19 F-5.
 */

export type ShareOutcome = "shared" | "copied" | "error" | "idle";

export async function tryShare(text: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator === "undefined") return "error";
  /* lib.dom declares `share` and `clipboard` as required on
   * Navigator, so an `"x" in nav` guard narrows the false branch
   * to `never`. Treat the live object as Partial<Navigator> — on
   * non-supporting browsers either property may genuinely be
   * undefined at runtime. */
  const nav: Partial<Navigator> = navigator;
  try {
    if (nav.share) {
      await nav.share({ title: "typeover", text, url });
      return "shared";
    }
    if (nav.clipboard) {
      await nav.clipboard.writeText(`${text}\n${url}`);
      return "copied";
    }
    return "error";
  } catch (e) {
    /* User cancelled the share sheet vs permission denied vs
     * crashed share-sheet are three different cases. AbortError
     * is the cancellation signal per the Web Share spec —
     * benign, reset to idle. Anything else is a real failure;
     * fall back to the manual-copy panel. design-docs/19 F-5. */
    const isCancellation = e instanceof DOMException && e.name === "AbortError";
    return isCancellation ? "idle" : "error";
  }
}
