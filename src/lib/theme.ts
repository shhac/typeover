/*
 * Appearance helpers — FIVE independent axes per design-docs/13 + 14 + 22.
 *
 *   1. Colour theme — `dark` | `light` (pin)  or `system` (follow OS).
 *   2. Density      — `compact` | `normal` | `airy`.
 *   3. Shape        — `sharp` | `normal` | `rounded` | `pill`.
 *   4. Style        — `terminal` | `cardboard` | `textbook` | `glass` | `islands`.
 *   5. Palette      — `default` (follow active style's default palette)
 *                     or one of 22 named palette IDs (design-docs/22).
 *
 * NAMING NOTE — design-docs/18 F-1. The shape axis carries three
 * surface names: "shape" (design-docs/13 + this comment), "Shape"
 * (the settings UI label), and "radius" (every code symbol below:
 * `RADII`, `RadiusId`, `currentRadius`, `setRadius`,
 * `RADIUS_STORAGE_KEY`, the `typeover:radius` localStorage key,
 * the `data-radius` DOM attribute, and the
 * `:root[data-radius="…"]` CSS selectors). The code-side `radius`
 * naming is kept because (a) it matches the CSS `border-radius`
 * property the axis ultimately drives and (b) renaming the storage
 * key and DOM attribute would break every pinned user's preference.
 * If you grep for "shape", check `RADII` too; they're the same axis.
 *
 * Each axis follows the same pattern:
 *   - The DOM is the source of truth at runtime — the bootstrap script
 *     in BaseLayout sets `data-*` attributes before paint.
 *   - localStorage carries the pin; absent = the per-axis default.
 *   - The setter mutates BOTH the attribute (instant repaint) and the
 *     pin (persistence) in one call.
 *
 * Density, shape, and style have no OS-level preference signal, so
 * absent pin → the explicit default below ("normal" / "terminal").
 * The colour axis retains its `system` choice that re-derives from
 * prefers-color-scheme.
 *
 * design-docs/20 FW-1 — `defineAppearanceAxis()` factory collapses
 * the three OS-signal-free axes (density / radius / style) into a
 * single primitive. The colour axis stays bespoke for the `system`
 * fallback; it still uses the factory's typeguard so the four axes
 * share one validation shape.
 */

/* ============================== Factory ============================ */

interface AxisConfig<T extends string> {
  values: readonly T[];
  storageKey: string;
  /** The camelCase key under `document.documentElement.dataset`
   *  (the part after `data-` in the rendered HTML attribute). */
  datasetKey: string;
  default: T;
}

interface AppearanceAxis<T extends string> {
  /** Type guard reusable by callers that hold raw strings (e.g. the
   *  colour-axis `currentChoice()` which has to handle `"system"`
   *  separately). */
  isValue: (s: string | null | undefined) => s is T;
  /** The current effective value. DOM attribute is authoritative;
   *  missing / unknown values fall back to `default`. */
  current: () => T;
  /** Persist + apply. Writes the value to both the pin and the DOM
   *  attribute in one call. */
  set: (next: T) => void;
}

function defineAppearanceAxis<T extends string>(config: AxisConfig<T>): AppearanceAxis<T> {
  const valueSet: ReadonlySet<string> = new Set(config.values);
  const isValue = (s: string | null | undefined): s is T =>
    typeof s === "string" && valueSet.has(s);

  const current = (): T => {
    if (typeof document !== "undefined") {
      const attr = document.documentElement.dataset[config.datasetKey];
      if (isValue(attr)) return attr;
    }
    return config.default;
  };

  const set = (next: T): void => {
    if (typeof document === "undefined") return;
    if (typeof localStorage !== "undefined") localStorage.setItem(config.storageKey, next);
    document.documentElement.dataset[config.datasetKey] = next;
  };

  return { isValue, current, set };
}

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

/* =============================== Palette ============================ */

/* design-docs/22 — 22 named palettes grouped by home style. Each has
 * a dark + light variant defined in global.css. The `default` magic
 * value isn't a palette ID; it means "follow the active style's
 * default palette" (so flipping Style with no palette pin changes
 * palette too). A non-default palette ID persists across style
 * switches (custom pin behaviour). */
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
  "vellum",
  "pelican",
  "sepia",
  "almanac",
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

/** "default" means "follow the active style's default palette" — the
 *  user has not customised. Any specific palette ID is a custom pin
 *  that persists across style switches. */
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
  vellum: "textbook",
  pelican: "textbook",
  sepia: "textbook",
  almanac: "textbook",
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

const paletteValueSet: ReadonlySet<string> = new Set(PALETTES);
const isPalette = (s: string | null | undefined): s is PaletteId =>
  typeof s === "string" && paletteValueSet.has(s);

/** The current pin, or "default" if none. The settings UI renders
 *  "Default" as a distinct radio option. */
export function currentPaletteChoice(): PaletteChoice {
  if (typeof localStorage === "undefined") return "default";
  const raw = localStorage.getItem(PALETTE_STORAGE_KEY);
  return isPalette(raw) ? raw : "default";
}

/** The current EFFECTIVE palette — what's actually painted. Reads the
 *  resolved DOM attribute the bootstrap set pre-paint. */
export function currentPalette(): PaletteId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.palette;
    if (isPalette(attr)) return attr;
  }
  /* SSR fallback — resolve from style default. */
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
  if (typeof localStorage !== "undefined") localStorage.setItem(PALETTE_STORAGE_KEY, choice);
  document.documentElement.dataset.palette = choice;
}

/** When the user changes Style and HAS NOT pinned a palette, the
 *  effective palette must shift to the new style's default. Settings
 *  UI calls this from inside the style setter wrapper. */
export function reapplyDefaultPaletteForCurrentStyle(): void {
  if (typeof document === "undefined") return;
  if (currentPaletteChoice() !== "default") return; /* custom pin — leave alone */
  document.documentElement.dataset.palette = STYLE_DEFAULT_PALETTE[currentStyle()];
}
