import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { YearbirdEvent } from '../../types/calendar'
import type { CategoryConfig } from '../../types/categories'
import { DaySummaryPopover } from './DaySummaryPopover'

/**
 * Creates a mock YearbirdEvent with sensible defaults.
 * Override any properties as needed for specific test cases.
 */
const createMockEvent = (overrides?: Partial<YearbirdEvent>): YearbirdEvent => ({
  id: 'test-1',
  title: 'Test Event',
  startDate: '2025-01-15',
  endDate: '2025-01-15',
  isAllDay: true,
  isMultiDay: false,
  isSingleDayTimed: false,
  durationDays: 1,
  googleLink: 'https://calendar.google.com/calendar/event?eid=test123',
  category: 'work',
  color: '#8B5CF6',
  calendarId: 'primary',
  calendarName: 'Work Calendar',
  calendarColor: '#38BDF8',
  ...overrides,
})

/**
 * Creates an array of mock events for testing overflow behavior.
 */
const createMockEvents = (count: number): YearbirdEvent[] =>
  Array.from({ length: count }, (_, i) =>
    createMockEvent({
      id: `event-${i + 1}`,
      title: `Event ${i + 1}`,
    })
  )

const mockCategories: CategoryConfig[] = [
  { category: 'work', color: '#8B5CF6', label: 'Work', keywords: [] },
  { category: 'personal', color: '#22C55E', label: 'Personal', keywords: [] },
]

const defaultProps = {
  date: new Date(2025, 0, 15),
  events: [createMockEvent()],
  categories: mockCategories,
  googleCalendarCreateUrl: 'https://calendar.google.com/calendar/r/eventedit?dates=20250115/20250116',
  googleCalendarDayUrl: 'https://calendar.google.com/calendar/r/day/2025/1/15',
  children: <button>Trigger</button>,
}

describe('DaySummaryPopover', () => {
  it('renders date header correctly', async () => {
    render(<DaySummaryPopover {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      expect(screen.getByText('January 15, 2025')).toBeInTheDocument()
    })
  })

  it('displays all events when 6 or fewer', async () => {
    const events = createMockEvents(4)
    render(<DaySummaryPopover {...defaultProps} events={events} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      expect(screen.getByText('Event 1')).toBeInTheDocument()
      expect(screen.getByText('Event 2')).toBeInTheDocument()
      expect(screen.getByText('Event 3')).toBeInTheDocument()
      expect(screen.getByText('Event 4')).toBeInTheDocument()
      expect(screen.queryByText(/more/)).not.toBeInTheDocument()
    })
  })

  it('shows overflow message when more than 6 events', async () => {
    const events = createMockEvents(9)
    render(<DaySummaryPopover {...defaultProps} events={events} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      // Should show first 6 events
      expect(screen.getByText('Event 1')).toBeInTheDocument()
      expect(screen.getByText('Event 6')).toBeInTheDocument()
      // Should not show 7th event
      expect(screen.queryByText('Event 7')).not.toBeInTheDocument()
      // Should show overflow link
      expect(screen.getByText(/\+3 more — View all in Google/)).toBeInTheDocument()
    })
  })

  it('calls onEventClick when event row is clicked', async () => {
    const onEventClick = vi.fn()
    render(<DaySummaryPopover {...defaultProps} onEventClick={onEventClick} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      const eventButton = screen.getByRole('button', { name: 'Test Event' })
      expect(eventButton).toBeInTheDocument()
      fireEvent.click(eventButton)
      expect(onEventClick).toHaveBeenCalledWith(
        defaultProps.events[0],
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      )
    })
  })

  it('renders "Open Day" button with correct URL', async () => {
    render(<DaySummaryPopover {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      const openDayLink = screen.getByRole('link', { name: /Open Day/i })
      expect(openDayLink).toHaveAttribute('href', defaultProps.googleCalendarDayUrl)
      expect(openDayLink).toHaveAttribute('target', '_blank')
    })
  })

  it('renders "New Event" button with correct URL', async () => {
    render(<DaySummaryPopover {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      const newEventLink = screen.getByRole('link', { name: /New Event/i })
      expect(newEventLink).toHaveAttribute('href', defaultProps.googleCalendarCreateUrl)
      expect(newEventLink).toHaveAttribute('target', '_blank')
    })
  })

  it('renders close button with aria-label', async () => {
    render(<DaySummaryPopover {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Close popover/i })).toBeInTheDocument()
    })
  })

  it('shows "No events" message when events array is empty', async () => {
    render(<DaySummaryPopover {...defaultProps} events={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      expect(screen.getByText('No events')).toBeInTheDocument()
    })
  })

  it('uses event calendarColor when available', async () => {
    const eventWithCalendarColor = createMockEvent({ calendarColor: '#FF0000' })
    render(<DaySummaryPopover {...defaultProps} events={[eventWithCalendarColor]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))

    await waitFor(() => {
      // The color dot should use calendarColor
      const listItems = screen.getAllByRole('listitem')
      expect(listItems.length).toBeGreaterThan(0)
      const colorDot = within(listItems[0]).getByRole('button').querySelector('span[aria-hidden="true"]')
      expect(colorDot).toHaveStyle({ backgroundColor: '#FF0000' })
    })
  })
})
