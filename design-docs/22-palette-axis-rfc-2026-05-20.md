# 22 — Palette axis as a first-class dimension (RFC, 2026-05-20)

## Why

design-docs/21 ships a radical Style rebind (typography, border, radius,
measure per style). The colour overrides that today live INSIDE
`:root[data-style="..."]` blocks (cardboard's warm tilt, textbook's
parchment + dimmed amber, islands' page-vs-panel deepening) need to
move OUT to their own first-class axis so:

- A learner can pick a style for its **chrome** (typography, radius,
  borders) and a palette for its **colour identity** independently.
- Each style ships a **default palette** (its today-shipped colour
  identity) plus a curated set of named alternatives.
- The Light/Dark toggle remains first-class — every named palette
  ships BOTH a dark variant and a light variant.
- A custom palette pin persists across style switches: a learner
  who picked "Manila" under cardboard keeps Manila even after they
  flip to textbook.

Five lens subagents (one per style) produced palette inventories;
this RFC is the synthesis.

## Architecture

### Three orthogonal axes carrying colour

| axis           | values                                                            | DOM attribute     | localStorage key      |
|----------------|-------------------------------------------------------------------|-------------------|-----------------------|
| **Theme**      | `dark` \| `light` (`system` follows OS)                            | `data-theme`      | `typeover:theme`      |
| **Style**      | `terminal` \| `cardboard` \| `textbook` \| `glass` \| `islands`   | `data-style`      | `typeover:style`      |
| **Palette**    | `default` \| one of 22 named palette IDs                          | `data-palette`    | `typeover:palette`    |

`data-theme` (light/dark) chooses which of a palette's two variants
is bound to the colour tokens. `data-style` chooses chrome
(typography, border-style, radius mapping, measure) only — no
colour overrides in the style blocks any more. `data-palette`
chooses the colour identity.

### Persistence semantics

`typeover:palette` stores either:
- The literal string `"default"` (default), or absent — **follow the
  active style's default palette**, or
- A specific palette ID like `"manila"` — **pin this palette
  regardless of which style is active**.

The bootstrap script in `BaseLayout.astro` resolves to an explicit
DOM attribute pre-paint:

```js
const STYLE_DEFAULT_PALETTE = {
  terminal:  "phosphor-amber",
  cardboard: "warm-paper",
  textbook:  "parchment-ink",
  glass:     "aurora-amber",
  islands:   "desk-felt",
};
const pin = localStorage.getItem("typeover:palette");
const effectivePalette =
  pin && pin !== "default" ? pin : STYLE_DEFAULT_PALETTE[activeStyle];
document.documentElement.dataset.palette = effectivePalette;
```

### Behaviour when switching styles

| Pin state                  | Switching style          | Result                                                    |
|----------------------------|--------------------------|-----------------------------------------------------------|
| `"default"` / absent       | style → newStyle         | palette → `STYLE_DEFAULT_PALETTE[newStyle]` (changes too) |
| pinned ID (e.g. `"manila"`)| style → newStyle         | palette stays `"manila"` (custom persists)                |

This matches the user's exact ask: "leaving 'Default' selected and
changing the 'Style' means the palette changes as the meaning of
default palette changes. If someone has customised their palette,
then this would persist the chosen palette as they switch styles."

### Behaviour when switching palettes

The user picks a specific palette → `typeover:palette` =
`<palette-id>`. That ID is pinned. The "Default" radio at the top
of the palette picker resets `typeover:palette` = `"default"`
(equivalent to clearing the pin).

### Cross-style palette compatibility

Palettes are **global** — any palette ID can be applied to any
style. The colour tokens override; the chrome stays. Some palettes
were authored with a specific style in mind (glass's body
gradients only really shine when `--panel-bg-mix: 60%`), but
applying them across styles is allowed and merely yields
visually-mixed surfaces. The settings UI **groups** palettes by
their "home style" but doesn't restrict cross-application.

### Why a custom palette ID can carry the same string across styles

The 22 named palettes use IDs unique across the catalogue (no
collisions like `vellum` appearing twice). One renamed during
synthesis: cardboard's "Vellum" became "Calfskin" to disambiguate
from textbook's "Vellum". A palette ID maps 1:1 to a CSS-variable
override block, so persistence is straightforward.

## Default palette per style

| style       | default palette ID  |
|-------------|---------------------|
| `terminal`  | `phosphor-amber`    |
| `cardboard` | `warm-paper`        |
| `textbook`  | `parchment-ink`     |
| `glass`     | `aurora-amber`      |
| `islands`   | `desk-felt`         |

## Per-style "home" palettes (settings UI grouping)

The settings page renders palettes grouped by their home style.
Cross-style application is allowed but the picker shows each
palette under exactly one style group for discoverability.

- **terminal** (4): `phosphor-amber` (default), `phosphor-green`,
  `ice-blue`, `tape-reel`
- **cardboard** (5): `warm-paper` (default), `kraft`, `manila`,
  `newsprint`, `calfskin`
- **textbook** (5): `parchment-ink` (default), `vellum`, `pelican`,
  `sepia`, `almanac`
- **glass** (4): `aurora-amber` (default), `glacier-blue`,
  `lavender-mist`, `monochrome`
- **islands** (5): `desk-felt` (default), `app-store`, `dark-wood`,
  `studio-grey`, `sunlit-pine`

Total: **22 named palettes** plus the `default` magic value (23
selectable options).

## Palette inventory — full token spec

Each palette below ships dark + light variants. Tokens follow the
naming in `src/styles/global.css`. WCAG AA contrast is verified per
the per-subagent reports; spot-checked here.

The body radial-gradient is a palette token only for `glass` (other
styles don't use one). When a non-glass palette is active under
glass style, the gradient falls back to neutral grey-on-grey via
`color-mix(in oklab, var(--color-fg-faint) 10%, transparent)`.

### TERMINAL palettes

#### `phosphor-amber` (terminal default)

Bloomberg trading-floor amber on near-black. The identity floor.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#0a0a0b` | `#fafaf8` |
| bg-panel        | `#121214` | `#f2f2ef` |
| bg-elevated     | `#1a1a1d` | `#e9e9e5` |
| bg-inset        | `#08080a` | `#ffffff` |
| fg-primary      | `#e8e8e8` | `#111113` |
| fg-secondary    | `#a8a8ad` | `#3a3a3e` |
| fg-muted        | `#8a8a8f` | `#5a5a5f` |
| fg-faint        | `#6b6b70` | `#8a8a8f` |
| accent-amber    | `#ffa726` | `#a85d00` |
| accent-ts       | `#4a9eff` | `#1d4ed8` |
| accent-go       | `#00add8` | `#006d8c` |
| border-default  | `#26262a` | `#d4d4cf` |
| border-strong   | `#3a3a40` | `#b8b8b2` |

#### `phosphor-green`

IBM 3270 / VT220 ghost — single-colour CRT.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#050a06` | `#f4f6ee` |
| bg-panel        | `#0a120c` | `#ebefdf` |
| bg-elevated     | `#111913` | `#e2e7d3` |
| bg-inset        | `#020604` | `#fafbf4` |
| fg-primary      | `#b8f5c2` | `#0c2410` |
| fg-secondary    | `#7ec48b` | `#2a4a30` |
| fg-muted        | `#5a9968` | `#4a6a50` |
| fg-faint        | `#3d6b48` | `#7a8f80` |
| accent-amber    | `#5cff7a` | `#1f6b2a` |
| accent-ts       | `#5cd6ff` | `#155a8a` |
| accent-go       | `#7affd9` | `#006d6d` |
| border-default  | `#1d2e22` | `#c8d0b8` |
| border-strong   | `#2e4836` | `#a8b298` |

#### `ice-blue`

Arctic quant-desk slate.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#0a0e14` | `#f4f7fa` |
| bg-panel        | `#11161f` | `#eaeff5` |
| bg-elevated     | `#1a212c` | `#dfe6ee` |
| bg-inset        | `#070a0f` | `#ffffff` |
| fg-primary      | `#dde8f2` | `#0c1419` |
| fg-secondary    | `#9fb3c8` | `#2e424f` |
| fg-muted        | `#7a8fa6` | `#4d6373` |
| fg-faint        | `#586878` | `#7a8fa0` |
| accent-amber    | `#5ab8ff` | `#155a9c` |
| accent-ts       | `#7f9cff` | `#1a3fa3` |
| accent-go       | `#4dd9d6` | `#006b78` |
| border-default  | `#1f2935` | `#c8d4e0` |
| border-strong   | `#2f3d4d` | `#a4b3c2` |

#### `tape-reel`

DEC minicomputer oxblood-on-parchment.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#0c0707` | `#f4ead8` |
| bg-panel        | `#14090a` | `#ebe0c8` |
| bg-elevated     | `#1d0e10` | `#e1d4b8` |
| bg-inset        | `#080404` | `#faf3e4` |
| fg-primary      | `#f0d8d4` | `#1a0a0a` |
| fg-secondary    | `#c49a92` | `#3d1a17` |
| fg-muted        | `#9a7068` | `#5e3530` |
| fg-faint        | `#6b4843` | `#8a6a60` |
| accent-amber    | `#ff5b4a` | `#9c2418` |
| accent-ts       | `#ff8a5c` | `#6a3a14` |
| accent-go       | `#ffb86b` | `#1f5a48` |
| border-default  | `#2a1416` | `#cdbf9c` |
| border-strong   | `#432025` | `#ad9f7a` |

### CARDBOARD palettes

#### `warm-paper` (cardboard default)

Warm-paper grain on dark / off-white panels on light.

| token           | dark            | light           |
|-----------------|-----------------|-----------------|
| bg-base         | `#0a0a0b`       | `#ffffff`       |
| bg-panel        | `#1a1612`       | `#f5f0e8`       |
| bg-elevated     | `#221c17`       | `#ebe4d6`       |
| bg-inset        | `#08080a`       | `#f0f2f5`       |
| fg-primary      | `#e8e8e8`       | `#14171f`       |
| fg-secondary    | `#a8a8ad`       | `#4a5060`       |
| fg-muted        | `#8a8a8f`       | `#6b7280`       |
| fg-faint        | `#6b6b70`       | `#94989f`       |
| accent-amber    | `#ffa726`       | `#a06400`       |
| accent-ts       | `#4a9eff`       | `#2057b8`       |
| accent-go       | `#00add8`       | `#006d8e`       |
| border-default  | `#ffa72659`     | `#a0640059`     |
| border-strong   | `#3a3a40`       | `#c4c9d2`       |

#### `kraft`

True brown shipping-carton paper.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#1a1410` | `#d8c7a3` |
| bg-panel        | `#241c15` | `#e6d6b3` |
| bg-elevated     | `#2e251c` | `#f0e2c2` |
| bg-inset        | `#120e0a` | `#c8b58e` |
| fg-primary      | `#ecddc4` | `#1f1208` |
| fg-secondary    | `#bda884` | `#4a3520` |
| fg-muted        | `#9a8765` | `#6a523a` |
| fg-faint        | `#6e5d44` | `#8c7456` |
| accent-amber    | `#f4a437` | `#7a3f00` |
| accent-ts       | `#7ab5ff` | `#1a3f8a` |
| accent-go       | `#4dc7e6` | `#005066` |
| border-default  | `#f4a43759` | `#7a3f0066` |
| border-strong   | `#5a4a36` | `#9a7c52` |

#### `manila`

Folder yellow + ink-blue accent (yes, blue lives in the
`--color-accent-amber` slot — the token is role-named, not
hue-named).

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#15130c` | `#ecd9a8` |
| bg-panel        | `#1f1c12` | `#f4e4ba` |
| bg-elevated     | `#2a2618` | `#f9edca` |
| bg-inset        | `#0e0c07` | `#dcc78c` |
| fg-primary      | `#f0e6c8` | `#1a1408` |
| fg-secondary    | `#b8a982` | `#3e3220` |
| fg-muted        | `#8f8262` | `#5f5238` |
| fg-faint        | `#5e553e` | `#8a7d5a` |
| accent-amber    | `#5fa8ff` | `#0f3d8c` |
| accent-ts       | `#4a9eff` | `#1a3f8a` |
| accent-go       | `#00add8` | `#005066` |
| border-default  | `#5fa8ff59` | `#0f3d8c66` |
| border-strong   | `#4a4332` | `#9a8b62` |

#### `newsprint`

Off-white pulp + scratchy black ink + headline-red accent.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#161616` | `#e8e3d6` |
| bg-panel        | `#1e1d1b` | `#efebe0` |
| bg-elevated     | `#282724` | `#f5f1e7` |
| bg-inset        | `#101010` | `#d8d2c2` |
| fg-primary      | `#ebe6dc` | `#0c0a06` |
| fg-secondary    | `#b0a99c` | `#33302a` |
| fg-muted        | `#8a8478` | `#56524a` |
| fg-faint        | `#5f5a50` | `#82796c` |
| accent-amber    | `#e85a3c` | `#9a2410` |
| accent-ts       | `#6fa8e6` | `#1c3f7a` |
| accent-go       | `#3fb0c4` | `#00566e` |
| border-default  | `#e85a3c59` | `#9a241066` |
| border-strong   | `#3e3c38` | `#a89e8a` |

#### `calfskin`

Pale calfskin + sepia ink (was "Vellum" in cardboard's brief;
renamed to disambiguate from textbook's Vellum).

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#191510` | `#f4ecd8` |
| bg-panel        | `#221d16` | `#faf3e1` |
| bg-elevated     | `#2c2519` | `#fdf8ec` |
| bg-inset        | `#120f0a` | `#e6dcc2` |
| fg-primary      | `#ede2c8` | `#1a1408` |
| fg-secondary    | `#b8a684` | `#46381f` |
| fg-muted        | `#8f7f5e` | `#6a5837` |
| fg-faint        | `#5f543e` | `#9a8a64` |
| accent-amber    | `#d68a3a` | `#7a4a08` |
| accent-ts       | `#7aa8e0` | `#1f3f7c` |
| accent-go       | `#4ab8c8` | `#005062` |
| border-default  | `#d68a3a4d` | `#7a4a0859` |
| border-strong   | `#4e4434` | `#a89464` |

### TEXTBOOK palettes

#### `parchment-ink` (textbook default)

Current shipped textbook: parchment-on-light, aged-paper-on-dark.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#1a1612` | `#faf6ef` |
| bg-panel        | `#1f1a14` | `#fbf8f3` |
| bg-elevated     | `#272015` | `#f4eee2` |
| bg-inset        | `#120e0a` | `#f0e9d8` |
| fg-primary      | `#ede0c8` | `#1a1a1a` |
| fg-secondary    | `#bfb29a` | `#3d3a32` |
| fg-muted        | `#8e826b` | `#6a6555` |
| fg-faint        | `#5d5443` | `#9a9180` |
| accent-amber    | `#d89640` | `#b06e1a` |
| accent-ts       | `#7eb6ff` | `#2a6fbf` |
| accent-go       | `#4dcfee` | `#007a99` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#3a3225` | `#d8cfb8` |

#### `vellum`

Warm old-paper + brown ink.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#1c1610` | `#f3ead7` |
| bg-panel        | `#221b13` | `#f7f0df` |
| bg-elevated     | `#2c2317` | `#ebe0c6` |
| bg-inset        | `#140f08` | `#e6daba` |
| fg-primary      | `#e6d4b5` | `#2a1d10` |
| fg-secondary    | `#b59c78` | `#4a3826` |
| fg-muted        | `#897355` | `#74604a` |
| fg-faint        | `#5a4a35` | `#9c886e` |
| accent-amber    | `#cf8a47` | `#8a4a14` |
| accent-ts       | `#8fb0d8` | `#2b5d8f` |
| accent-go       | `#62b8b0` | `#1f6e6e` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#3d2f1f` | `#c9b893` |

#### `pelican`

Penguin paperback — cream + near-true-black + spine-orange.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#101010` | `#f5ecd2` |
| bg-panel        | `#161616` | `#f8f1de` |
| bg-elevated     | `#1f1f1f` | `#efe5c5` |
| bg-inset        | `#0a0a0a` | `#ebe0b8` |
| fg-primary      | `#f1ebd9` | `#0a0a0a` |
| fg-secondary    | `#bdb8a8` | `#2d2d2c` |
| fg-muted        | `#8e8a7d` | `#5d5b54` |
| fg-faint        | `#5e5b52` | `#8a8779` |
| accent-amber    | `#e87b3e` | `#b8421b` |
| accent-ts       | `#7eb6ff` | `#1f5fa8` |
| accent-go       | `#4dcfee` | `#006680` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#2e2e2e` | `#cbbf9a` |

#### `sepia`

Brown-everything; faded photograph / foxed first edition.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#1d140c` | `#efe2cc` |
| bg-panel        | `#241910` | `#f3e8d6` |
| bg-elevated     | `#2e2114` | `#e6d6b9` |
| bg-inset        | `#150e07` | `#dfcca8` |
| fg-primary      | `#e8c9a1` | `#2d1a08` |
| fg-secondary    | `#b89a73` | `#503a22` |
| fg-muted        | `#8b7152` | `#7a6044` |
| fg-faint        | `#5d4a36` | `#a08768` |
| accent-amber    | `#c87a35` | `#7a3d0e` |
| accent-ts       | `#9fbdd6` | `#2e5680` |
| accent-go       | `#74b8b0` | `#1f6363` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#3e2e1d` | `#c3a878` |

#### `almanac`

Off-white + deep teal headings; field-guide register.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#0f1414` | `#f4f1e8` |
| bg-panel        | `#141a1a` | `#f8f5ec` |
| bg-elevated     | `#1c2424` | `#ece7d6` |
| bg-inset        | `#0a0e0e` | `#e6e0c8` |
| fg-primary      | `#e4ece8` | `#0e1f1e` |
| fg-secondary    | `#a8b8b3` | `#2e4543` |
| fg-muted        | `#7a8a85` | `#5a6f6c` |
| fg-faint        | `#52615d` | `#8a9a96` |
| accent-amber    | `#4ea69a` | `#0d5e55` |
| accent-ts       | `#7eb6ff` | `#1f5fa8` |
| accent-go       | `#d4a64a` | `#8a6010` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#2a3635` | `#c4c0a8` |

### GLASS palettes

Glass palettes uniquely add a body-radial-gradient definition. The
two stops use `color-mix(in oklab, <hue> <pct>%, transparent)`.

#### `aurora-amber` (glass default)

Amber top-right + TS-blue bottom-left bloom.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#0a0a0b` | `#fafafa` |
| bg-panel        | `#121214` | `#ffffff` |
| bg-elevated     | `#1a1a1d` | `#f4f4f6` |
| bg-inset        | `#08080a` | `#ededee` |
| fg-primary      | `#e8e8e8` | `#18181b` |
| fg-secondary    | `#a8a8ad` | `#52525b` |
| fg-muted        | `#8a8a8f` | `#71717a` |
| fg-faint        | `#6b6b70` | `#a1a1aa` |
| accent-amber    | `#ffa726` | `#b06e1a` |
| accent-ts       | `#4a9eff` | `#2563eb` |
| accent-go       | `#00add8` | `#0891b2` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#3a3a40` | `#d4d4d8` |

Body gradient (dark): `radial(at 80% -10%, amber 18%) + radial(at
0% 110%, ts 12%)`. Light: `(amber 22%, ts 14%)`.

#### `glacier-blue`

Arctic chrome — cool cyan-to-ice bloom.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#07101a` | `#f0f7fc` |
| bg-panel        | `#0e1a28` | `#ffffff` |
| bg-elevated     | `#152538` | `#e6f0f8` |
| bg-inset        | `#050c14` | `#dce8f1` |
| fg-primary      | `#e6f1ff` | `#0c1929` |
| fg-secondary    | `#a8c2dc` | `#475569` |
| fg-muted        | `#7d97b3` | `#64748b` |
| fg-faint        | `#56708a` | `#94a3b8` |
| accent-amber    | `#7dd3fc` | `#0369a1` |
| accent-ts       | `#60a5fa` | `#1d4ed8` |
| accent-go       | `#22d3ee` | `#0e7490` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#2a3d52` | `#b8cee0` |

Body gradient (dark): `(ice 20%, indigo 14%)`. Light: `(sky 24%,
indigo 16%)`.

#### `lavender-mist`

Synthwave / twilight-lounge. Lilac + rose.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#100a18` | `#faf7ff` |
| bg-panel        | `#1a1326` | `#ffffff` |
| bg-elevated     | `#241a33` | `#f3eeff` |
| bg-inset        | `#0c0712` | `#ebe4fa` |
| fg-primary      | `#f0e7ff` | `#1e1530` |
| fg-secondary    | `#c4b5dc` | `#5b4b78` |
| fg-muted        | `#9b8ab8` | `#78678f` |
| fg-faint        | `#6f5e8a` | `#a89cbf` |
| accent-amber    | `#c4b5fd` | `#7c3aed` |
| accent-ts       | `#a78bfa` | `#6d28d9` |
| accent-go       | `#f472b6` | `#be185d` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#3a2b50` | `#d4c7ed` |

Body gradient (dark): `(violet 22%, pink 14%)`. Light: `(lilac 30%,
rose 24%)`.

#### `monochrome`

Clinical, accent-free. Glass effect carries the page.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#0c0c0e` | `#f5f5f7` |
| bg-panel        | `#16161a` | `#ffffff` |
| bg-elevated     | `#1f1f24` | `#ededf0` |
| bg-inset        | `#08080a` | `#e4e4e7` |
| fg-primary      | `#f5f5f7` | `#09090b` |
| fg-secondary    | `#b4b4b8` | `#3f3f46` |
| fg-muted        | `#8a8a8f` | `#71717a` |
| fg-faint        | `#5a5a5f` | `#a1a1aa` |
| accent-amber    | `#ffffff` | `#000000` |
| accent-ts       | `#d4d4d8` | `#18181b` |
| accent-go       | `#a1a1aa` | `#52525b` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#3a3a40` | `#c4c4c8` |

Body gradient (dark): `(white 10%, white 6%)`. Light: `(black 6%,
black 4%)`. Effectively luminance-only.

### ISLANDS palettes

Islands need page-vs-panel luminance delta ≥ 8% for the float to
read. All five palettes meet this.

#### `desk-felt` (islands default)

Felt grey desk / white islands.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#050507` | `#e8e8ea` |
| bg-panel        | `#1a1a1d` | `#ffffff` |
| bg-elevated     | `#232328` | `#f6f6f8` |
| bg-inset        | `#020203` | `#dcdce0` |
| fg-primary      | `#e8e8e8` | `#18181b` |
| fg-secondary    | `#a8a8ad` | `#3f3f46` |
| fg-muted        | `#8a8a8f` | `#52525b` |
| fg-faint        | `#6b6b70` | `#71717a` |
| accent-amber    | `#ffa726` | `#b06e1a` |
| accent-ts       | `#4a9eff` | `#1d6fd9` |
| accent-go       | `#00add8` | `#00788f` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#3a3a40` | `#d4d4d8` |

#### `app-store`

Apple System — TS-blue as the primary CTA (rotates from amber).

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#000003` | `#f2f2f5` |
| bg-panel        | `#1c1c1f` | `#ffffff` |
| bg-elevated     | `#28282c` | `#fbfbfd` |
| bg-inset        | `#08080a` | `#e5e5ea` |
| fg-primary      | `#f5f5f7` | `#1d1d1f` |
| fg-secondary    | `#a1a1a6` | `#3a3a3c` |
| fg-muted        | `#86868b` | `#515154` |
| fg-faint        | `#6c6c70` | `#6e6e73` |
| accent-amber    | `#0a84ff` | `#0066cc` |
| accent-ts       | `#0a84ff` | `#0066cc` |
| accent-go       | `#64d2ff` | `#006a85` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#38383c` | `#d2d2d7` |

#### `dark-wood`

Walnut desk + parchment islands.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#1a0f08` | `#c9a880` |
| bg-panel        | `#2a1d12` | `#fbf5e6` |
| bg-elevated     | `#362414` | `#fdf9ef` |
| bg-inset        | `#120902` | `#b89870` |
| fg-primary      | `#f0e4d0` | `#2a1f10` |
| fg-secondary    | `#c9b896` | `#4a3820` |
| fg-muted        | `#a89674` | `#5d4628` |
| fg-faint        | `#806f55` | `#7a5d36` |
| accent-amber    | `#e8a23b` | `#8a4d0a` |
| accent-ts       | `#6ab0ff` | `#1f5db8` |
| accent-go       | `#5fc8e0` | `#006478` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#4a3422` | `#d9c39a` |

#### `studio-grey`

Cool neutral slate; Linear/Figma vibe. Indigo CTA.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#0c0d10` | `#dcdee3` |
| bg-panel        | `#1e2025` | `#fafbfc` |
| bg-elevated     | `#292c33` | `#f1f2f5` |
| bg-inset        | `#06070a` | `#c8cbd2` |
| fg-primary      | `#e6e8ec` | `#15171c` |
| fg-secondary    | `#a4a8b0` | `#3a3d45` |
| fg-muted        | `#868a93` | `#4f535c` |
| fg-faint        | `#62656d` | `#6f7480` |
| accent-amber    | `#7c8cff` | `#4f46e5` |
| accent-ts       | `#7c8cff` | `#4f46e5` |
| accent-go       | `#2dd4bf` | `#0d7d72` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#383c44` | `#c4c7cf` |

#### `sunlit-pine`

Warm cream desk + pale pine islands; morning cabin.

| token           | dark      | light     |
|-----------------|-----------|-----------|
| bg-base         | `#14100a` | `#efe3cc` |
| bg-panel        | `#2d2418` | `#fdf9f0` |
| bg-elevated     | `#3a2f1f` | `#faf2df` |
| bg-inset        | `#0c0805` | `#e0d2b6` |
| fg-primary      | `#f4ead4` | `#1f1a10` |
| fg-secondary    | `#cdbb96` | `#433a26` |
| fg-muted        | `#ab9974` | `#5a4d34` |
| fg-faint        | `#7f6f52` | `#7a6948` |
| accent-amber    | `#f0a838` | `#9e5a0a` |
| accent-ts       | `#6cb4ff` | `#2563b0` |
| accent-go       | `#4ec9b0` | `#006a72` |
| border-default  | `transparent` | `transparent` |
| border-strong   | `#4a3e28` | `#d6c8aa` |

## Implementation plan

1. **theme.ts** — add a `PALETTES` const + `defineAppearanceAxis<
   PaletteId>` factory call (reuses the FW-1 axis factory). New
   exports: `currentPalette`, `setPalette`, `PALETTE_STORAGE_KEY`.
   Plus a `STYLE_DEFAULT_PALETTE` map and a resolver function.

2. **global.css** — strip all `--color-*` overrides out of the
   five `:root[data-style="..."]` blocks (style blocks keep
   typography/border/radius/measure/shadow). Add 22
   `:root[data-palette="..."]` blocks, each with dark + light
   variants via `[data-theme="dark|light|system"]` nesting.
   Glass-specific body radial gradient becomes
   `:root[data-style="glass"][data-palette="..."] body`.

3. **BaseLayout.astro** — bootstrap script grows a 5th probe:
   `palette = pin || STYLE_DEFAULT_PALETTE[style]`. Sets
   `data-palette` attribute on `<html>` pre-paint. The bootstrap
   enum-coverage test (`BaseLayout.bootstrap.test.ts`) gets a 5th
   `it.each(PALETTES)` block.

4. **AppearancePicker** — adds a 5th radio group "Palette",
   grouped by home-style with a "Default" option at the top.
   Wired through `useToast` like the other axes (announcement +
   undo). Group filter respects the current style but allows
   cross-style selection via a "Show all palettes" toggle.

5. **a11y harness** — extend the style-axis matrix to a full
   `style × palette × theme` cube — 5 × 22 × 2 = 220 axe runs.
   Probably reduce to a sampled subset (e.g. 5 palettes × 2
   themes = 10) to keep test time reasonable.

6. **Settings preview** — surface 4-6 colour-sensitive components
   (Panel, Badge, Button, CodeBlock, Toast) so a palette flip is
   instantly visible.

7. **design-docs/21** — update Decision #2 ("palette as a first-
   class axis — yes, as a follow-up") to point at this doc.

8. **design-docs/13** (themes) — note that palette is now its own
   axis; the dark/light selector still chooses between palette
   variants but doesn't carry colour identity any more.

9. **Privacy page** — `typeover:palette` joins the
   localStorage-keys list.

## Open questions

1. **Cross-style application via the UI** — should we expose the
   "Show all palettes" toggle in v0, or default to per-style-home
   only and add the toggle if needed? Default: per-style for v0.
2. **`monochrome` under non-glass styles** — its body gradient is
   nearly invisible; under terminal it's a no-op. Fine. Under
   cardboard, the stipple grain still reads — works.
3. **`manila` + `studio-grey`** route the CTA through a non-amber
   colour (blue / indigo). The token is still `--color-accent-
   amber` (role-named). Worth renaming the token to `--color-
   accent-primary` in a follow-up? Or live with the name drift?
4. **High-contrast palettes** (`hc-dark`, `hc-light` from
   design-docs/13) — these belong here too. Add them as 23rd /
   24th palettes (with no style "home"), or defer to a separate
   a11y pass? Recommend defer.
5. **Custom user-defined palette** (the user's "or pick from a
   predefined set... or custom choices" phrasing). A bring-your-
   own-tokens UI is a much bigger surface. Defer to a follow-up;
   v0 ships the 22 named palettes only.

## Source material

Five subagent transcripts (one per style) under
`/private/tmp/.../tasks/`. Each proposed 4-5 palettes with full
token specs + WCAG checks. This RFC is the consolidation.
