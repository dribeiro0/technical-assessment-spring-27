import type L from 'leaflet'

// Smooth movement for vehicle markers.
//
// The MBTA reports each train's position every 10-20 s and the app polls every 15 s,
// so markers would otherwise jump and then sit still. Instead, each marker glides to
// its new position over roughly one polling interval, so trains are always moving.
// The trade-off: a marker can trail the latest report by up to one interval, which
// is about the same as the data's own age.
//
// One shared animation loop moves every gliding marker, capped at about 20 frames a
// second, which looks smooth for slow-moving trains and keeps the map responsive.

const FRAME_MS = 50

interface Glide {
  marker: L.Marker
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
  start: number
  duration: number
}

const glides = new Map<L.Marker, Glide>()
let frame = 0
let lastFrameAt = 0

function step(now: number) {
  if (now - lastFrameAt >= FRAME_MS) {
    lastFrameAt = now
    for (const g of glides.values()) {
      const t = Math.min(1, (now - g.start) / g.duration)
      g.marker.setLatLng([
        g.fromLat + (g.toLat - g.fromLat) * t,
        g.fromLng + (g.toLng - g.fromLng) * t,
      ])
      if (t >= 1) glides.delete(g.marker)
    }
  }
  frame = glides.size > 0 ? requestAnimationFrame(step) : 0
}

/** Starts (or redirects) a glide from the marker's current spot to `to`. */
export function glideTo(marker: L.Marker, to: [number, number], durationMs: number) {
  const from = marker.getLatLng()
  glides.set(marker, {
    marker,
    fromLat: from.lat,
    fromLng: from.lng,
    toLat: to[0],
    toLng: to[1],
    start: performance.now(),
    duration: durationMs,
  })
  if (!frame) frame = requestAnimationFrame(step)
}

/** Stops any glide on this marker, leaving it where it is. */
export function stopGlide(marker: L.Marker | null) {
  if (marker) glides.delete(marker)
}
