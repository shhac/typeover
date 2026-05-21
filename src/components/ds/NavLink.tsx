import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "./_internal";

/**
 * Quiet chrome-link primitive — the muted-hover-to-secondary
 * affordance shared by every header / footer / inline nav link in
 * the app. Pulled out of nine+ hand-rolls scattered across
 * BaseLayout.astro, the privacy + 404 footers, and ResumeLink.
 *
 * Visual contract:
 *   - default → `text-fg-muted`
 *   - hover    → `text-fg-secondary`
 *   - focus    → `.focus-ring` outline (token-pinned)
 *
 * For the brand-anchor (the wordmark in the header) we keep a
 * separate inline anchor — it has different colour tokens
 * (`text-fg-secondary` → `text-fg-primary`) and reads as identity
 * chrome, not navigation.
 *
 * Two surfaces: a Solid component (for .tsx callers) and a class
 * constant (for .astro callers, where dropping a Solid island for
 * a stateless anchor would be overkill). The class constant IS
 * the source of truth — the Solid component just spreads it onto
 * `<a>`. Updates land once.
 */

export const NAV_LINK_CLASS =
  "text-fg-muted hover:text-fg-secondary transition-colors focus-ring";

interface NavLinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Open in a new tab. Adds `target="_blank"` and the safer
   *  `rel="noopener noreferrer"`. Default false — same-tab nav. */
  external?: boolean;
}

export function NavLink(props: ParentProps<NavLinkProps>) {
  const [local, rest] = splitProps(props, ["external", "class", "children"]);
  return (
    <a
      {...rest}
      class={cn(NAV_LINK_CLASS, local.class)}
      {...(local.external
        ? { target: "_blank", rel: rest.rel ?? "noopener noreferrer" }
        : {})}
    >
      {local.children}
    </a>
  );
}
