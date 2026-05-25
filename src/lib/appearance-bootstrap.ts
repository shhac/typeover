import {
  DENSITIES,
  DENSITY_DEFAULT,
  DENSITY_STORAGE_KEY,
  RADII,
  RADIUS_DEFAULT,
  RADIUS_STORAGE_KEY,
  STYLES,
  STYLE_DEFAULT,
  STYLE_STORAGE_KEY,
} from "./appearance";
import { PALETTES, PALETTE_STORAGE_KEY, STYLE_DEFAULT_PALETTE } from "./palette";
import { STORAGE_KEY, THEMES } from "./theme";

const appearanceBootstrapConfig = {
  theme: {
    storageKey: STORAGE_KEY,
    values: THEMES,
  },
  density: {
    storageKey: DENSITY_STORAGE_KEY,
    values: DENSITIES,
    default: DENSITY_DEFAULT,
  },
  radius: {
    storageKey: RADIUS_STORAGE_KEY,
    values: RADII,
    default: RADIUS_DEFAULT,
  },
  style: {
    storageKey: STYLE_STORAGE_KEY,
    values: STYLES,
    default: STYLE_DEFAULT,
  },
  palette: {
    storageKey: PALETTE_STORAGE_KEY,
    values: PALETTES,
    defaultByStyle: STYLE_DEFAULT_PALETTE,
  },
} as const;

export const APPEARANCE_BOOTSTRAP_SCRIPT = `(() => {
  try {
    var config = ${JSON.stringify(appearanceBootstrapConfig)};
    function pick(pinned, values, fallback) {
      return values.indexOf(pinned) >= 0 ? pinned : fallback;
    }

    var theme = pick(
      localStorage.getItem(config.theme.storageKey),
      config.theme.values,
      window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
    );
    document.documentElement.dataset.theme = theme;

    document.documentElement.dataset.density = pick(
      localStorage.getItem(config.density.storageKey),
      config.density.values,
      config.density.default
    );

    document.documentElement.dataset.radius = pick(
      localStorage.getItem(config.radius.storageKey),
      config.radius.values,
      config.radius.default
    );

    var style = pick(
      localStorage.getItem(config.style.storageKey),
      config.style.values,
      config.style.default
    );
    document.documentElement.dataset.style = style;

    var pinnedPalette = localStorage.getItem(config.palette.storageKey);
    document.documentElement.dataset.palette =
      pinnedPalette &&
      pinnedPalette !== "default" &&
      config.palette.values.indexOf(pinnedPalette) >= 0
        ? pinnedPalette
        : config.palette.defaultByStyle[style];
  } catch (_) {
    /* localStorage unavailable (incognito quota / SSR / etc.) —
     * fall through to the CSS @theme defaults. */
  }
})();`;
