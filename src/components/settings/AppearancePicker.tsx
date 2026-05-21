import { createSignal, onMount } from "solid-js";
import {
  Eyebrow,
  PaletteChip,
  RadioGroup,
  type RadioOption,
  Toast,
  useToast,
} from "~/components/ds";
import { PreviewSample } from "./PreviewSample";
import {
  currentChoice,
  currentDensity,
  currentPaletteChoice,
  currentRadius,
  currentStyle,
  type DensityId,
  type PaletteChoice,
  PALETTE_HOME_STYLE,
  PALETTE_LABELS,
  PALETTES,
  type RadiusId,
  reapplyDefaultPaletteForCurrentStyle,
  setDensity,
  setPalette,
  setRadius,
  setStyle,
  setTheme,
  type StyleId,
  STYLE_DEFAULT_PALETTE,
  type ThemeChoice,
} from "~/lib/theme";

/*
 * Five radio groups, one per appearance axis (theme, density,
 * shape, style, palette). design-docs/14 proposes them stacked
 * rather than tabbed — related concerns, short page.
 *
 * The radio-group itself is now a DS primitive (`<RadioGroup<T>>`)
 * — this file orchestrates the five axes around it, owns the
 * change-undo Toast wiring, and renders the live preview pane
 * via the sibling `<PreviewSample>` component.
 *
 * `onMount` for each accessor: SSR can't read localStorage, and
 * the bootstrap script in BaseLayout has already set the DOM
 * attribute by the time Solid hydrates — so the first paint shows
 * the right radio without a hydration flicker.
 */

const THEME_OPTIONS: RadioOption<ThemeChoice>[] = [
  {
    value: "system",
    label: "System",
    description: "Follow your OS light/dark preference.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Near-black surfaces, amber accent. Default.",
  },
  {
    value: "light",
    label: "Light",
    description: "Off-white surfaces, darkened accents for AA contrast.",
  },
];

const DENSITY_OPTIONS: RadioOption<DensityId>[] = [
  {
    value: "compact",
    label: "Compact",
    description: "Tighter spacing. Bloomberg-terminal nostalgia.",
  },
  {
    value: "normal",
    label: "Normal",
    description: "The default. Airy Linear-style breathing room.",
  },
  {
    value: "airy",
    label: "Airy",
    description: "More whitespace. Reads like an essay.",
  },
];

const STYLE_OPTIONS: RadioOption<StyleId>[] = [
  {
    value: "terminal",
    label: "Terminal",
    description: "Bloomberg-meets-airy-Linear. Flat, hairline-only, mono. Default.",
  },
  {
    value: "cardboard",
    label: "Cardboard",
    description: "Warm paper grain on panels. Reads like a notebook.",
  },
  {
    value: "textbook",
    label: "Textbook",
    description: "Serif headings + amber left-rule. Annotated-page feel.",
  },
  {
    value: "glass",
    label: "Glass",
    description: "Translucent panels with subtle backdrop blur where supported.",
  },
  {
    value: "islands",
    label: "Islands",
    description: "Distinct floating cards with stronger drop shadows.",
  },
];

const RADIUS_OPTIONS: RadioOption<RadiusId>[] = [
  {
    value: "sharp",
    label: "Sharp",
    description: "Near-square corners. Terminal feel.",
  },
  {
    value: "normal",
    label: "Normal",
    description: "Subtle 2–4px corners. Default.",
  },
  {
    value: "rounded",
    label: "Rounded",
    description: "Friendlier 4–12px corners.",
  },
  {
    value: "pill",
    label: "Pill",
    description: "Generously curved — 8–24px. Small elements pill out.",
  },
];

/** Find an option's user-facing label for a given enum value, falling
 *  back to the raw value if the option list is out of date. Used by
 *  the toast so the announcement says "Theme: Dark" rather than
 *  "Theme: dark" — a small but meaningful UX detail. */
function labelOf<T extends string>(options: readonly RadioOption<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function AppearancePicker() {
  const toast = useToast();
  const [showAllPalettes, setShowAllPalettes] = createSignal(false);
  /* Local mirror of the active style — the palette picker filters
   * its options by `PALETTE_HOME_STYLE[opt] === style()` when "Show
   * all" is off. Updated when the Style radio changes (via the
   * wrappedSetStyle below). */
  const [style, setStyleLocal] = createSignal<StyleId>("terminal");
  onMount(() => setStyleLocal(currentStyle()));

  /* Wrap each setter so flipping any axis announces the change via
   * Toast with an undo button restoring the previous value. design-
   * docs/16 F-15. Without this the only feedback was the preview
   * pane silently re-rendering — easy to miss and impossible to
   * undo if the new theme made the page unreadable. */
  function wrap<T extends string>(
    options: readonly RadioOption<T>[],
    axis: string,
    read: () => T,
    write: (next: T) => void,
  ): (next: T) => void {
    return (next) => {
      const prev = read();
      write(next);
      if (prev === next) return;
      toast.emit({
        message: `${axis}: ${labelOf(options, next)}`,
        onUndo: () => write(prev),
      });
    };
  }

  /* Style setter wrapped further: after changing style, also
   * re-resolve the effective palette IF the user hasn't pinned one
   * (Default magic value). This is the "leaving Default selected
   * and changing Style means the palette changes too" contract
   * (design-docs/22). */
  function setStyleAndReapplyPalette(next: StyleId): void {
    setStyle(next);
    reapplyDefaultPaletteForCurrentStyle();
    setStyleLocal(next);
  }

  /* Palette-specific setter wrapping — the radio group emits
   * `PaletteChoice` (PaletteId | "default"); the Toast label uses
   * the friendly name. */
  function paletteWrap(next: PaletteChoice): void {
    const prev = currentPaletteChoice();
    setPalette(next);
    if (prev === next) return;
    const friendly =
      next === "default"
        ? `Default (${PALETTE_LABELS[STYLE_DEFAULT_PALETTE[style()]].label})`
        : PALETTE_LABELS[next].label;
    toast.emit({
      message: `Palette: ${friendly}`,
      onUndo: () => setPalette(prev),
    });
  }

  /* Filter the palette list by home style unless "Show all" is on.
   * Default radio is always shown first. Each option gets a
   * PaletteChip swatch — for "Default" the chip shows the
   * currently-resolved palette so the swatch updates as Style
   * changes. design-docs/24 P2. */
  const paletteOptions = (): RadioOption<PaletteChoice>[] => {
    const defaultLabel = STYLE_DEFAULT_PALETTE[style()];
    const defaultOption: RadioOption<PaletteChoice> = {
      value: "default",
      label: `Default — ${PALETTE_LABELS[defaultLabel].label}`,
      description: `Follow the active style's default palette. Changes as you switch Style.`,
      swatch: <PaletteChip palette={defaultLabel} />,
    };
    const filtered = (
      showAllPalettes() ? PALETTES : PALETTES.filter((p) => PALETTE_HOME_STYLE[p] === style())
    ).map(
      (p): RadioOption<PaletteChoice> => ({
        value: p,
        label: PALETTE_LABELS[p].label,
        description: PALETTE_LABELS[p].description,
        swatch: <PaletteChip palette={p} />,
      }),
    );
    return [defaultOption, ...filtered];
  };

  /* Desktop: 2-column split — controls on the left, preview on the
   * right, preview sticks to the viewport top as the controls
   * column scrolls. Mobile: stacked — controls first, preview
   * below (closer to thumb, fewer pixels between flip and result).
   * Source-order is controls-first so a screen reader hits the
   * radio groups before the decorative preview. */
  return (
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,420px)] gap-8 items-start">
      <div class="flex flex-col gap-8 order-1">
        <div class="flex flex-col gap-3">
          <Eyebrow tone="muted">Theme</Eyebrow>
          <RadioGroup<ThemeChoice>
            legend="Theme"
            name="theme"
            options={THEME_OPTIONS}
            initial="system"
            read={currentChoice}
            write={wrap(THEME_OPTIONS, "Theme", currentChoice, setTheme)}
          />
        </div>
        <div class="flex flex-col gap-3">
          <Eyebrow tone="muted">Density</Eyebrow>
          <RadioGroup<DensityId>
            legend="Density"
            name="density"
            options={DENSITY_OPTIONS}
            initial="normal"
            read={currentDensity}
            write={wrap(DENSITY_OPTIONS, "Density", currentDensity, setDensity)}
          />
        </div>
        <div class="flex flex-col gap-3">
          <Eyebrow tone="muted">Shape</Eyebrow>
          <RadioGroup<RadiusId>
            legend="Shape"
            name="radius"
            options={RADIUS_OPTIONS}
            initial="normal"
            read={currentRadius}
            write={wrap(RADIUS_OPTIONS, "Shape", currentRadius, setRadius)}
          />
        </div>
        <div class="flex flex-col gap-3">
          <Eyebrow tone="muted">Style</Eyebrow>
          <RadioGroup<StyleId>
            legend="Style"
            name="style"
            options={STYLE_OPTIONS}
            initial="terminal"
            read={currentStyle}
            write={wrap(STYLE_OPTIONS, "Style", currentStyle, setStyleAndReapplyPalette)}
          />
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex flex-row items-center justify-between gap-3">
            <Eyebrow tone="muted">Palette</Eyebrow>
            <label class="flex flex-row items-center gap-2 cursor-pointer font-mono text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={showAllPalettes()}
                onChange={(e) => setShowAllPalettes(e.currentTarget.checked)}
                class="accent-accent-primary"
              />
              <span>Show all</span>
            </label>
          </div>
          <RadioGroup<PaletteChoice>
            legend="Palette"
            name="palette"
            options={paletteOptions()}
            initial="default"
            read={currentPaletteChoice}
            write={paletteWrap}
          />
        </div>
      </div>
      <div class="order-2 lg:sticky lg:top-20 lg:self-start">
        <PreviewSample />
      </div>
      <Toast state={toast.state} onDismiss={toast.dismiss} />
    </div>
  );
}
