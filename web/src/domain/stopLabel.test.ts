import { describe, expect, it } from 'vitest'
import { NEXT_STOP_UNAVAILABLE, directionText, stopLabel } from './stopLabel'

describe('stopLabel', () => {
  it('says "At" when the vehicle is stopped at a stop', () => {
    expect(stopLabel({ status: 'stopped', stopName: 'JFK/UMass' })).toBe('At JFK/UMass')
  })

  it('says "Approaching" when incoming or in transit', () => {
    expect(stopLabel({ status: 'incoming', stopName: 'Park Street' })).toBe(
      'Approaching Park Street',
    )
    expect(stopLabel({ status: 'in-transit', stopName: 'Kendall/MIT' })).toBe(
      'Approaching Kendall/MIT',
    )
  })

  it('never guesses when the stop or status is missing', () => {
    expect(stopLabel({ status: 'stopped', stopName: null })).toBe(NEXT_STOP_UNAVAILABLE)
    expect(stopLabel({ status: 'unknown', stopName: 'Park Street' })).toBe(NEXT_STOP_UNAVAILABLE)
  })

  it('describes direction from the headsign', () => {
    expect(directionText('Alewife')).toBe('toward Alewife')
    expect(directionText(null)).toBe('Direction unavailable')
  })
})
