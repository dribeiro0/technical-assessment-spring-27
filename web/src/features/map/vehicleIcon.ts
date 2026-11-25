import L from 'leaflet'
import { getLine } from '../../domain/lines'
import type { Vehicle } from '../../domain/vehicle'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Feed text goes into HTML here, so it is escaped first (09 security). */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

export type Glyph = 'arrow' | 'square' | 'dot'

/** Stopped trains show a square; moving trains an arrow (or a dot when the bearing is unknown). */
export function glyphFor(vehicle: Pick<Vehicle, 'status' | 'bearing'>): Glyph {
  if (vehicle.status === 'stopped') return 'square'
  return vehicle.bearing === null ? 'dot' : 'arrow'
}

interface IconOptions {
  selected: boolean
  aging: boolean
}

/** Builds the Leaflet marker for one vehicle: line-coloured circle, glyph and car-number tag. */
export function vehicleIcon(vehicle: Vehicle, { selected, aging }: IconOptions): L.DivIcon {
  const line = getLine(vehicle.line)
  const glyph = glyphFor(vehicle)
  const rotation =
    glyph === 'arrow' ? ` style="transform: rotate(${Math.round(vehicle.bearing ?? 0)}deg)"` : ''
  const classes = ['vm', aging && 'vm--aging', selected && 'vm--selected'].filter(Boolean).join(' ')

  return L.divIcon({
    className: 'vehicle-icon',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
    html:
      `<div class="${classes}" style="--c: ${line.color}; --g: ${line.glyphColor}">` +
      `<div class="vm__dot"><span class="vm__glyph vm__glyph--${glyph}"${rotation}></span></div>` +
      `<span class="vm__tag">${escapeHtml(vehicle.label)}</span>` +
      `</div>`,
  })
}
