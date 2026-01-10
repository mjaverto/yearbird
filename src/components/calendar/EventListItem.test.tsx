import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { YearbirdEvent } from '../../types/calendar'
import type { CategoryConfig } from '../../types/categories'
import { EventListItem } from './EventListItem'

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

const mockCategory: CategoryConfig = {
  category: 'work',
  color: '#8B5CF6',
  label: 'Work',
  keywords: [],
}

const defaultProps = {
  event: createMockEvent(),
  category: mockCategory,
}

describe('EventListItem', () => {
  it('renders event title', () => {
    render(<EventListItem {...defaultProps} />)

    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })

  it('renders calendar name when available', () => {
    render(<EventListItem {...defaultProps} />)

    expect(screen.getByText('Work Calendar')).toBeInTheDocument()
  })

  it('uses calendarId as fallback when calendarName is not available', () => {
    const event = createMockEvent({ calendarName: undefined })
    render(<EventListItem {...defaultProps} event={event} />)

    expect(screen.getByText('primary')).toBeInTheDocument()
  })

  it('renders color dot with event color', () => {
    const event = createMockEvent({ color: '#FF0000' })
    render(<EventListItem {...defaultProps} event={event} />)

    const colorDot = screen.getByRole('button').querySelector('span[aria-hidden="true"]')
    expect(colorDot).toHaveStyle({ backgroundColor: '#FF0000' })
  })

  it('falls back to category color when event color is not available', () => {
    const event = createMockEvent({ color: undefined })
    render(<EventListItem {...defaultProps} event={event} />)

    const colorDot = screen.getByRole('button').querySelector('span[aria-hidden="true"]')
    expect(colorDot).toHaveStyle({ backgroundColor: '#8B5CF6' })
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<EventListItem {...defaultProps} onClick={onClick} />)

    await user.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledWith(
      defaultProps.event,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    )
  })

  it('calls onClick on Enter key', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<EventListItem {...defaultProps} onClick={onClick} />)

    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalled()
  })

  it('calls onClick on Space key', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<EventListItem {...defaultProps} onClick={onClick} />)

    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard(' ')

    expect(onClick).toHaveBeenCalled()
  })

  it('renders external link when googleLink exists', () => {
    render(<EventListItem {...defaultProps} />)

    const externalLink = screen.getByRole('link', { name: /Open Test Event in Google Calendar/i })
    expect(externalLink).toHaveAttribute('href', defaultProps.event.googleLink)
    expect(externalLink).toHaveAttribute('target', '_blank')
  })

  it('does not render external link when googleLink is not available', () => {
    const event = createMockEvent({ googleLink: undefined })
    render(<EventListItem {...defaultProps} event={event} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('applies highlighted styles when isHighlighted is true', () => {
    render(<EventListItem {...defaultProps} isHighlighted />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-zinc-100')
  })

  it('applies hover styles when not highlighted', () => {
    render(<EventListItem {...defaultProps} isHighlighted={false} />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('hover:bg-zinc-50')
  })

  describe('Accessibility', () => {
    it('has correct role and tabIndex', () => {
      render(<EventListItem {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('tabIndex', '0')
    })

    it('has descriptive aria-label', () => {
      render(<EventListItem {...defaultProps} />)

      const button = screen.getByRole('button', { name: 'Test Event' })
      expect(button).toBeInTheDocument()
    })

    it('stops propagation when external link is clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<EventListItem {...defaultProps} onClick={onClick} />)

      const externalLink = screen.getByRole('link')
      await user.click(externalLink)

      // onClick should NOT be called when clicking external link
      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
