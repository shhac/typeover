import { defineAppearanceAxis } from "./appearance-axis";

/*
 * The "shape" appearance axes — density, radius (corners), style —
 * paired in a sibling module to `theme.ts` (colour) and `palette.ts`
 * (palette). Each axis uses the shared `defineAppearanceAxis`
 * factory.
 *
 * These three axes are simpler than the colour axis: no "system"
 * fallback path, no OS-preference cascade. The DOM attribute is
 * authoritative, with the configured `default` filling SSR.
 */

/* ============================== Density ============================= */

export const DENSITIES = ["compact", "normal", "airy"] as const;
export type DensityId = (typeof DENSITIES)[number];

export const DENSITY_STORAGE_KEY = "typeover:density";
export const DENSITY_DEFAULT: DensityId = "normal";

const densityAxis = defineAppearanceAxis<DensityId>({
  values: DENSITIES,
  storageKey: DENSITY_STORAGE_KEY,
  datasetKey: "density",
  default: DENSITY_DEFAULT,
});

export const currentDensity = densityAxis.current;
export const setDensity = densityAxis.set;

/** Human-facing labels + one-line descriptions for each density.
 *  Lives next to the values so adding/renaming an axis value is a
 *  single-file edit. Mirrors the `PALETTE_LABELS` pattern in
 *  `./palette.ts`. The picker iterates `DENSITIES` for render order
 *  and looks up labels here. */
export const DENSITY_LABELS: Record<DensityId, { label: string; description: string }> = {
  compact: {
    label: "Compact",
    description: "Tighter spacing. Bloomberg-terminal nostalgia.",
  },
  normal: {
    label: "Normal",
    description: "The default. Airy Linear-style breathing room.",
  },
  airy: {
    label: "Airy",
    description: "More whitespace. Reads like an essay.",
  },
};

/* =============================== Shape ============================== */

export const RADII = ["sharp", "normal", "rounded", "pill"] as const;
export type RadiusId = (typeof RADII)[number];

export const RADIUS_STORAGE_KEY = "typeover:radius";
export const RADIUS_DEFAULT: RadiusId = "normal";

const radiusAxis = defineAppearanceAxis<RadiusId>({
  values: RADII,
  storageKey: RADIUS_STORAGE_KEY,
  datasetKey: "radius",
  default: RADIUS_DEFAULT,
});

export const currentRadius = radiusAxis.current;
export const setRadius = radiusAxis.set;

/** Human-facing labels for each shape (corner radius) value. See
 *  the comment on `DENSITY_LABELS` for the convention. */
export const RADIUS_LABELS: Record<RadiusId, { label: string; description: string }> = {
  sharp: {
    label: "Sharp",
    description: "Near-square corners. Terminal feel.",
  },
  normal: {
    label: "Normal",
    description: "Subtle 2–4px corners. Default.",
  },
  rounded: {
    label: "Rounded",
    description: "Friendlier 4–12px corners.",
  },
  pill: {
    label: "Pill",
    description: "Generously curved — 8–24px. Small elements pill out.",
  },
};

/* =============================== Style ============================== */

export const STYLES = ["terminal", "cardboard", "textbook", "glass", "islands"] as const;
export type StyleId = (typeof STYLES)[number];

export const STYLE_STORAGE_KEY = "typeover:style";
export const STYLE_DEFAULT: StyleId = "terminal";

const styleAxis = defineAppearanceAxis<StyleId>({
  values: STYLES,
  storageKey: STYLE_STORAGE_KEY,
  datasetKey: "style",
  default: STYLE_DEFAULT,
});

export const currentStyle = styleAxis.current;
export const setStyle = styleAxis.set;

/** Human-facing labels for each style. See the comment on
 *  `DENSITY_LABELS` for the convention. */
export const STYLE_LABELS: Record<StyleId, { label: string; description: string }> = {
  terminal: {
    label: "Terminal",
    description: "Bloomberg-meets-airy-Linear. Flat, hairline-only, mono. Default.",
  },
  cardboard: {
    label: "Cardboard",
    description: "Warm paper grain on panels. Reads like a notebook.",
  },
  textbook: {
    label: "Textbook",
    description: "Serif headings + amber left-rule. Annotated-page feel.",
  },
  glass: {
    label: "Glass",
    description: "Translucent panels with subtle backdrop blur where supported.",
  },
  islands: {
    label: "Islands",
    description: "Distinct floating cards with stronger drop shadows.",
  },
};
