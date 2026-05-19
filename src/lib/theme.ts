/*
 * Appearance helpers — three independent axes per design-docs/13 + 14.
 *
 *   1. Colour theme — `dark` | `light` (pin)  or `system` (follow OS).
 *   2. Density      — `compact` | `normal` | `airy`.
 *   3. Shape        — `sharp` | `normal` | `rounded`.
 *
 * Each axis follows the same pattern:
 *   - The DOM is the source of truth at runtime — the bootstrap script
 *     in BaseLayout sets `data-*` attributes before paint.
 *   - localStorage carries the pin; absent = the per-axis default.
 *   - The setter mutates BOTH the attribute (instant repaint) and the
 *     pin (persistence) in one call.
 *
 * Density and shape have no OS-level preference signal, so absent
 * pin → the explicit default below ("normal" for both). The colour
 * axis retains its `system` choice that re-derives from
 * prefers-color-scheme.
 */

/* ============================== Colour ============================== */

export const THEMES = ["dark", "light"] as const;
export type ThemeId = (typeof THEMES)[number];

export const STORAGE_KEY = "typeover:theme";

const isTheme = (s: string | null): s is ThemeId =>
  s !== null && (THEMES as readonly string[]).includes(s);

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
    if (isTheme(attr ?? null)) return attr as ThemeId;
  }
  return osPreference();
}

/** The current pin, or "system" if none. Lets the settings UI render
 *  the radio group with "System" as a distinct option from the two
 *  explicit themes. */
export function currentChoice(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const raw = localStorage.getItem(STORAGE_KEY);
  return isTheme(raw) ? raw : "system";
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
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, choice);
  document.documentElement.dataset.theme = choice;
}

/* ============================== Density ============================= */

export const DENSITIES = ["compact", "normal", "airy"] as const;
export type DensityId = (typeof DENSITIES)[number];

export const DENSITY_STORAGE_KEY = "typeover:density";
const DENSITY_DEFAULT: DensityId = "normal";

const isDensity = (s: string | null): s is DensityId =>
  s !== null && (DENSITIES as readonly string[]).includes(s);

/** The current density. DOM attribute is authoritative; missing /
 *  unknown values fall back to `normal`. */
export function currentDensity(): DensityId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.density;
    if (isDensity(attr ?? null)) return attr as DensityId;
  }
  return DENSITY_DEFAULT;
}

/** Set the density. There is no `system` option — no platform signal
 *  for "I prefer airy", so absence-of-pin means the default. To "reset"
 *  to default, call `setDensity("normal")`. */
export function setDensity(next: DensityId): void {
  if (typeof document === "undefined") return;
  if (typeof localStorage !== "undefined") localStorage.setItem(DENSITY_STORAGE_KEY, next);
  document.documentElement.dataset.density = next;
}

/* =============================== Shape ============================== */

export const RADII = ["sharp", "normal", "rounded"] as const;
export type RadiusId = (typeof RADII)[number];

export const RADIUS_STORAGE_KEY = "typeover:radius";
const RADIUS_DEFAULT: RadiusId = "normal";

const isRadius = (s: string | null): s is RadiusId =>
  s !== null && (RADII as readonly string[]).includes(s);

/** The current radius preset. DOM attribute is authoritative; missing /
 *  unknown values fall back to `normal`. */
export function currentRadius(): RadiusId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.radius;
    if (isRadius(attr ?? null)) return attr as RadiusId;
  }
  return RADIUS_DEFAULT;
}

export function setRadius(next: RadiusId): void {
  if (typeof document === "undefined") return;
  if (typeof localStorage !== "undefined") localStorage.setItem(RADIUS_STORAGE_KEY, next);
  document.documentElement.dataset.radius = next;
}
