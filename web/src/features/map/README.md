# features/map/

The Live Map, built with React Leaflet over CARTO tiles. The tile credit stays visible.

**Will contain**
- `LiveMapView.tsx`: the interactive map, centred on Greater Boston, with pan and zoom (R4, Sprint 1).
- `VehicleMarker.tsx`: one marker per shown vehicle, in its line colour and pointed by bearing when known. Vehicles not updated in 2-10 min are drawn faded (Sprint 1).
- `VehiclePopup.tsx`: opens on click or keyboard. Shows route, direction ("toward Alewife"), status and stop label, plus the update age (R5, Sprint 2).
- `RouteLines.tsx`: the actual line paths from `/shapes`, drawn beneath the vehicles (Sprint 3, DEC-027).

**Rules**
- Marker count equals the vehicles with usable coordinates after the line filter (R4 check).
- A refresh moves markers in place. It doesn't reset the map view or close an open popup.
- Honour the reduced-motion setting: no animated marker movement when it is on.
