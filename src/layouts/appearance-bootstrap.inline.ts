/*
 * Pre-paint appearance bootstrap. Runs synchronously in <head> as
 * `<script is:inline>` to set the four `data-*` attributes on
 * <html> from the learner's pinned axes (localStorage) or per-axis
 * defaults BEFORE any CSS paints. Prevents flash-of-wrong-theme on
 * first frame.
 *
 * Inlined because it has to fire before any bundler/JS-module
 * pipeline starts; the trade-off is that the four axis-allow-lists
 * + the style→default-palette map have to be duplicated from
 * `src/lib/{theme,appearance,palette}.ts`. A vitest drift guard
 * (`BaseLayout.bootstrap.test.ts`) asserts every enum value from
 * those source-of-truth modules appears as a string literal in
 * this body.
 *
 * The script body itself is exported as a string — the layout
 * writes it verbatim via `<script is:inline set:html=...>`. See
 * `src/lib/runtime-prefetch-script.ts` for the sibling prefetch
 * body. design-docs/13, design-docs/22, design-docs/31.
 */
export const appearanceBootstrapScript: string = `(function () {
  try {
    /* Tiny helper used four times below — read the storage key,
     * accept the value only if it's in the allow-list, else
     * return the fallback. The allow-lists must stay in sync
     * with the enums in src/lib/{theme,appearance}.ts; the
     * bootstrap drift guard pins that. */
    function pick(key, allowed, fallback) {
      var v = localStorage.getItem(key);
      return v !== null && allowed.indexOf(v) >= 0 ? v : fallback;
    }

    var theme = pick("typeover:theme", ["dark", "light"],
      window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = theme;

    document.documentElement.dataset.density = pick(
      "typeover:density",
      ["compact", "normal", "airy"],
      "normal",
    );

    document.documentElement.dataset.radius = pick(
      "typeover:radius",
      ["sharp", "normal", "rounded", "pill"],
      "normal",
    );

    var style = pick(
      "typeover:style",
      ["terminal", "cardboard", "textbook", "glass", "islands"],
      "terminal",
    );
    document.documentElement.dataset.style = style;

    /* Palette resolution per design-docs/22 — \`default\` (or absent)
     * follows the active style's default; a specific palette ID
     * persists across style switches. The two lists below must
     * stay in sync with PALETTES + STYLE_DEFAULT_PALETTE in
     * src/lib/theme.ts — bootstrap.test asserts every literal
     * appears. */
    var styleDefaultPalette = {
      terminal: "phosphor-amber",
      cardboard: "warm-paper",
      textbook: "parchment-ink",
      glass: "aurora-amber",
      islands: "desk-felt",
    };
    var palettes = [
      "phosphor-amber", "phosphor-green", "ice-blue", "tape-reel",
      "warm-paper", "kraft", "manila", "newsprint", "calfskin",
      "parchment-ink", "pelican", "almanac", "e-reader", "slate-rule",
      "aurora-amber", "glacier-blue", "lavender-mist", "monochrome",
      "desk-felt", "app-store", "dark-wood", "studio-grey", "sunlit-pine",
    ];
    var pinnedPalette = localStorage.getItem("typeover:palette");
    document.documentElement.dataset.palette =
      pinnedPalette && pinnedPalette !== "default" && palettes.indexOf(pinnedPalette) >= 0
        ? pinnedPalette
        : styleDefaultPalette[style];
  } catch (_) {
    /* localStorage unavailable (incognito quota / SSR / etc.) —
     * fall through to the CSS @theme defaults. */
  }
})();`;
