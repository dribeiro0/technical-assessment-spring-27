# features/map/

The Live Map, built with React Leaflet over Esri's light gray basemap, faded onto a cream background. It needs no API key; CARTO's tiles, the first choice, began requiring one (DEC-039). The map credits stay visible.

| File                | What it does                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LiveMapView.tsx`   | The interactive map centred on Boston (R4). Applies the line filter, zooms to fit a line when it is chosen, shows destination tags from zoom 14, deselects on empty-map clicks, and shows the loading, error, stale and empty-filter notices. No zoom animation under reduced motion. |
| `VehicleMarker.tsx` | One marker per train and its popup with line, direction, status and next stop (R5). Click or Enter on a focused marker selects the train; selecting from the list opens the popup. Keeps the marker's accessible title current.                                                       |
| `glide.ts`          | Smooth movement: each marker glides to its new position over one polling interval (15 s), so trains keep moving between updates (DEC-034). Big jumps snap instead; reduced motion turns it off.                                                                                       |
| `vehicleIcon.ts`    | The marker drawing: a line-coloured circle with an arrow rotated to the bearing when moving, a square when stopped, and the destination tag ("Alewife", "C · Cleveland Circle"). Feed text is HTML-escaped.                                                                           |
| `RouteLayer.tsx`    | Line paths and hollow station dots beneath the trains, drawn on a canvas. Transfer stations are navy; other lines fade when a filter is on. With a commute open, its stretch is drawn bold and everything else fades (DEC-049).                                                       |

**Marker states (never colour alone)**

- Aging (2-10 min old): faded, with a dashed outline.
- Selected: a double navy ring, which stays distinct from every line colour.
