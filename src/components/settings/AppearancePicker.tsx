import { createSignal, For, onMount } from "solid-js";
import {
  Badge,
  Button,
  CodeBlock,
  Eyebrow,
  Kbd,
  Panel,
  ProgressChip,
  Stack,
  Text,
} from "~/components/ds";
import {
  currentChoice,
  currentDensity,
  currentRadius,
  type DensityId,
  type RadiusId,
  setDensity,
  setRadius,
  setTheme,
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
                ? "border-accent-amber bg-accent-amber/5"
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
                class="accent-accent-amber"
              />
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
];

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
          <Badge variant="amber">focus</Badge>
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

export function AppearancePicker() {
  return (
    <div class="flex flex-col gap-8">
      <PreviewSample />
      <div class="flex flex-col gap-3">
        <div class="font-mono text-xs uppercase tracking-widest text-fg-muted">Theme</div>
        <RadioGroup<ThemeChoice>
          legend="Theme"
          name="theme"
          options={THEME_OPTIONS}
          initial="system"
          read={currentChoice}
          write={setTheme}
        />
      </div>
      <div class="flex flex-col gap-3">
        <div class="font-mono text-xs uppercase tracking-widest text-fg-muted">Density</div>
        <RadioGroup<DensityId>
          legend="Density"
          name="density"
          options={DENSITY_OPTIONS}
          initial="normal"
          read={currentDensity}
          write={setDensity}
        />
      </div>
      <div class="flex flex-col gap-3">
        <div class="font-mono text-xs uppercase tracking-widest text-fg-muted">Corners</div>
        <RadioGroup<RadiusId>
          legend="Corners"
          name="radius"
          options={RADIUS_OPTIONS}
          initial="normal"
          read={currentRadius}
          write={setRadius}
        />
      </div>
    </div>
  );
}
