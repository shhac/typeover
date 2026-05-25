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
  rust: "Rust",
};

export type LangDisplay = (typeof LANG_DISPLAY)[Target];

/* Per-language accent text colour utility. Used by every DS surface
 * that wants to lean a piece of copy toward "this section is about
 * the Go side" / "this section is about the Rust side": Heading,
 * Eyebrow, Panel, CodeBlock's lang-tab icon, the homepage TrackCards,
 * exercise breadcrumbs.
 *
 * The map used to live independently in five DS files. Heading,
 * Eyebrow, and Panel were missing zig + rust entries and silently
 * rejected an `accent="rust"` prop at TS — so a Rust-themed
 * heading wasn't possible without inlining a `class="text-accent-rust"`.
 * Co-locating with LANG_DISPLAY keeps the per-language axis in one
 * place; adding a fourth language is one row here and the typecheck
 * forces every consumer's Record literal to add the same row. */
export type Accent = "primary" | "ts" | Target;

export const ACCENT_TEXT_CLASS = {
  primary: "text-accent-primary",
  ts: "text-accent-ts",
  go: "text-accent-go",
  zig: "text-accent-zig",
  rust: "text-accent-rust",
} as const satisfies Record<Accent, string>;
