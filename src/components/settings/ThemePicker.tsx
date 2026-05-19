import { createSignal, For, onMount } from "solid-js";
import { currentChoice, setTheme, type ThemeChoice } from "~/lib/theme";

/*
 * Theme radio group. Sole interactive on /settings today.
 *
 * Reads the persisted choice on mount and binds the radio state to
 * it. Each click both updates the DOM (instant repaint) and the
 * stored pin via setTheme().
 *
 * "System" is a distinct option from the two explicit themes — it
 * means "clear my pin, follow the OS." When the OS swaps light/dark
 * the user implicitly follows; useful for laptops with
 * Night-Shift-style schedules.
 */

interface Option {
  value: ThemeChoice;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
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

export function ThemePicker() {
  /* Default to "system" for the first paint; the real value lands in
   * onMount once we can read localStorage. Avoids a hydration mismatch
   * because the SSR HTML doesn't know which radio is checked. */
  const [choice, setChoice] = createSignal<ThemeChoice>("system");
  onMount(() => setChoice(currentChoice()));

  function pick(next: ThemeChoice) {
    setChoice(next);
    setTheme(next);
  }

  return (
    <fieldset class="flex flex-col gap-3 m-0 p-0 border-0">
      <legend class="sr-only">Theme</legend>
      <For each={OPTIONS}>
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
                name="theme"
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
