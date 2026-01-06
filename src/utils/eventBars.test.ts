import { describe, expect, it } from 'vitest'
import type { YearbirdEvent } from '../types/calendar'
import { calculateEventBars } from './eventBars'

const buildEvent = (overrides: Partial<YearbirdEvent> = {}): YearbirdEvent => ({
  id: 'event-1',
  title: 'Trip',
  startDate: '2025-01-10',
  endDate: '2025-01-12',
  isAllDay: true,
  isMultiDay: true,
  durationDays: 3,
  googleLink: '',
  category: 'holidays',
  color: '#F59E0B',
  ...overrides,
})

describe('calculateEventBars', () => {
  it('splits bars across month boundaries', () => {
    const event = buildEvent({
      startDate: '2025-01-30',
      endDate: '2025-02-02',
      durationDays: 4,
    })

    const bars = calculateEventBars([event], 2025)

    expect(bars).toHaveLength(2)

    const january = bars.find((bar) => bar.month === 0)
    const february = bars.find((bar) => bar.month === 1)

    expect(january).toMatchObject({ startDay: 30, endDay: 31, row: 0 })
    expect(february).toMatchObject({ startDay: 1, endDay: 2, row: 0 })
  })

  it('assigns stacking rows for overlapping events', () => {
    const first = buildEvent({
      id: 'event-a',
      startDate: '2025-03-10',
      endDate: '2025-03-12',
      durationDays: 3,
    })
    const second = buildEvent({
      id: 'event-b',
      startDate: '2025-03-11',
      endDate: '2025-03-14',
      durationDays: 4,
    })

    const bars = calculateEventBars([first, second], 2025).filter((bar) => bar.month === 2)
    const barA = bars.find((bar) => bar.event.id === 'event-a')
    const barB = bars.find((bar) => bar.event.id === 'event-b')

    expect(barA?.row).toBe(0)
    expect(barB?.row).toBe(1)
  })

  it('reuses rows for non-overlapping events', () => {
    const first = buildEvent({
      id: 'event-a',
      startDate: '2025-04-01',
      endDate: '2025-04-03',
      durationDays: 3,
    })
    const second = buildEvent({
      id: 'event-b',
      startDate: '2025-04-04',
      endDate: '2025-04-05',
      durationDays: 2,
    })

    const bars = calculateEventBars([first, second], 2025).filter((bar) => bar.month === 3)
    const barA = bars.find((bar) => bar.event.id === 'event-a')
    const barB = bars.find((bar) => bar.event.id === 'event-b')

    expect(barA?.row).toBe(0)
    expect(barB?.row).toBe(0)
  })

  it('skips events outside the target year', () => {
    const event = buildEvent({
      startDate: '2024-12-01',
      endDate: '2024-12-05',
      durationDays: 5,
    })

    expect(calculateEventBars([event], 2025)).toHaveLength(0)
  })

  it('skips single-day events', () => {
    const event = buildEvent({
      startDate: '2025-05-01',
      endDate: '2025-05-01',
      durationDays: 1,
      isMultiDay: false,
    })

    expect(calculateEventBars([event], 2025)).toHaveLength(0)
  })
})
