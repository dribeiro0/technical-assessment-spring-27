import { describe, expect, it } from 'vitest'
import { IN_SCOPE_ROUTE_IDS, branchForRoute, isLineId, lineForRoute } from './lines'

describe('lines', () => {
  it('maps every Green branch to the Green line', () => {
    for (const route of ['Green-B', 'Green-C', 'Green-D', 'Green-E']) {
      expect(lineForRoute(route)).toBe('Green')
    }
  })

  it('treats Mattapan and other routes as out of scope', () => {
    expect(lineForRoute('Mattapan')).toBeNull()
    expect(lineForRoute('741')).toBeNull()
    expect(lineForRoute(null)).toBeNull()
  })

  it('requests exactly the seven in-scope routes', () => {
    expect(IN_SCOPE_ROUTE_IDS).toEqual([
      'Red',
      'Orange',
      'Blue',
      'Green-B',
      'Green-C',
      'Green-D',
      'Green-E',
    ])
  })

  it('extracts Green branch letters only', () => {
    expect(branchForRoute('Green-C')).toBe('C')
    expect(branchForRoute('Red')).toBeNull()
  })

  it('validates line IDs from the URL', () => {
    expect(isLineId('Red')).toBe(true)
    expect(isLineId('Purple')).toBe(false)
    expect(isLineId(null)).toBe(false)
  })
})
