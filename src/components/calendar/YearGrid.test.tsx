import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MONTHS } from '../../utils/dateUtils'
import { getAllCategories } from '../../utils/categorize'
import type { YearbirdEvent } from '../../types/calendar'
import { YearGrid } from './YearGrid'

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

const createResizeObserverMock = (height: number, width = 620) =>
  class ResizeObserverMock {
    private callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe() {
      this.callback(
        [
          {
            contentRect: { height, width } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      )
    }

    disconnect() {}
  }

const ResizeObserverMeasuredMock = createResizeObserverMock(320)
const ResizeObserverZeroMock = createResizeObserverMock(0)

afterEach(() => {
  vi.unstubAllGlobals()
})

const buildEvent = (overrides: Partial<YearbirdEvent> = {}): YearbirdEvent => ({
  id: '1',
  title: 'Trip',
  startDate: '2025-02-10',
  endDate: '2025-02-10',
  isAllDay: true,
  isMultiDay: false,
  durationDays: 1,
  googleLink: '',
  category: 'holidays',
  color: '#F59E0B',
  ...overrides,
})

describe('YearGrid', () => {
  it('renders month labels and day headers', () => {
    render(
      <YearGrid
        year={2025}
        events={[]}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
      />
    )

    MONTHS.forEach((month) => {
      expect(screen.getByText(month)).toBeInTheDocument()
    })

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('renders invalid days as muted cells and highlights today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 1, 15))
    const today = new Date()

    const { container } = render(
      <YearGrid year={2025} events={[]} today={today} categories={getAllCategories()} />
    )

    expect(container.querySelectorAll('.bg-zinc-100')).toHaveLength(7)
    expect(container.querySelectorAll('.bg-zinc-50').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.ring-sky-500')).toHaveLength(1)
    expect(container.querySelectorAll('[aria-current="date"]')).toHaveLength(1)

    vi.useRealTimers()
  })

  it('dims past dates relative to today', () => {
    const today = new Date(2025, 1, 15)
    const { container } = render(
      <YearGrid year={2025} events={[]} today={today} categories={getAllCategories()} />
    )

    const pastCell = container.querySelector('[data-date="2025-02-10"]')
    const futureCell = container.querySelector('[data-date="2025-02-20"]')

    expect(pastCell).not.toBeNull()
    expect(futureCell).not.toBeNull()
    expect(pastCell).toHaveClass('opacity-60')
    expect(futureCell).not.toHaveClass('opacity-60')
  })

  it('renders event color indicators for single-day events only', () => {
    const events: YearbirdEvent[] = [
      buildEvent(),
      buildEvent({
        id: '2',
        title: 'Flight',
        startDate: '2025-03-01T23:00:00',
        endDate: '2025-03-02T01:00:00',
        isAllDay: false,
        isMultiDay: true,
        durationDays: 2,
        category: 'holidays',
        color: '#8B5CF6',
      }),
    ]

    const { container } = render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
      />
    )

    expect(container.querySelectorAll('span[data-color="#F59E0B"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('span[data-color="#8B5CF6"]').length).toBe(0)
  })

  it('skips invalid event ranges', () => {
    const events = [
      buildEvent({
        startDate: 'invalid',
        endDate: 'invalid',
      }),
    ]

    const { container } = render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
      />
    )

    expect(container.querySelectorAll('span[data-color]').length).toBe(0)
  })

  it('uses deterministic color priority for overlapping events', () => {
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'work',
        title: 'Standup',
        startDate: '2025-04-10',
        endDate: '2025-04-10',
        category: 'work',
        color: '#8B5CF6',
      }),
      buildEvent({
        id: 'birthday',
        title: 'Birthday',
        startDate: '2025-04-10',
        endDate: '2025-04-10',
        category: 'birthdays',
        color: '#F59E0B',
      }),
    ]

    const { container } = render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
      />
    )

    expect(container.querySelectorAll('span[data-color]').length).toBe(2)
    expect(container.querySelectorAll('span[data-color="#F59E0B"]').length).toBe(1)
    expect(container.querySelectorAll('span[data-color="#8B5CF6"]').length).toBe(1)
  })

  it('shows stacked titles in scroll mode when space is available', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'mom',
        title: 'Mom BDay',
        startDate: '2025-04-10',
        endDate: '2025-04-10',
        category: 'birthdays',
        color: '#F59E0B',
      }),
      buildEvent({
        id: 'dad',
        title: 'Dad BDay',
        startDate: '2025-04-10',
        endDate: '2025-04-10',
        category: 'birthdays',
        color: '#F59E0B',
      }),
    ]

    render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
        isScrollable
        scrollDensity={100}
      />
    )

    expect(screen.getByText('Mom BDay')).toBeInTheDocument()
    expect(screen.getByText('Dad BDay')).toBeInTheDocument()
  })

  it('opens tooltip from stacked events on keyboard activation', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'mom',
        title: 'Mom BDay',
        startDate: '2025-04-10',
        endDate: '2025-04-10',
        category: 'birthdays',
        color: '#F59E0B',
      }),
    ]

    render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
        isScrollable
        scrollDensity={100}
      />
    )

    const eventButton = screen.getByRole('button', { name: 'Mom BDay' })
    fireEvent.keyDown(eventButton, { key: 'Escape' })
    expect(screen.queryByRole('tooltip', { name: /mom bday details/i })).toBeNull()
    fireEvent.keyDown(eventButton, { key: 'Enter' })
    expect(screen.getByRole('tooltip', { name: /mom bday details/i })).toBeInTheDocument()
  })

  it('hides stacked titles when there is no space', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverZeroMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'mom',
        title: 'Mom BDay',
        startDate: '2025-04-10',
        endDate: '2025-04-10',
        category: 'birthdays',
        color: '#F59E0B',
      }),
    ]

    render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
        isScrollable
        scrollDensity={100}
      />
    )

    expect(screen.queryByText('Mom BDay')).toBeNull()
  })

  it('hides multi-day events via tooltip action', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const onHideEvent = vi.fn()
    const events = [
      buildEvent({
        title: 'Rent Payment',
        startDate: '2025-02-10',
        endDate: '2025-02-12',
        durationDays: 3,
        isMultiDay: true,
      }),
    ]

    render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        onHideEvent={onHideEvent}
        categories={getAllCategories()}
      />
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: /rent payment/i }), {
      clientX: 120,
      clientY: 80,
    })
    fireEvent.click(await screen.findByRole('button', { name: /hide events like rent payment/i }))
    expect(onHideEvent).toHaveBeenCalledWith('Rent Payment')
  })

  it('hides single-day events via tooltip action', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const onHideEvent = vi.fn()
    const events = [
      buildEvent({
        title: 'Doctor',
        startDate: '2025-02-10',
        endDate: '2025-02-10',
        durationDays: 1,
        isMultiDay: false,
      }),
    ]

    const { container } = render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        onHideEvent={onHideEvent}
        categories={getAllCategories()}
      />
    )

    const dayCell = container.querySelector('[data-date="2025-02-10"]')
    expect(dayCell).not.toBeNull()
    fireEvent.mouseEnter(dayCell as HTMLElement, { clientX: 160, clientY: 100 })
    fireEvent.click(await screen.findByRole('button', { name: /hide events like doctor/i }))
    expect(onHideEvent).toHaveBeenCalledWith('Doctor')
  })

  it('opens Google Calendar when clicking a day cell', () => {
    const { container } = render(
      <YearGrid
        year={2025}
        events={[]}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
      />
    )
    const dayCell = container.querySelector('[data-date="2025-01-15"]')

    expect(dayCell).not.toBeNull()

    expect(dayCell).toHaveAttribute(
      'href',
      'https://calendar.google.com/calendar/r/eventedit?dates=20250115/20250116&allday=true'
    )
    expect(dayCell).toHaveAttribute('target', '_blank')
    expect(dayCell).toHaveAttribute('rel', 'noopener noreferrer')

    fireEvent.click(dayCell as HTMLElement)
  })
})
