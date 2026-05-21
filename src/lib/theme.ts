import { defineAppearanceAxis } from "./appearance-axis";

/*
 * Colour-axis specifics. The OTHER appearance axes (density, shape,
 * style, palette) live in `./appearance.ts` and `./palette.ts` —
 * they're re-exported below so every existing `~/lib/theme`
 * import keeps working untouched. design-docs/13 + 14 + 22.
 *
 * The colour axis is the only one with an OS-preference path: a
 * `system` choice clears the pin and re-derives from
 * `prefers-color-scheme`. The other axes have no equivalent OS
 * signal and use the simpler shared factory directly.
 *
 * NAMING NOTE — design-docs/18 F-1. The shape axis (`appearance.ts`)
 * carries multiple surface names: "shape" (the picker label)
 * vs `RADII` / `RadiusId` / `data-radius` in code/storage. Both
 * names point at the same axis; the storage-key + CSS-selector
 * naming is kept because renaming would break pinned users'
 * preferences.
 */

/* ======================= Re-exports (sibling modules) =================
 * Kept to avoid touching every `from "~/lib/theme"` import site
 * after the file split. New code should import from the source
 * module (./appearance, ./palette) directly. */

export {
  /* shape (radius) */
  RADII,
  RADIUS_STORAGE_KEY,
  currentRadius,
  setRadius,
  /* density */
  DENSITIES,
  DENSITY_STORAGE_KEY,
  currentDensity,
  setDensity,
  /* style */
  STYLES,
  STYLE_STORAGE_KEY,
  currentStyle,
  setStyle,
  type DensityId,
  type RadiusId,
  type StyleId,
} from "./appearance";

export {
  PALETTES,
  PALETTE_HOME_STYLE,
  PALETTE_LABELS,
  PALETTE_STORAGE_KEY,
  STYLE_DEFAULT_PALETTE,
  currentPalette,
  currentPaletteChoice,
  reapplyDefaultPaletteForCurrentStyle,
  setPalette,
  type PaletteChoice,
  type PaletteId,
} from "./palette";

/* ============================== Colour ============================== */

export const THEMES = ["dark", "light"] as const;
export type ThemeId = (typeof THEMES)[number];

export const STORAGE_KEY = "typeover:theme";

const themeAxis = defineAppearanceAxis<ThemeId>({
  values: THEMES,
  storageKey: STORAGE_KEY,
  datasetKey: "theme",
  /* The factory `default` is the SSR-fallback when no DOM attribute
   * is present; the live `currentTheme` overrides this with OS
   * preference below. */
  default: "dark",
});

/** "system" means "no pin — follow OS preference."
 *  setTheme("system") is the explicit reset. */
export type ThemeChoice = ThemeId | "system";

function osPreference(): ThemeId {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** The current effective theme. Reads the DOM attribute first (the
 *  bootstrap already resolved it), falls back to OS pref on SSR. */
export function currentTheme(): ThemeId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.theme;
    if (themeAxis.isValue(attr)) return attr;
  }
  return osPreference();
}

/** The current pin, or "system" if none. Lets the settings UI render
 *  the radio group with "System" as a distinct option from the two
 *  explicit themes. */
export function currentChoice(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const raw = localStorage.getItem(STORAGE_KEY);
  return themeAxis.isValue(raw) ? raw : "system";
}

/** Apply a choice. "system" clears the pin and re-derives from the
 *  OS. The DOM is updated immediately so the new theme paints on the
 *  next frame without a reload. */
export function setTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  if (choice === "system") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    document.documentElement.dataset.theme = osPreference();
    return;
  }
  themeAxis.set(choice);
}
