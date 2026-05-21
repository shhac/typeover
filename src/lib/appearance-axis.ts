/*
 * Shared factory for the appearance axes (theme, density, radius,
 * style, palette). Each axis is a finite enum persisted to
 * localStorage + reflected as a `data-{key}` attribute on
 * <html>. The DOM attribute is the source of truth at read time
 * (the bootstrap script in BaseLayout already resolved it
 * pre-paint); localStorage is the durable pin.
 *
 * design-docs/20 FW-1 — `defineAppearanceAxis()` collapses what
 * used to be five hand-rolled getter/setter pairs. Extracted into
 * its own module so `theme.ts`, `appearance.ts`, and `palette.ts`
 * can share it without coupling.
 */

export interface AxisConfig<T extends string> {
  values: readonly T[];
  storageKey: string;
  /** The camelCase key under `document.documentElement.dataset`
   *  (the part after `data-` in the rendered HTML attribute). */
  datasetKey: string;
  default: T;
}

export interface AppearanceAxis<T extends string> {
  /** Type guard reusable by callers that hold raw strings (e.g.
   *  the colour-axis `currentChoice()` which has to handle
   *  `"system"` separately). */
  isValue: (s: string | null | undefined) => s is T;
  /** The current effective value. DOM attribute is authoritative;
   *  missing / unknown values fall back to `default`. */
  current: () => T;
  /** Persist + apply. Writes the value to both the pin and the DOM
   *  attribute in one call. */
  set: (next: T) => void;
}

export function defineAppearanceAxis<T extends string>(
  config: AxisConfig<T>,
): AppearanceAxis<T> {
  const valueSet: ReadonlySet<string> = new Set(config.values);
  const isValue = (s: string | null | undefined): s is T =>
    typeof s === "string" && valueSet.has(s);

  const current = (): T => {
    if (typeof document !== "undefined") {
      const attr = document.documentElement.dataset[config.datasetKey];
      if (isValue(attr)) return attr;
    }
    return config.default;
  };

  const set = (next: T): void => {
    if (typeof document === "undefined") return;
    if (typeof localStorage !== "undefined") localStorage.setItem(config.storageKey, next);
    document.documentElement.dataset[config.datasetKey] = next;
  };

  return { isValue, current, set };
}
