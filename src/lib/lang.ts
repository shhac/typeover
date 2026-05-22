import type { Target } from "./content-schema";

/*
 * One source of truth for "the human label of each track language."
 *
 * Before this module landed there were six near-identical copies of
 * `{ go: "Go", zig: "Zig" }` scattered across the route pages and a
 * couple of components (RUNTIME_LABELS, LANGUAGE_LABEL, four
 * page-level LANG_DISPLAY consts). Adding a third language meant
 * editing six places and hoping nothing got missed.
 *
 * Keyed by the schema's `Target` so the type system catches a new
 * language entry the moment it's added to `targetSchema.options`.
 */
export const LANG_DISPLAY: Record<Target, string> = {
  go: "Go",
  zig: "Zig",
};

export type LangDisplay = (typeof LANG_DISPLAY)[Target];
