import type { PaletteId } from "~/lib/theme";

/*
 * PaletteChip — a small decorative swatch showing a palette's
 * identity by its background + accent colours. Used by the
 * AppearancePicker so the 22 palettes don't hide behind text-only
 * radio labels (design-docs/24 P2).
 *
 * Implementation note: the chip uses inline-style colour values from
 * the table below rather than the CSS cascade because the existing
 * `:root[data-palette="..."]` rules in src/styles/global.css are
 * root-scoped only. Setting `data-palette` on a nested element does
 * NOT activate those tokens at the nested scope. Expanding the
 * cascade to nested scopes would touch 46 selectors — deferred to
 * a later cycle.
 *
 * The price of inline styles: this table duplicates a small slice
 * (2 colours per palette per theme) of what global.css defines.
 * PaletteChip.test.tsx parses global.css and asserts every value
 * here agrees, so drift is caught loudly.
 *
 * The chip is always `aria-hidden`: a sighted user gains visual
 * affordance for picking between similarly-named palettes; the
 * radio label remains the screen-reader name.
 */

interface PaletteChipProps {
  /** Which palette to render. Not `PaletteChoice` — the magic
   *  `"default"` value resolves at the call site to a real
   *  `PaletteId` before reaching the chip. */
  palette: PaletteId;
  /** Which theme variant of the palette to show. Defaults to the
   *  current document theme (read from `documentElement.dataset.theme`).
   *  Pass explicitly to preview the OTHER theme without leaking the
   *  whole page into it. */
  theme?: "dark" | "light";
  /** Optional CSS class for outer-chip sizing / layout overrides.
   *  Defaults to a 36×24px chip. */
  class?: string;
}

/* The 2-colour-per-palette-per-theme table. Manually mirrors
 * src/styles/global.css. PaletteChip.test.tsx parses the CSS and
 * asserts agreement on every (palette, theme) → {bg, accent}. */
type ChipColors = { bg: string; accent: string };
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
  vellum: {
    dark: { bg: "#1c1610", accent: "#cf8a47" },
    light: { bg: "#f3ead7", accent: "#8a4a14" },
  },
  pelican: {
    dark: { bg: "#101010", accent: "#e87b3e" },
    light: { bg: "#f5ecd2", accent: "#b8421b" },
  },
  sepia: {
    dark: { bg: "#1d140c", accent: "#c87a35" },
    light: { bg: "#efe2cc", accent: "#7a3d0e" },
  },
  almanac: {
    dark: { bg: "#0f1414", accent: "#4ea69a" },
    light: { bg: "#f4f1e8", accent: "#0d5e55" },
  },
  "e-reader": {
    dark: { bg: "#18171a", accent: "#d4a843" },
    light: { bg: "#e0dcd0", accent: "#8a4a14" },
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

/** Read the current document theme from the data-theme attribute.
 *  Falls back to "dark" when the attribute is absent or invalid
 *  (matches global.css's `:root` defaults). Pure DOM read; safe to
 *  call during render. */
function readDocumentTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}

export function PaletteChip(props: PaletteChipProps) {
  const theme = () => props.theme ?? readDocumentTheme();
  const colors = () => PALETTE_CHIP_COLORS[props.palette][theme()];
  return (
    <span
      class={"inline-flex items-center justify-center rounded-sm border " + (props.class ?? "w-9 h-6")}
      style={{
        "background-color": colors().bg,
        "border-color": colors().accent + "60",
      }}
      aria-hidden="true"
      data-testid="palette-chip"
      data-palette={props.palette}
      data-palette-theme={theme()}
    >
      <span
        class="inline-block w-2 h-2 rounded-full"
        style={{ "background-color": colors().accent }}
      />
    </span>
  );
}
