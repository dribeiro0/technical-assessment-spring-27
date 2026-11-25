# features/map/

The Live Map, built with React Leaflet over Esri's dark gray basemap. It needs no API key; CARTO's tiles, the first choice, began requiring one. The map credits stay visible.

| File | What it does |
| --- | --- |
| `LiveMapView.tsx` | The interactive map centred on Boston (R4). Applies the line filter, shows car-number tags from zoom 14, deselects on empty-map clicks, and shows the loading, error, stale and empty-filter notices. |
| `VehicleMarker.tsx` | One marker per vehicle and its popup with line, direction, status and next stop (R5). Selecting from the tree opens the popup. Enter on a focused marker works like a click. |
| `vehicleIcon.ts` | The marker drawing: a line-coloured circle with an arrow rotated to the bearing when moving, a square when stopped, and the car-number tag. Feed text is HTML-escaped. |
| `RouteLayer.tsx` | Line paths and hollow station dots beneath the vehicles. Transfer stations are drawn light gray; other lines fade when a filter is on. |

**Marker states (never colour alone)**

- Aging (2-10 min): faded, with a dashed outline.
- Selected: a double amber ring and an amber tag border.
