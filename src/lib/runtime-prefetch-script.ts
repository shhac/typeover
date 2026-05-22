/*
 * Inline pre-bundle script body that prefetches the runtime WASM on
 * first hover / focus / touch over an in-curriculum link from
 * off-route pages. Picks the right runtime by sniffing the anchor's
 * href prefix.
 *
 * Inlined into `BaseLayout.astro` via `<script is:inline set:html=...>`
 * — the script has to run before any JS bundle loads, so it ships as
 * a string the layout writes verbatim. Lives in this module so the
 * layout's front-matter stays focused on page-meta wiring + the
 * actual prefetch behaviour is regex-testable in vitest (see
 * `BaseLayout.bootstrap.test.ts`).
 *
 * design-docs/25 P5. design-docs/31 D6 (Zig prefetch wiring).
 */
export const runtimePrefetchScript: string = `(function () {
  var fired = false;
  function ok() {
    var c = navigator.connection;
    if (c && c.saveData) return false;
    if (c && c.effectiveType === "slow-2g") return false;
    return true;
  }
  function prefetch(href) {
    if (fired) return;
    if (!ok()) return;
    fired = true;
    var link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "fetch";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
  function handler(e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    if (t.closest('a[href^="/go/"]')) prefetch("/yaegi/yaegi.wasm");
    else if (t.closest('a[href^="/zig/"]')) prefetch("/zig/zig.wasm");
  }
  document.addEventListener("pointerover", handler, { passive: true });
  document.addEventListener("focusin", handler, { passive: true });
  document.addEventListener("touchstart", handler, { passive: true });
})();`;
