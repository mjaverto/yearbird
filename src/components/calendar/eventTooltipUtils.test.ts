import { describe, expect, it } from 'vitest'
import { getEventTooltipId } from './eventTooltipUtils'

describe('getEventTooltipId', () => {
  it('returns a stable id for valid values', () => {
    expect(getEventTooltipId('event-1')).toBe('event-tooltip-event-1')
    expect(getEventTooltipId('Event:Alpha')).toBe('event-tooltip-EventAlpha')
  })

  it('falls back to prefix when id is empty or invalid', () => {
    expect(getEventTooltipId('')).toBe('event-tooltip')
    expect(getEventTooltipId('$$$')).toBe('event-tooltip')
  })
})
