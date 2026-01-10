import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DayColumnView } from './DayColumnView'
import type { YearbirdEvent } from '../../types/calendar'
import type { CategoryConfig } from '../../types/categories'

const buildEvent = (overrides: Partial<YearbirdEvent> = {}): YearbirdEvent => ({
  id: '1',
  title: 'Meeting',
  startDate: '2025-02-10',
  endDate: '2025-02-10',
  isAllDay: false,
  isMultiDay: false,
  isSingleDayTimed: true,
  durationDays: 1,
  googleLink: '',
  category: 'work',
  color: '#8B5CF6',
  startTime: '09:00',
  endTime: '10:00',
  startTimeMinutes: 540, // 9 * 60
  endTimeMinutes: 600, // 10 * 60
  ...overrides,
})

const defaultCategories: CategoryConfig[] = [
  { category: 'work', label: 'Work', keywords: [], color: '#8B5CF6' },
  { category: 'personal', label: 'Personal', keywords: [], color: '#10B981' },
]

describe('DayColumnView', () => {
  it('renders "No timed events" when events array is empty', () => {
    render(<DayColumnView events={[]} categories={defaultCategories} />)

    expect(screen.getByText('No timed events')).toBeInTheDocument()
  })

  it('renders "No timed events" when events lack time data', () => {
    const eventWithoutTime = buildEvent({
      startTimeMinutes: undefined,
      endTimeMinutes: undefined,
    })

    render(<DayColumnView events={[eventWithoutTime]} categories={defaultCategories} />)

    expect(screen.getByText('No timed events')).toBeInTheDocument()
  })

  it('renders event title and time range', () => {
    const event = buildEvent({ title: 'Team Standup' })

    render(<DayColumnView events={[event]} categories={defaultCategories} />)

    expect(screen.getByText('Team Standup')).toBeInTheDocument()
  })

  it('renders multiple events at different times', () => {
    const events = [
      buildEvent({
        id: '1',
        title: 'Morning Meeting',
        startTimeMinutes: 540,
        endTimeMinutes: 600,
      }),
      buildEvent({
        id: '2',
        title: 'Lunch',
        startTimeMinutes: 720,
        endTimeMinutes: 780,
      }),
      buildEvent({
        id: '3',
        title: 'Afternoon Review',
        startTimeMinutes: 840,
        endTimeMinutes: 900,
      }),
    ]

    render(<DayColumnView events={events} categories={defaultCategories} />)

    expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
    expect(screen.getByText('Lunch')).toBeInTheDocument()
    expect(screen.getByText('Afternoon Review')).toBeInTheDocument()
  })

  it('handles overlapping events by positioning them side by side', () => {
    const events = [
      buildEvent({
        id: '1',
        title: 'Meeting A',
        startTimeMinutes: 540,
        endTimeMinutes: 660, // 9-11 AM
      }),
      buildEvent({
        id: '2',
        title: 'Meeting B',
        startTimeMinutes: 600,
        endTimeMinutes: 720, // 10 AM - 12 PM (overlaps with A)
      }),
    ]

    const { container } = render(
      <DayColumnView events={events} categories={defaultCategories} />
    )

    // Both events should be rendered
    expect(screen.getByText('Meeting A')).toBeInTheDocument()
    expect(screen.getByText('Meeting B')).toBeInTheDocument()

    // Check that overlapping events have reduced width (50% each)
    const eventButtons = container.querySelectorAll('button')
    expect(eventButtons).toHaveLength(2)
    // Each should have width: calc(50% - 2px)
    expect(eventButtons[0]).toHaveStyle({ width: 'calc(50% - 2px)' })
    expect(eventButtons[1]).toHaveStyle({ width: 'calc(50% - 2px)' })
  })

  it('calls onEventClick when event is clicked', () => {
    const onEventClick = vi.fn()
    const event = buildEvent({ title: 'Clickable Meeting' })

    render(
      <DayColumnView
        events={[event]}
        categories={defaultCategories}
        onEventClick={onEventClick}
      />
    )

    fireEvent.click(screen.getByText('Clickable Meeting'), {
      clientX: 100,
      clientY: 200,
    })

    expect(onEventClick).toHaveBeenCalledWith(event, { x: 100, y: 200 })
  })

  it('renders time axis with hour labels', () => {
    const event = buildEvent()

    render(<DayColumnView events={[event]} categories={defaultCategories} />)

    // Check for some hour labels (6 AM through 10 PM range)
    expect(screen.getByText('9 AM')).toBeInTheDocument()
    expect(screen.getByText('12 PM')).toBeInTheDocument()
    expect(screen.getByText('3 PM')).toBeInTheDocument()
  })

  it('uses event color from calendar or category', () => {
    const eventWithCalendarColor = buildEvent({
      calendarColor: '#FF5733',
    })

    const { container } = render(
      <DayColumnView events={[eventWithCalendarColor]} categories={defaultCategories} />
    )

    const eventButton = container.querySelector('button')
    expect(eventButton).toHaveStyle({ borderLeftColor: '#FF5733' })
  })

  it('falls back to category color when no calendar color', () => {
    const event = buildEvent({
      calendarColor: undefined,
      category: 'work',
    })

    const { container } = render(
      <DayColumnView events={[event]} categories={defaultCategories} />
    )

    const eventButton = container.querySelector('button')
    expect(eventButton).toHaveStyle({ borderLeftColor: '#8B5CF6' })
  })

  it('shows title with tooltip for full event info', () => {
    const event = buildEvent({
      title: 'Important Meeting',
      startTime: '14:00',
      endTime: '15:30',
    })

    const { container } = render(
      <DayColumnView events={[event]} categories={defaultCategories} />
    )

    const eventButton = container.querySelector('button')
    expect(eventButton).toHaveAttribute('title', '14:00 - 15:30: Important Meeting')
  })
})
