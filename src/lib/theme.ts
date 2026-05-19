/*
 * Theme helpers. See design-docs/13-themes.md.
 *
 * Theme state is two-tiered:
 *   1. The OS preference (prefers-color-scheme: dark | light).
 *   2. The learner's pin in localStorage["typeover:theme"], when set.
 *
 * `currentTheme()` returns the *effective* theme — the pin if present,
 * otherwise whatever the OS asks for, defaulting to "dark" if the OS
 * leaves it ambiguous (or under SSR / older browsers).
 *
 * The DOM is the source of truth at runtime — the bootstrap script in
 * BaseLayout sets `<html data-theme="…">` before paint. These helpers
 * mutate that attribute *and* persist the choice; they keep the DOM
 * and storage in sync rather than re-reading on demand.
 */

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
