import { createSignal, For, onMount, Show, type JSX } from "solid-js";

/*
 * Generic card-style radio group. A single `<fieldset>` of
 * `<label>`-wrapped radios where the visual selection state lives
 * on the LABEL (border + tinted bg + optional swatch) and the
 * native `<input type="radio">` is `sr-only` for a11y.
 *
 * Extracted from AppearancePicker per the structural review's
 * file-decomposition lens — five appearance axes (theme, density,
 * shape, style, palette) were each instantiating the same
 * RadioGroup<T> with their own option list. The component is now
 * a DS primitive other forms can reuse.
 *
 * Why a class-card and not a plain radio: design-docs/26 walked
 * through the options; the chosen pattern is the Headless-UI /
 * Tailwind-UI "RadioGroup-as-cards" shape — each option is a
 * tappable card with its own label + description + optional
 * swatch, native radio kept in the DOM behind `sr-only` so
 * keyboard arrow-nav within the group + screen-reader announcement
 * + `aria-checked` all keep working.
 *
 * `:focus-visible` on the sr-only input projects an outline onto
 * the parent label via `has-[:focus-visible]:` so keyboard users
 * still see where focus lives.
 */

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description: string;
  /** Optional visual affordance rendered before the label.
   *  AppearancePicker's palette axis uses this to surface palette
   *  identity via PaletteChip; other axes leave it undefined. */
  swatch?: JSX.Element;
}

export interface RadioGroupProps<T extends string> {
  /** Visually hidden via `<legend class="sr-only">` — surfaces the
   *  group's purpose to screen readers + voice control. */
  legend: string;
  options: readonly RadioOption<T>[];
  /** SSR fallback. Used as the radio's value on initial paint;
   *  `onMount` overrides it with whatever `read()` returns. */
  initial: T;
  /** Reactive accessor for the persisted choice. The shell uses
   *  this to defer pulling from localStorage / OS preference until
   *  after hydration so SSR + hydration don't disagree. */
  read: () => T;
  /** Caller-supplied write back. The component fires this on every
   *  selection; the caller decides whether/how to persist. */
  write: (value: T) => void;
  /** `name` attr on the underlying radios — must be unique per
   *  group to keep the native keyboard arrow-nav scoped. */
  name: string;
}

export function RadioGroup<T extends string>(props: RadioGroupProps<T>) {
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
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-primary has-[:focus-visible]:outline-offset-2 " +
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
                class="sr-only"
              />
              <Show when={opt.swatch}>{opt.swatch}</Show>
              <span class="font-sans text-sm text-fg-primary">{opt.label}</span>
            </div>
            <span class="text-fg-muted text-xs">{opt.description}</span>
          </label>
        )}
      </For>
    </fieldset>
  );
}
