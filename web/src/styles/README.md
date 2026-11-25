# styles/

`index.css` holds the Tailwind v4 setup, the V5 design tokens, and the styles for the map, markers and popups.

**Tokens** (each becomes a Tailwind class, e.g. `bg-chrome`, `text-fg-muted`)

| Token | Value | Used for |
| --- | --- | --- |
| `main` | `#1E1E1E` | Main background |
| `chrome` | `#161616` | Ribbon, tabs, status bar |
| `side` | `#1A1A1A` | Sidebars |
| `map` | `#141414` | Map background |
| `border` / `control` | `#333` / `#444` | Dividers / control outlines |
| `fg` / `fg-secondary` / `fg-muted` | `#DADADA` / `#B5B5B5` / `#8A8A8A` | Text |
| `accent` | `#E8A33D` | Selection and focus |

**Line colours** (the source of truth is `domain/lines.ts`)

| Line | Hex | Note |
| --- | --- | --- |
| Red | `#DA291C` | Official MBTA |
| Orange | `#ED8B00` | Official MBTA; dark glyphs |
| Blue | `#5B8CFF` | Brightened from `#003DA5`, which is about 2:1 on the dark map |
| Green | `#12A150` | Brightened from `#00843D` to match |

**Fonts** (placeholders): IBM Plex Sans for the interface, JetBrains Mono for IDs and times.

**Rules:** usable from 375 px up, visible focus everywhere, and the reduced-motion setting is respected.
