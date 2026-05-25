import type { JSX } from "solid-js";

/*
 * Per-language file-tab icons used by `<CodeBlock>` to label its
 * editor-tab header. Previously one tiny file per icon (five files,
 * 17–27 lines each, single consumer) — consolidated here because
 * the SVG wrapper was identical across all five and the only real
 * variation is the per-language glyph path data.
 *
 * Shape:
 *   - `FileIconSvg` owns the `<svg viewBox aria-hidden …>` shell
 *     plus the default stroke (currentColor) + join/cap defaults
 *     used by every glyph below. Color is per-call-site via the
 *     `class` prop, which `CodeBlock` threads through
 *     `langIconClass[lang]` (e.g. `text-accent-go`).
 *   - Each `IconFile*` consumes the wrapper and ships only the
 *     per-language `<path>` / `<circle>` calls.
 *
 * Adding a new file icon: add a new component below that follows
 * the same shape. CodeBlock's `LANG_ICON` `Record<Lang, …>` lookup
 * will fail typecheck until a new row is wired up — which is the
 * intended forcing function.
 */

interface IconProps {
  class?: string;
}

function FileIconSvg(props: { class?: string; children: JSX.Element }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" class={props.class}>
      {props.children}
    </svg>
  );
}

export function IconFileGeneric(props: IconProps) {
  return (
    <FileIconSvg class={props.class}>
      <path
        d="M3.5 1.75h5.2l3.8 3.8v8.7H3.5z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <path
        d="M8.7 1.75v3.8h3.8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <path d="M5.5 11.25h5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </FileIconSvg>
  );
}

export function IconFileGo(props: IconProps) {
  return (
    <FileIconSvg class={props.class}>
      <path
        d="M2.25 8.15c1.1-2.1 2.95-3.2 5.55-3.2 2.5 0 4.45 1.1 5.95 3.2-1.5 2.1-3.45 3.2-5.95 3.2-2.6 0-4.45-1.1-5.55-3.2z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <circle cx="6.35" cy="7.75" r="0.75" fill="currentColor" />
      <circle cx="9.65" cy="7.75" r="0.75" fill="currentColor" />
      <path
        d="M3.15 5.5 1.55 4.3M12.85 5.5l1.6-1.2"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
      />
      <path
        d="M6.55 10.1c.9.45 1.95.45 2.9 0"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
      />
    </FileIconSvg>
  );
}

export function IconFileRs(props: IconProps) {
  return (
    <FileIconSvg class={props.class}>
      <circle cx="8" cy="8" r="3.7" fill="none" stroke="currentColor" stroke-width="1.25" />
      <path
        d="M8 1.9v2M8 12.1v2M1.9 8h2M12.1 8h2M3.7 3.7l1.4 1.4M10.9 10.9l1.4 1.4M12.3 3.7l-1.4 1.4M5.1 10.9l-1.4 1.4"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
      />
      <path
        d="M6.35 10.15v-4.3h1.9c1.05 0 1.7.55 1.7 1.4 0 .7-.45 1.15-1.15 1.3l1.25 1.6H8.8L7.7 8.7h-.25v1.45z"
        fill="currentColor"
      />
    </FileIconSvg>
  );
}

export function IconFileTs(props: IconProps) {
  return (
    <FileIconSvg class={props.class}>
      <path
        d="M2.75 2.75h10.5v10.5H2.75z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linejoin="round"
      />
      <path d="M5 6h6" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
      <path d="M6.5 6v5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
      <path
        d="M10.6 8.1c-.4-.45-1.9-.4-1.9.45 0 .6.75.75 1.35.9.65.15 1.2.35 1.2.9 0 .9-1.65 1-2.25.35"
        fill="none"
        stroke="currentColor"
        stroke-width="1.1"
        stroke-linecap="round"
      />
    </FileIconSvg>
  );
}

export function IconFileZig(props: IconProps) {
  return (
    <FileIconSvg class={props.class}>
      <path
        d="M3 3.25h9.8L7.2 8h5.8L3.2 12.75 8.8 8H3z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linejoin="round"
      />
      <path
        d="M5.2 3.25 3.1 1.8M10.8 12.75l2.1 1.45"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
      />
    </FileIconSvg>
  );
}
