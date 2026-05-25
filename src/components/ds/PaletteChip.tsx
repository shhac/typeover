import type { PaletteId } from "~/lib/theme";
import { PALETTE_CHIP_COLORS } from "./palette-chip-colors";

/* The 90-line colour table lives in `./palette-chip-colors.ts`.
 * Re-exported below for back-compat with consumers
 * (PaletteChip.test.tsx, src/components/ds/index.ts) that import
 * it from the component module. */
export { PALETTE_CHIP_COLORS } from "./palette-chip-colors";

/*
 * PaletteChip — a small decorative swatch showing a palette's
 * identity by its background + accent colours. Used by the
 * AppearancePicker so the 22 palettes don't hide behind text-only
 * radio labels (design-docs/24 P2).
 *
 * Implementation note: the chip uses inline-style colour values
 * from `PALETTE_CHIP_COLORS` rather than the CSS cascade because
 * the existing `:root[data-palette="..."]` rules in
 * src/styles/global.css are root-scoped only. Setting
 * `data-palette` on a nested element does NOT activate those
 * tokens at the nested scope. Expanding the cascade to nested
 * scopes would touch 46 selectors — deferred to a later cycle.
 *
 * The price of inline styles: the table duplicates a small slice
 * of what global.css defines. PaletteChip.test.tsx parses
 * global.css and asserts every value here agrees, so drift is
 * caught loudly.
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
      class={
        "inline-flex items-center justify-center rounded-sm border " + (props.class ?? "w-9 h-6")
      }
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
