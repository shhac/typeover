---
name: astro-jsx-in-attributes
discovered: 2026-05-19
context: tried to extract a generic Crumbs component (Solid .tsx)
---

# Astro's template parser refuses nested component JSX in attribute braces

## The symptom

Wrote a Solid component `Crumbs.tsx` that took `left` and `right` JSX
elements as props, intending to use it as:

```astro
<Crumbs
  left={<Badge variant="amber">{moduleEntry.data.title}</Badge>}
  right={<Badge variant="default" outline>{themeEntry.data.title}</Badge>}
/>
```

Astro build failed with:

```
[ERROR] [vite] ✗ Build failed in 258ms
Expected ">" but found "variant"
  Location: src/pages/go/[module]/[theme]/index.astro:80:662
```

The error location points well past the actual call (col 662 of line 80
is a misleading offset across the merged template), but the cause is at
the `left={<Badge ...>...</Badge>}` line.

## Why

Astro's template parser is HTML-flavoured. Inside attribute-value
braces `{...}` it accepts JavaScript expressions but **disallows
component tags** — `<Badge variant=...>` inside `{...}` is parsed as if
the `<` were starting a new HTML element, hits the first attribute name
`variant`, and bails. This applies to all framework components imported
into `.astro` pages (Solid, React, etc.), regardless of `.tsx` author
intent.

Children between an open/close tag work fine:

```astro
<LangCrumbs>
  <Text>extras</Text>
</LangCrumbs>
```

The restriction is *specifically* on JSX inside attribute braces.

## The fix

Use Astro named slots:

```astro
---
// Crumbs.astro
---
<div class="flex flex-row gap-2 items-center">
  <slot name="left" />
  <span aria-hidden="true">→</span>
  <slot name="right" />
  <slot />
</div>
```

```astro
<Crumbs>
  <Badge slot="left" variant="amber">{moduleEntry.data.title}</Badge>
  <Badge slot="right" variant="default" outline>{themeEntry.data.title}</Badge>
  <!-- default slot: extras -->
  <Text>exercise N · type</Text>
</Crumbs>
```

This means container-style components (which need multiple JSX regions)
should live as `.astro` files when called from `.astro` pages. Pure
behavioural Solid components are unchanged.

## Cost

A 30-minute detour and a revert. Recorded in
`design-docs/05-design-system.md` as deferred Crumbs work.

## Pickup criteria

Convert `Crumbs` + `LangCrumbs` to `.astro` when (a) a 4th breadcrumb
caller lands, OR (b) a chrome change (arrow glyph swap, separator dot)
needs to apply at all sites.
