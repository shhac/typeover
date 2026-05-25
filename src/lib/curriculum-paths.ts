/*
 * URL builders + collection-id parsers for the curriculum. Pure
 * string ops; no `astro:content` dependency, no `CollectionEntry`
 * shape — usable from anywhere (chips, breadcrumbs, sitemap,
 * progress UI, tests).
 *
 * Was inside `./curriculum-nav.ts` alongside the route-time
 * adjacency walks; split out so a small consumer that only needs
 * `exerciseHref` doesn't pull in the Astro `CollectionEntry` type
 * machinery. The umbrella re-export from `./curriculum` keeps every
 * caller's import path stable.
 *
 * Multi-language tracks: every collection ID is prefixed with its
 * language slug (`go/foundations/loops/01`,
 * `zig/basics/hello-and-output/01`), and URLs are 1-to-1 with IDs —
 * `/{id}` is the route. The lang is part of the path because the
 * page renders track-specific chrome (LangCrumbs, exercise grader
 * runtime selection, etc.). See design-docs/31.
 */

/* ============================== Hrefs =============================== */

/** Exercise IDs are `<lang>/<module>/<theme>/<index>`, mapping 1-to-1
 *  to the /[lang]/[module]/[theme]/[index] dynamic route. */
export const exerciseHref = (exerciseId: string) => `/${exerciseId}`;

/** Theme IDs are `<lang>/<module>/<theme>`, mapping 1-to-1 to the
 *  /[lang]/[module]/[theme] overview route. */
export const themeHref = (themeId: string) => `/${themeId}`;

/** Module-overview route. Single-module narrower view of the lang
 *  curriculum — used by breadcrumbs that used to lie about their
 *  destination. */
export const moduleHref = (moduleId: string) => `/${moduleId}`;

/** Module-completion celebration page. Linked from the last
 *  exercise of the last theme in a module via the `nextExerciseHref`
 *  the route file computes. */
export const moduleCompleteHref = (moduleId: string) => `/${moduleId}/complete`;

/** Top-of-track index for a given language (`/go`, `/zig`, …). */
export const langHref = (lang: string) => `/${lang}`;

/* =========================== Static-paths =========================== */

/** Generic splitter for collection-id → route-params. Each entry in
 *  `keys` consumes one `/`-segment; if the id has the wrong number
 *  of segments, or any segment is empty, the result is `null`. All
 *  three concrete `paramsForX` helpers below are one call into this
 *  + a `keys` literal — the validation rule lives in exactly one
 *  place. Content with a malformed path would otherwise silently
 *  render `/undefined/...`-style routes. */
export function parseIdSegments<K extends string>(
  id: string,
  keys: readonly K[],
): Record<K, string> | null {
  const parts = id.split("/");
  if (parts.length !== keys.length) return null;
  const out = {} as Record<K, string>;
  for (let i = 0; i < keys.length; i++) {
    const part = parts[i];
    if (!part) return null;
    out[keys[i]!] = part;
  }
  return out;
}

const EXERCISE_KEYS = ["lang", "module", "theme", "index"] as const;
const THEME_KEYS = ["lang", "module", "theme"] as const;
const MODULE_KEYS = ["lang", "module"] as const;

/** Parse an exercise collection id (`<lang>/<module>/<theme>/<index>`)
 *  into the route params Astro's `getStaticPaths` returns. */
export function paramsForExercise(
  id: string,
): { lang: string; module: string; theme: string; index: string } | null {
  return parseIdSegments(id, EXERCISE_KEYS);
}

/** Parse a theme collection id (`<lang>/<module>/<theme>`) into route
 *  params for the theme-overview page. */
export function paramsForTheme(id: string): { lang: string; module: string; theme: string } | null {
  return parseIdSegments(id, THEME_KEYS);
}

/** Parse a module collection id (`<lang>/<module>`) into route params
 *  for the module-overview / module-complete pages. */
export function paramsForModule(id: string): { lang: string; module: string } | null {
  return parseIdSegments(id, MODULE_KEYS);
}
