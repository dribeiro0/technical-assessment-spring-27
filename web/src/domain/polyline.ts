/**
 * Decodes an encoded polyline (the Google format the MBTA uses for /shapes)
 * into [latitude, longitude] pairs.
 *
 * Each coordinate is stored as the difference from the previous one, packed into
 * 5-bit chunks with an offset of 63 to make printable characters.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lon = 0

  const readValue = (): number | null => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      if (index >= encoded.length) return null
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    // The lowest bit carries the sign.
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    const dLat = readValue()
    const dLon = readValue()
    if (dLat === null || dLon === null) break
    lat += dLat
    lon += dLon
    points.push([lat / 1e5, lon / 1e5])
  }
  return points
}
