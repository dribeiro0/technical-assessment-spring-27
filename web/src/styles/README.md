# styles/

`index.css` holds the Tailwind v4 setup, the design tokens ("Paper Panels", DEC-030), and the styles for the map, markers, popups and the small animations.

**Tokens** (each becomes a Tailwind class, e.g. `bg-chrome`, `text-fg-muted`)

| Token                                   | Value                                      | Used for                                                   |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `chrome` / `chrome-fg` / `chrome-muted` | `#1D2B44` / `#FFFDF8` / `#B9C2D3`          | The navy frame (ribbon, tab bar, status bar) and its text  |
| `main`, `side`                          | `#FFFDF8`                                  | Paper-white panels                                         |
| `card` / `chip`                         | `#FFFFFF` / `#F3ECDF`                      | Cards and popups / chips and selected rows                 |
| `map`                                   | `#EFE6D2`                                  | Cream map background                                       |
| `border` / `control`                    | `#E6DECF` / `#C6B9A1`                      | Dividers / control outlines                                |
| `fg` / `fg-secondary` / `fg-muted`      | `#1D2B44` / `#3D4A60` / `#6A6356`          | Text on panels                                             |
| `brand`                                 | `#D2643C`                                  | Logo, active-tab bar, focus ring                           |
| `accent`                                | `#A84B2A`                                  | Emphasised text: next stop, countdown                      |
| `select`, `warn`, `danger`, `live`      | `#1D2B44`, `#9A520A`, `#B42318`, `#3FCB86` | Selection rings, minor issues, major/offline, the live dot |

**Line colours** (the source of truth is `domain/lines.ts`)

| Line   | Hex       | Note                                                              |
| ------ | --------- | ----------------------------------------------------------------- |
| Red    | `#DA291C` | Official MBTA                                                     |
| Orange | `#BF6900` | Official `#ED8B00` deepened so markers reach 3:1 on the cream map |
| Blue   | `#003DA5` | Official MBTA                                                     |
| Green  | `#00843D` | Official MBTA                                                     |

**Fonts:** IBM Plex Sans for the interface, JetBrains Mono for times, counts and IDs.

**Rules:** usable from 375 px up and at 200% text, visible focus everywhere, every text pair at least 4.5:1, and the reduced-motion setting is respected.
