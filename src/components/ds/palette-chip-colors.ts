import type { PaletteId } from "~/lib/theme";

/*
 * 2-colour-per-palette-per-theme table consumed by the
 * `PaletteChip` component for inline-style swatch rendering.
 *
 * Why inline instead of a CSS lookup: the existing
 * `:root[data-palette="..."]` rules in src/styles/global.css are
 * root-scoped only. Setting `data-palette` on a nested element does
 * NOT activate those tokens at the nested scope. Expanding the
 * cascade to nested scopes would touch 46 selectors — deferred to
 * a later cycle.
 *
 * The price of duplication: this table mirrors a small slice of
 * what global.css defines. PaletteChip.test.tsx parses the CSS and
 * asserts every value here agrees, so drift is caught loudly. The
 * data lives in its own file (this one) rather than the component
 * because palette additions touch 3-4 files already
 * (palette.ts + theme.ts + global.css + here); keeping this slice
 * separable makes the "add a palette" diff scan cleaner.
 */

export type ChipColors = { bg: string; accent: string };

export const PALETTE_CHIP_COLORS: Record<PaletteId, { dark: ChipColors; light: ChipColors }> = {
  "phosphor-amber": {
    dark: { bg: "#0a0a0b", accent: "#ffa726" },
    light: { bg: "#fafaf8", accent: "#a85d00" },
  },
  "phosphor-green": {
    dark: { bg: "#050a06", accent: "#5cff7a" },
    light: { bg: "#f4f6ee", accent: "#1f6b2a" },
  },
  "ice-blue": {
    dark: { bg: "#0a0e14", accent: "#5ab8ff" },
    light: { bg: "#f4f7fa", accent: "#155a9c" },
  },
  "tape-reel": {
    dark: { bg: "#0c0707", accent: "#ff5b4a" },
    light: { bg: "#f4ead8", accent: "#9c2418" },
  },
  "warm-paper": {
    dark: { bg: "#0a0a0b", accent: "#ffa726" },
    light: { bg: "#ffffff", accent: "#a06400" },
  },
  kraft: {
    dark: { bg: "#1a1410", accent: "#f4a437" },
    light: { bg: "#d8c7a3", accent: "#7a3f00" },
  },
  manila: {
    dark: { bg: "#15130c", accent: "#5fa8ff" },
    light: { bg: "#ecd9a8", accent: "#0f3d8c" },
  },
  newsprint: {
    dark: { bg: "#161616", accent: "#e85a3c" },
    light: { bg: "#e8e3d6", accent: "#9a2410" },
  },
  calfskin: {
    dark: { bg: "#191510", accent: "#d68a3a" },
    light: { bg: "#f4ecd8", accent: "#7a4a08" },
  },
  "parchment-ink": {
    dark: { bg: "#1a1612", accent: "#d89640" },
    light: { bg: "#faf6ef", accent: "#b06e1a" },
  },
  pelican: {
    dark: { bg: "#101010", accent: "#e87b3e" },
    light: { bg: "#f5ecd2", accent: "#b8421b" },
  },
  almanac: {
    dark: { bg: "#0f1414", accent: "#4ea69a" },
    light: { bg: "#f4f1e8", accent: "#0d5e55" },
  },
  "e-reader": {
    dark: { bg: "#18171a", accent: "#d4a843" },
    light: { bg: "#e0dcd0", accent: "#8a4a14" },
  },
  "slate-rule": {
    dark: { bg: "#14171a", accent: "#6ea8d0" },
    light: { bg: "#f4f6f8", accent: "#2a5a85" },
  },
  "aurora-amber": {
    dark: { bg: "#0a0a0b", accent: "#ffa726" },
    light: { bg: "#fafafa", accent: "#b06e1a" },
  },
  "glacier-blue": {
    dark: { bg: "#07101a", accent: "#7dd3fc" },
    light: { bg: "#f0f7fc", accent: "#0369a1" },
  },
  "lavender-mist": {
    dark: { bg: "#100a18", accent: "#c4b5fd" },
    light: { bg: "#faf7ff", accent: "#7c3aed" },
  },
  monochrome: {
    dark: { bg: "#0c0c0e", accent: "#ffffff" },
    light: { bg: "#f5f5f7", accent: "#000000" },
  },
  "desk-felt": {
    dark: { bg: "#050507", accent: "#ffa726" },
    light: { bg: "#e8e8ea", accent: "#b06e1a" },
  },
  "app-store": {
    dark: { bg: "#000003", accent: "#0a84ff" },
    light: { bg: "#f2f2f5", accent: "#0066cc" },
  },
  "dark-wood": {
    dark: { bg: "#1a0f08", accent: "#e8a23b" },
    light: { bg: "#c9a880", accent: "#8a4d0a" },
  },
  "studio-grey": {
    dark: { bg: "#0c0d10", accent: "#7c8cff" },
    light: { bg: "#dcdee3", accent: "#4f46e5" },
  },
  "sunlit-pine": {
    dark: { bg: "#14100a", accent: "#f0a838" },
    light: { bg: "#efe3cc", accent: "#9e5a0a" },
  },
};
