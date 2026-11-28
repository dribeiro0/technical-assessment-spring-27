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
  const alerts = relevantAlerts(doc, Date.parse('2026-11-28T12:00:00-05:00'))

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

describe('alert timing, ranking and places (Sprint 5)', () => {
  const NOW = Date.parse('2026-11-28T12:00:00-05:00')
  // Shaped like the real alerts of November 28, 2026.
  const hawes = {
    type: 'alert',
    id: 'hawes',
    attributes: {
      header: 'Green Line C Branch: Inbound trains are not stopping at Hawes St',
      description: 'Use Kent St or St. Marys St.',
      effect: 'STATION_CLOSURE',
      severity: 7,
      active_period: [{ start: '2026-11-16T03:00:00-05:00', end: '2026-12-11T03:00:00-05:00' }],
      informed_entity: [
        { route: 'Green-C', stop: '70214', direction_id: 1, activities: ['BOARD', 'EXIT'] },
        { route: 'Green-C', stop: 'place-hwsst', direction_id: 1, activities: ['BOARD', 'EXIT'] },
      ],
    },
  }
  const blueShutdown = {
    type: 'alert',
    id: 'blue',
    attributes: {
      header: 'Blue Line: Dec 12–20, No trains between Orient Heights & Bowdoin',
      effect: 'SUSPENSION',
      severity: 7,
      active_period: [{ start: '2026-12-12T03:00:00-05:00', end: '2026-12-21T03:00:00-05:00' }],
      informed_entity: [
        {
          route: 'Blue',
          stop: 'place-aport',
          direction_id: 0,
          activities: ['BOARD', 'EXIT', 'RIDE'],
        },
        {
          route: 'Blue',
          stop: 'place-aport',
          direction_id: 1,
          activities: ['BOARD', 'EXIT', 'RIDE'],
        },
      ],
    },
  }
  const ended = {
    type: 'alert',
    id: 'ended',
    attributes: {
      header: 'Old',
      effect: 'SUSPENSION',
      severity: 9,
      active_period: [{ start: '2026-11-01T03:00:00-05:00', end: '2026-11-02T03:00:00-05:00' }],
      informed_entity: [{ route: 'Red' }],
    },
  }
  const doc2 = { data: [blueShutdown, hawes, ended] } as AlertsDocument
  const alerts = relevantAlerts(doc2, NOW)

  it('classifies alerts as active or upcoming and drops ones that are over', () => {
    expect(alerts.map((a) => [a.id, a.timing])).toEqual([
      ['hawes', 'active'],
      ['blue', 'upcoming'],
    ])
    expect(alerts[1].start).toBe(Date.parse('2026-12-12T03:00:00-05:00'))
  })

  it('ranks anything in effect now above an upcoming shutdown, however severe', () => {
    expect(alerts[0].level).toBe('minor')
    expect(alerts[1].level).toBe('major')
  })

  it('does not let an upcoming alert change today’s line status', () => {
    const status = lineStatuses(alerts)
    expect(status.Blue.level).toBe('good')
    expect(status.Green.level).toBe('minor')
  })

  it('keeps stations (not platforms), directions and whether trains run', () => {
    expect(alerts[0].entities).toEqual([
      { routeId: 'Green-C', stationId: 'place-hwsst', directionId: 1, ride: false },
    ])
    expect(alerts[1].entities.every((e) => e.ride)).toBe(true)
    expect(alerts[1].entities.map((e) => e.directionId)).toEqual([0, 1])
    expect(alerts[0].description).toBe('Use Kent St or St. Marys St.')
  })

  it('treats an alert with no period as active and a route-only entity as the whole route', () => {
    const [a] = relevantAlerts(doc, NOW).filter((x) => x.id === 'shuttle')
    expect(a.timing).toBe('active')
    expect(a.entities[0].stationId).toBeNull()
  })
})
