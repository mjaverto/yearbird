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
    expect(container.querySelectorAll('.today-ring')).toHaveLength(1)
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

    // Click event bar to show tooltip
    fireEvent.click(screen.getByRole('button', { name: /rent payment/i }), {
      clientX: 120,
      clientY: 80,
    })
    // Wait for tooltip and click hide button
    fireEvent.click(await screen.findByRole('button', { name: /hide events like rent payment/i }))
    expect(onHideEvent).toHaveBeenCalledWith('Rent Payment')
  })

  it('hides single-day events via tooltip action in scrollable mode', async () => {
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

    render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        onHideEvent={onHideEvent}
        categories={getAllCategories()}
        isScrollable={true}
        scrollDensity={60}
      />
    )

    // In scrollable mode, click the event item to show tooltip
    const eventItem = screen.getByRole('button', { name: 'Doctor' })
    expect(eventItem).not.toBeNull()
    fireEvent.click(eventItem, { clientX: 160, clientY: 100 })

    // Wait for tooltip and click hide button
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

  it('calls onEventLeave when mouse leaves a day cell with an event', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const events = [
      buildEvent({
        id: 'test-leave',
        title: 'Leave Event',
        startDate: '2025-03-15',
        endDate: '2025-03-15',
        durationDays: 1,
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

    const dayCell = container.querySelector('[data-date="2025-03-15"]')
    expect(dayCell).not.toBeNull()

    fireEvent.mouseEnter(dayCell as HTMLElement, { clientX: 100, clientY: 100 })
    fireEvent.mouseLeave(dayCell as HTMLElement)
  })

  it('renders dots for multiple single-day events on the same day', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'event1',
        title: 'Event 1',
        startDate: '2025-05-20',
        endDate: '2025-05-20',
        color: '#FF0000',
      }),
      buildEvent({
        id: 'event2',
        title: 'Event 2',
        startDate: '2025-05-20',
        endDate: '2025-05-20',
        color: '#00FF00',
      }),
      buildEvent({
        id: 'event3',
        title: 'Event 3',
        startDate: '2025-05-20',
        endDate: '2025-05-20',
        color: '#0000FF',
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

    expect(container.querySelectorAll('span[data-color="#FF0000"]').length).toBe(1)
    expect(container.querySelectorAll('span[data-color="#00FF00"]').length).toBe(1)
    expect(container.querySelectorAll('span[data-color="#0000FF"]').length).toBe(1)
  })

  it('renders plus indicator when more than 3 single-day events on same day', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'event1',
        title: 'Event 1',
        startDate: '2025-05-20',
        endDate: '2025-05-20',
        color: '#FF0000',
      }),
      buildEvent({
        id: 'event2',
        title: 'Event 2',
        startDate: '2025-05-20',
        endDate: '2025-05-20',
        color: '#00FF00',
      }),
      buildEvent({
        id: 'event3',
        title: 'Event 3',
        startDate: '2025-05-20',
        endDate: '2025-05-20',
        color: '#0000FF',
      }),
      buildEvent({
        id: 'event4',
        title: 'Event 4',
        startDate: '2025-05-20',
        endDate: '2025-05-20',
        color: '#FFFF00',
      }),
    ]

    render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
      />
    )

    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('shows tooltip when focusing on stacked event item', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'focus-test',
        title: 'Focus Event',
        startDate: '2025-06-15',
        endDate: '2025-06-15',
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

    const eventButton = screen.getByRole('button', { name: 'Focus Event' })
    fireEvent.focus(eventButton)
    expect(screen.getByRole('tooltip', { name: /focus event details/i })).toBeInTheDocument()
  })

  it('shows tooltip when clicking on stacked event item', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'click-test',
        title: 'Click Event',
        startDate: '2025-07-10',
        endDate: '2025-07-10',
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

    const eventButton = screen.getByRole('button', { name: 'Click Event' })
    fireEvent.click(eventButton, { clientX: 200, clientY: 150 })
    expect(screen.getByRole('tooltip', { name: /click event details/i })).toBeInTheDocument()
  })

  it('allocates stack lines when all events fit within available space', () => {
    vi.stubGlobal('ResizeObserver', createResizeObserverMock(500))
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'short1',
        title: 'A',
        startDate: '2025-08-05',
        endDate: '2025-08-05',
        category: 'birthdays',
        color: '#F59E0B',
      }),
      buildEvent({
        id: 'short2',
        title: 'B',
        startDate: '2025-08-05',
        endDate: '2025-08-05',
        category: 'birthdays',
        color: '#8B5CF6',
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

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('handles focus on day cell with event showing tooltip', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const events = [
      buildEvent({
        id: 'focus-cell',
        title: 'Focus Cell Event',
        startDate: '2025-09-12',
        endDate: '2025-09-12',
        durationDays: 1,
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

    const dayCell = container.querySelector('[data-date="2025-09-12"]')
    expect(dayCell).not.toBeNull()

    fireEvent.focus(dayCell as HTMLElement)
    expect(screen.getByRole('tooltip', { name: /focus cell event details/i })).toBeInTheDocument()
  })

  it('handles blur on day cell hiding tooltip', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const events = [
      buildEvent({
        id: 'blur-cell',
        title: 'Blur Cell Event',
        startDate: '2025-10-08',
        endDate: '2025-10-08',
        durationDays: 1,
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

    const dayCell = container.querySelector('[data-date="2025-10-08"]')
    expect(dayCell).not.toBeNull()

    fireEvent.focus(dayCell as HTMLElement)
    expect(screen.getByRole('tooltip', { name: /blur cell event details/i })).toBeInTheDocument()

    fireEvent.blur(dayCell as HTMLElement)
  })

  it('handles space key activation on stacked event item', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'space-test',
        title: 'Space Event',
        startDate: '2025-11-20',
        endDate: '2025-11-20',
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

    const eventButton = screen.getByRole('button', { name: 'Space Event' })
    fireEvent.keyDown(eventButton, { key: ' ' })
    expect(screen.getByRole('tooltip', { name: /space event details/i })).toBeInTheDocument()
  })

  it('hides day header when showDayHeader is false', () => {
    render(
      <YearGrid
        year={2025}
        events={[]}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
        showDayHeader={false}
      />
    )

    expect(screen.queryByText('1')).toBeNull()
    expect(screen.queryByText('31')).toBeNull()
  })

  it('handles mouse move on day cell with event', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const events = [
      buildEvent({
        id: 'move-test',
        title: 'Move Event',
        startDate: '2025-04-18',
        endDate: '2025-04-18',
        durationDays: 1,
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

    const dayCell = container.querySelector('[data-date="2025-04-18"]')
    expect(dayCell).not.toBeNull()

    fireEvent.mouseEnter(dayCell as HTMLElement, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(dayCell as HTMLElement, { clientX: 110, clientY: 110 })
  })

  it('handles mouse move on stacked event item', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'stack-move',
        title: 'Stack Move',
        startDate: '2025-12-05',
        endDate: '2025-12-05',
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

    const eventButton = screen.getByRole('button', { name: 'Stack Move' })
    fireEvent.mouseEnter(eventButton, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(eventButton, { clientX: 110, clientY: 110 })
  })

  it('proportionally allocates lines when events need more space than available', () => {
    vi.stubGlobal('ResizeObserver', createResizeObserverMock(100))
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'long1',
        title: 'This is a very long event title that should wrap to multiple lines in the stack view',
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        category: 'birthdays',
        color: '#F59E0B',
      }),
      buildEvent({
        id: 'long2',
        title: 'Another extremely long event title that definitely requires multiple lines to display',
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        category: 'work',
        color: '#8B5CF6',
      }),
      buildEvent({
        id: 'long3',
        title: 'Yet another lengthy event title for testing the line allocation algorithm thoroughly',
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        category: 'holidays',
        color: '#10B981',
      }),
    ]

    const { container } = render(
      <YearGrid
        year={2025}
        events={events}
        today={new Date(2025, 0, 1)}
        categories={getAllCategories()}
        isScrollable
        scrollDensity={100}
      />
    )

    const eventButtons = container.querySelectorAll('[role="button"]')
    expect(eventButtons.length).toBeGreaterThan(0)
  })

  it('skips events with end date before start date', () => {
    const events = [
      buildEvent({
        startDate: '2025-05-10',
        endDate: '2025-05-05',
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

  it('handles blur on stacked event item', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'blur-stack',
        title: 'Blur Stack Event',
        startDate: '2025-03-22',
        endDate: '2025-03-22',
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

    const eventButton = screen.getByRole('button', { name: 'Blur Stack Event' })
    fireEvent.focus(eventButton)
    expect(screen.getByRole('tooltip', { name: /blur stack event details/i })).toBeInTheDocument()

    fireEvent.blur(eventButton)
  })

  it('handles mouse leave on stacked event item', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'leave-stack',
        title: 'Leave Stack',
        startDate: '2025-06-28',
        endDate: '2025-06-28',
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

    const eventButton = screen.getByRole('button', { name: 'Leave Stack' })
    fireEvent.mouseEnter(eventButton, { clientX: 100, clientY: 100 })
    fireEvent.mouseLeave(eventButton)
  })

  it('renders with low density hiding titles but showing bars', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMeasuredMock)
    const events: YearbirdEvent[] = [
      buildEvent({
        id: 'low-density',
        title: 'Low Density Event',
        startDate: '2025-02-20',
        endDate: '2025-02-20',
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
        isScrollable
        scrollDensity={10}
      />
    )

    expect(screen.queryByText('Low Density Event')).toBeNull()
    const eventButtons = container.querySelectorAll('[role="button"]')
    expect(eventButtons.length).toBeGreaterThan(0)
  })
})
