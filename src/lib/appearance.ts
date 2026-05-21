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

const densityAxis = defineAppearanceAxis<DensityId>({
  values: DENSITIES,
  storageKey: DENSITY_STORAGE_KEY,
  datasetKey: "density",
  default: "normal",
});

export const currentDensity = densityAxis.current;
export const setDensity = densityAxis.set;

/* =============================== Shape ============================== */

export const RADII = ["sharp", "normal", "rounded", "pill"] as const;
export type RadiusId = (typeof RADII)[number];

export const RADIUS_STORAGE_KEY = "typeover:radius";

const radiusAxis = defineAppearanceAxis<RadiusId>({
  values: RADII,
  storageKey: RADIUS_STORAGE_KEY,
  datasetKey: "radius",
  default: "normal",
});

export const currentRadius = radiusAxis.current;
export const setRadius = radiusAxis.set;

/* =============================== Style ============================== */

export const STYLES = ["terminal", "cardboard", "textbook", "glass", "islands"] as const;
export type StyleId = (typeof STYLES)[number];

export const STYLE_STORAGE_KEY = "typeover:style";

const styleAxis = defineAppearanceAxis<StyleId>({
  values: STYLES,
  storageKey: STYLE_STORAGE_KEY,
  datasetKey: "style",
  default: "terminal",
});

export const currentStyle = styleAxis.current;
export const setStyle = styleAxis.set;
