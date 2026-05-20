import { createSignal, For, onMount, Show, type JSX } from "solid-js";
import {
  Badge,
  Button,
  CodeBlock,
  Eyebrow,
  Kbd,
  PaletteChip,
  Panel,
  ProgressChip,
  Stack,
  Text,
  Toast,
  useToast,
} from "~/components/ds";
import {
  currentChoice,
  currentDensity,
  currentPaletteChoice,
  currentRadius,
  currentStyle,
  type DensityId,
  type PaletteChoice,
  type PaletteId,
  PALETTE_HOME_STYLE,
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
 * Three radio groups, one per appearance axis. design-docs/14
 * proposes them stacked rather than tabbed — they're related
 * concerns and the page is short.
 *
 * The radio-group shape is identical across the three axes (label +
 * description per option, single selection, click both updates the
 * DOM via the setter AND repaints the chosen-pill state). Rather
 * than write the markup three times, the component is parameterised
 * over the option list, the current-value accessor, and the setter.
 *
 * `onMount` for each accessor: SSR can't read localStorage, and
 * the bootstrap script in BaseLayout has already set the DOM
 * attribute by the time Solid hydrates — so the first paint shows
 * the right radio without a hydration flicker.
 */

interface RadioOption<T extends string> {
  value: T;
  label: string;
  description: string;
  /** Optional visual affordance rendered before the radio input.
   *  The palette picker uses this to surface palette identity via
   *  PaletteChip; other axes leave it undefined. */
  swatch?: JSX.Element;
}

interface RadioGroupProps<T extends string> {
  legend: string;
  options: readonly RadioOption<T>[];
  initial: T;
  read: () => T;
  write: (value: T) => void;
  name: string;
}

function RadioGroup<T extends string>(props: RadioGroupProps<T>) {
  const [choice, setChoice] = createSignal<T>(props.initial);
  onMount(() => setChoice(() => props.read()));

  const pick = (next: T) => {
    setChoice(() => next);
    props.write(next);
  };

  return (
    <fieldset class="flex flex-col gap-3 m-0 p-0 border-0">
      <legend class="sr-only">{props.legend}</legend>
      <For each={props.options}>
        {(opt) => (
          <label
            class={
              "flex flex-col gap-1 p-3 border rounded-sm cursor-pointer transition-colors " +
              (choice() === opt.value
                ? "border-accent-primary bg-accent-primary/5"
                : "border-border-default hover:border-border-strong")
            }
          >
            <div class="flex items-center gap-3">
              <input
                type="radio"
                name={props.name}
                value={opt.value}
                checked={choice() === opt.value}
                onChange={() => pick(opt.value)}
                class="accent-accent-primary"
              />
              <Show when={opt.swatch}>{opt.swatch}</Show>
              <span class="font-sans text-sm text-fg-primary">{opt.label}</span>
            </div>
            <span class="text-fg-muted text-xs ml-7">{opt.description}</span>
          </label>
        )}
      </For>
    </fieldset>
  );
}

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

/* Palette options — `default` is the magic value that follows the
 * active style. Per-palette labels + descriptions live here; the
 * picker filters by PALETTE_HOME_STYLE unless "Show all" is on.
 * design-docs/22. */
const PALETTE_LABELS: Record<PaletteId, { label: string; description: string }> = {
  "phosphor-amber": { label: "Phosphor Amber", description: "Bloomberg trading-floor amber on near-black." },
  "phosphor-green": { label: "Phosphor Green", description: "IBM 3270 / VT220 CRT ghost." },
  "ice-blue": { label: "Ice Blue", description: "Arctic quant-desk slate." },
  "tape-reel": { label: "Tape Reel", description: "DEC oxblood on parchment." },
  "warm-paper": { label: "Warm Paper", description: "Off-white panels on light, warm-dark on dark." },
  kraft: { label: "Kraft", description: "True brown shipping-carton paper." },
  manila: { label: "Manila", description: "Folder yellow with ink-blue accent." },
  newsprint: { label: "Newsprint", description: "Off-white pulp + headline red." },
  calfskin: { label: "Calfskin", description: "Pale calfskin with sepia ink." },
  "parchment-ink": { label: "Parchment & Ink", description: "Cream-on-light, aged-paper-on-dark." },
  vellum: { label: "Vellum", description: "Warm old-paper + brown ink." },
  pelican: { label: "Pelican", description: "Penguin paperback orange spine." },
  sepia: { label: "Sepia", description: "Brown-everything; faded photograph." },
  almanac: { label: "Almanac", description: "Off-white + deep teal headings." },
  "e-reader": { label: "E-Reader", description: "Kindle Paperwhite e-ink — cool grey on light, warm Night Mode + amber highlight on dark." },
  "aurora-amber": { label: "Aurora Amber", description: "Amber + TS-blue radial bloom." },
  "glacier-blue": { label: "Glacier Blue", description: "Cool cyan-to-ice bloom." },
  "lavender-mist": { label: "Lavender Mist", description: "Lilac + rose synthwave." },
  monochrome: { label: "Monochrome", description: "Clinical, accent-free glass." },
  "desk-felt": { label: "Desk Felt", description: "Felt grey desk under white islands." },
  "app-store": { label: "App Store", description: "Apple System — TS-blue CTA." },
  "dark-wood": { label: "Dark Wood", description: "Warm walnut under parchment tiles." },
  "studio-grey": { label: "Studio Grey", description: "Cool slate; Linear / Figma vibe." },
  "sunlit-pine": { label: "Sunlit Pine", description: "Warm cream + pale pine cabin." },
};

/* Focused mini-canvas showing the visual elements every axis
 * touches: surface colours (theme), padding/gap (density), corner
 * radii (radius). Pure DS composition — no localStorage reads, no
 * Solid signals; the CSS cascade fans the picker's mutations
 * through every primitive at once. Per design-docs/14 step 6.
 *
 * Composed inline rather than as its own file because no other
 * surface needs it; if a second consumer ever appears we extract.
 */
function PreviewSample() {
  return (
    <Panel padding="default" tone="default">
      <Stack gap="md">
        <Stack gap="xs">
          <Eyebrow>preview</Eyebrow>
          <Text tone="muted" size="xs" family="mono">
            A miniature of the site — every change above flows through here.
          </Text>
        </Stack>
        <Stack direction="row" gap="sm" align="center" wrap>
          <Button variant="primary" size="sm">
            Submit
          </Button>
          <Button variant="secondary" size="sm">
            Run
          </Button>
          <Button variant="ghost" size="sm">
            <Kbd>↵</Kbd>
            <span>enter</span>
          </Button>
        </Stack>
        <Stack direction="row" gap="sm" align="center" wrap>
          <Badge variant="ts">typescript</Badge>
          <Badge variant="go">golang</Badge>
          <Badge variant="primary">focus</Badge>
          <ProgressChip kind="theme" passed={4} total={9} />
        </Stack>
        <CodeBlock lang="go" filename="preview.go">{`package main

import "fmt"

func main() {
\tfmt.Println("hello")
}`}</CodeBlock>
      </Stack>
    </Panel>
  );
}

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
    const filtered = (showAllPalettes() ? PALETTES : PALETTES.filter((p) => PALETTE_HOME_STYLE[p] === style())).map(
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
