import { defineAppearanceAxis } from "./appearance-axis";
import { currentStyle, type StyleId } from "./appearance";

/*
 * The palette appearance axis. 22 named palettes grouped by home
 * style, each with a dark + light variant in `global.css`. Lives
 * in its own module (rather than alongside the other appearance
 * axes in `appearance.ts`) because palette has bespoke "default"
 * semantics: a non-pin reads as the active style's default, and
 * flipping Style with no pin shifts the palette implicitly.
 *
 * design-docs/22 documents the palette catalogue + UX rationale.
 */

/* design-docs/22 — 22 named palettes grouped by home style. Each
 * has a dark + light variant defined in global.css. The `default`
 * magic value isn't a palette ID; it means "follow the active
 * style's default palette" (so flipping Style with no palette pin
 * changes palette too). A non-default palette ID persists across
 * style switches (custom pin behaviour). */
export const PALETTES = [
  /* terminal */
  "phosphor-amber",
  "phosphor-green",
  "ice-blue",
  "tape-reel",
  /* cardboard */
  "warm-paper",
  "kraft",
  "manila",
  "newsprint",
  "calfskin",
  /* textbook */
  "parchment-ink",
  "pelican",
  "almanac",
  "e-reader",
  "slate-rule",
  /* glass */
  "aurora-amber",
  "glacier-blue",
  "lavender-mist",
  "monochrome",
  /* islands */
  "desk-felt",
  "app-store",
  "dark-wood",
  "studio-grey",
  "sunlit-pine",
] as const;
export type PaletteId = (typeof PALETTES)[number];

/** "default" means "follow the active style's default palette" —
 *  the user has not customised. Any specific palette ID is a
 *  custom pin that persists across style switches. */
export type PaletteChoice = PaletteId | "default";

export const PALETTE_STORAGE_KEY = "typeover:palette";

/** Each style's default palette — used when `typeover:palette` is
 *  absent or set to the literal `"default"`. Mirrors the bootstrap
 *  script in BaseLayout; if you edit one, edit both (the
 *  bootstrap.test asserts every PaletteId literal appears in the
 *  bootstrap source). */
export const STYLE_DEFAULT_PALETTE: Record<StyleId, PaletteId> = {
  terminal: "phosphor-amber",
  cardboard: "warm-paper",
  textbook: "parchment-ink",
  glass: "aurora-amber",
  islands: "desk-felt",
};

/** Home style for each palette — drives the settings UI grouping.
 *  Cross-style application is allowed; this is the picker's default
 *  layout, not a hard restriction. */
export const PALETTE_HOME_STYLE: Record<PaletteId, StyleId> = {
  "phosphor-amber": "terminal",
  "phosphor-green": "terminal",
  "ice-blue": "terminal",
  "tape-reel": "terminal",
  "warm-paper": "cardboard",
  kraft: "cardboard",
  manila: "cardboard",
  newsprint: "cardboard",
  calfskin: "cardboard",
  "parchment-ink": "textbook",
  pelican: "textbook",
  almanac: "textbook",
  "e-reader": "textbook",
  "slate-rule": "textbook",
  "aurora-amber": "glass",
  "glacier-blue": "glass",
  "lavender-mist": "glass",
  monochrome: "glass",
  "desk-felt": "islands",
  "app-store": "islands",
  "dark-wood": "islands",
  "studio-grey": "islands",
  "sunlit-pine": "islands",
};

/** Friendly label + one-line description per palette, surfaced in
 *  the settings picker. Co-located with PALETTES + PALETTE_HOME_STYLE
 *  so adding a new palette is a one-table-per-axis edit, not a
 *  hunt across two files. `Record<PaletteId, ...>` makes the
 *  typechecker enforce coverage at the canonical-source site. */
export const PALETTE_LABELS: Record<PaletteId, { label: string; description: string }> = {
  "phosphor-amber": {
    label: "Phosphor Amber",
    description: "Bloomberg trading-floor amber on near-black.",
  },
  "phosphor-green": { label: "Phosphor Green", description: "IBM 3270 / VT220 CRT ghost." },
  "ice-blue": { label: "Ice Blue", description: "Arctic quant-desk slate." },
  "tape-reel": { label: "Tape Reel", description: "DEC oxblood on parchment." },
  "warm-paper": {
    label: "Warm Paper",
    description: "Off-white panels on light, warm-dark on dark.",
  },
  kraft: { label: "Kraft", description: "True brown shipping-carton paper." },
  manila: { label: "Manila", description: "Folder yellow with ink-blue accent." },
  newsprint: { label: "Newsprint", description: "Off-white pulp + headline red." },
  calfskin: { label: "Calfskin", description: "Pale calfskin with sepia ink." },
  "parchment-ink": {
    label: "Parchment & Ink",
    description: "Cream-on-light, aged-paper-on-dark — the warm textbook canon.",
  },
  pelican: { label: "Pelican", description: "Penguin paperback orange spine." },
  almanac: { label: "Almanac", description: "Off-white + deep teal headings." },
  "e-reader": {
    label: "E-Reader",
    description:
      "Modern e-ink — cool grey paper on light, warm night-mode + amber highlight on dark.",
  },
  "slate-rule": {
    label: "Slate Rule",
    description: "Modern academic — cool slate ground, steel-blue accent. Gwern-influenced.",
  },
  "aurora-amber": { label: "Aurora Amber", description: "Amber + TS-blue radial bloom." },
  "glacier-blue": { label: "Glacier Blue", description: "Cool cyan-to-ice bloom." },
  "lavender-mist": { label: "Lavender Mist", description: "Lilac + rose synthwave." },
  monochrome: { label: "Monochrome", description: "Clinical, accent-free glass." },
  "desk-felt": { label: "Desk Felt", description: "Felt grey desk under white islands." },
  "app-store": { label: "App Store", description: "Apple System — TS-blue CTA." },
  "dark-wood": { label: "Dark Wood", description: "Warm walnut under parchment tiles." },
  "studio-grey": { label: "Studio Grey", description: "Cool slate; Linear / Figma vibe." },
  "sunlit-pine": { label: "Sunlit Pine", description: "Warm cream + pale pine cabin." },
};

/* Palette uses the same axis factory as density/radius/style.
 * Colour-axis precedent: the `"system"` magic value gets bespoke
 * handling around a shared factory, here the `"default"` magic
 * value does the same. The factory owns the DOM attribute +
 * storage I/O + value validation; the wrappers handle resolution
 * from `"default"` to the active style's default palette. */
const paletteAxis = defineAppearanceAxis<PaletteId>({
  values: PALETTES,
  storageKey: PALETTE_STORAGE_KEY,
  datasetKey: "palette",
  /* SSR fallback. The live `currentPalette` overrides via the
   * style-default-resolver below; this default only matters when
   * the DOM attribute is absent (server-render). */
  default: STYLE_DEFAULT_PALETTE.terminal,
});

/** The current pin, or "default" if none. The settings UI renders
 *  "Default" as a distinct radio option. */
export function currentPaletteChoice(): PaletteChoice {
  if (typeof localStorage === "undefined") return "default";
  const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
  return paletteAxis.isValue(raw) ? raw : "default";
}

/** The current EFFECTIVE palette — what's actually painted. Reads
 *  the resolved DOM attribute the bootstrap set pre-paint; SSR
 *  fallback derives from the active style's default. */
export function currentPalette(): PaletteId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.palette;
    if (paletteAxis.isValue(attr)) return attr;
  }
  return STYLE_DEFAULT_PALETTE[currentStyle()];
}

/** Apply a choice. `"default"` clears the pin and re-resolves via
 *  the active style's default. A specific ID pins regardless of
 *  style. The DOM `data-palette` attribute updates immediately. */
export function setPalette(choice: PaletteChoice): void {
  if (typeof document === "undefined") return;
  if (choice === "default") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(PALETTE_STORAGE_KEY);
    document.documentElement.dataset.palette = STYLE_DEFAULT_PALETTE[currentStyle()];
    return;
  }
  paletteAxis.set(choice);
}

/** When the user changes Style and HAS NOT pinned a palette, the
 *  effective palette must shift to the new style's default. Settings
 *  UI calls this from inside the style setter wrapper. */
export function reapplyDefaultPaletteForCurrentStyle(): void {
  if (typeof document === "undefined") return;
  if (currentPaletteChoice() !== "default") return; /* custom pin — leave alone */
  document.documentElement.dataset.palette = STYLE_DEFAULT_PALETTE[currentStyle()];
}
