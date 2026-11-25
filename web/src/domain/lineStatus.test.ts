import { describe, expect, it } from 'vitest'
import type { AlertsDocument } from '../api/mbtaTypes'
import { effectText, lineStatuses, relevantAlerts } from './lineStatus'
import { decodePolyline } from './polyline'

function alert(id: string, severity: number, effect: string, routes: string[]) {
  return {
    type: 'alert',
    id,
    attributes: {
      header: `${effect} on ${routes.join('/')}`,
      effect,
      severity,
      informed_entity: routes.map((route) => ({ route })),
    },
  }
}

// Modelled on the alerts that were live on November 24, 2026.
const doc: AlertsDocument = {
  data: [
    alert('parking', 1, 'NOTICE', ['Red']),
    alert('summit', 7, 'STATION_CLOSURE', ['Green-C']),
    alert('shuttle', 7, 'SHUTTLE', ['Orange']),
    alert('mattapan', 9, 'SUSPENSION', ['Mattapan']),
  ],
}

describe('line status from alerts', () => {
  const alerts = relevantAlerts(doc)

  it('ignores low-severity notices and out-of-scope routes', () => {
    expect(alerts.map((a) => a.id)).toEqual(['shuttle', 'summit'])
  })

  it('rates each line by its worst alert', () => {
    const status = lineStatuses(alerts)
    expect(status.Red.level).toBe('good')
    expect(status.Orange.level).toBe('major')
    expect(status.Green.level).toBe('minor')
    expect(status.Blue.alerts).toEqual([])
  })

  it('formats effect names', () => {
    expect(effectText('STATION_CLOSURE')).toBe('Station closure')
  })
})

describe('decodePolyline', () => {
  it('decodes the reference example', () => {
    // Example from the polyline format documentation.
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })

  it('returns nothing for an empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })
})
