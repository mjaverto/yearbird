import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCategories } from '../../services/categories'
import { getAllCategories } from '../../utils/categorize'
import { EventTooltip } from './EventTooltip'

const baseEvent = {
  id: 'event:1',
  title: 'Team Offsite',
  startDate: '2025-04-10',
  endDate: '2025-04-12',
  isAllDay: true,
  isMultiDay: true,
  durationDays: 3,
  googleLink: 'https://calendar.google.com',
  calendarId: 'primary',
  calendarName: 'Team Calendar',
  calendarColor: '#38BDF8',
  category: 'work',
  color: '#8B5CF6',
} as const

class ResizeObserverMock {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe() {
    this.callback([], this)
    this.callback([
      {
        contentRect: { width: 200, height: 120 } as DOMRectReadOnly,
      } as ResizeObserverEntry,
    ], this)
  }

  disconnect() {}
}

class ResizeObserverNoopMock {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Helper to get categories initialized with defaults
const getCategoriesWithDefaults = () => getAllCategories(getCategories())

describe('EventTooltip', () => {
  it('renders event details and link', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 240, configurable: true })

    render(
      <EventTooltip
        event={{
          ...baseEvent,
          location: 'Boulder, CO',
        }}
        position={{ x: 1000, y: 1000 }}
        categories={getCategoriesWithDefaults()}
      />
    )

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByRole('tooltip', { name: /team offsite details/i })).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Team Offsite')).toBeInTheDocument()
    expect(screen.getByText('Team Calendar')).toBeInTheDocument()
    expect(screen.getByText('Apr 10 - Apr 12 (3 days)')).toBeInTheDocument()
    expect(screen.getByText('Boulder, CO')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Google Calendar' })).toHaveAttribute(
      'href',
      'https://calendar.google.com'
    )
  })

  it('handles missing optional fields and invalid dates', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 240, configurable: true })

    render(
      <EventTooltip
        event={{
          ...baseEvent,
          id: 'event-2',
          startDate: 'invalid',
          endDate: 'invalid',
          durationDays: 1,
          googleLink: '',
        }}
        position={{ x: 16, y: 16 }}
        categories={getCategoriesWithDefaults()}
      />
    )

    expect(screen.getByText('Date unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in Google Calendar' })).toBeNull()
  })

  it('falls back to the raw position when size is unknown', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)
    Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 240, configurable: true })

    render(
      <EventTooltip
        event={baseEvent}
        position={{ x: 20, y: 30 }}
        categories={getCategoriesWithDefaults()}
      />
    )

    const tooltip = screen.getByRole('tooltip', { name: /team offsite details/i })
    expect(tooltip.style.left).toBe('32px')
    expect(tooltip.style.top).toBe('42px')
  })

  it('fires hide action when requested', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)
    const onHideEvent = vi.fn()

    render(
      <EventTooltip
        event={baseEvent}
        position={{ x: 20, y: 30 }}
        categories={getCategoriesWithDefaults()}
        onHideEvent={onHideEvent}
      />
    )

    screen.getByRole('button', { name: /hide events like team offsite/i }).click()
    expect(onHideEvent).toHaveBeenCalledWith('Team Offsite')
  })
})
