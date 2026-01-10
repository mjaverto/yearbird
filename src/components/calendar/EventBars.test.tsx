import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventBar } from '../../utils/eventBars'
import type { YearbirdEvent } from '../../types/calendar'
import { EventBars } from './EventBars'

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

const buildBar = (overrides: Partial<EventBar> = {}): EventBar => ({
  event: buildEvent(),
  month: 0,
  startDay: 10,
  endDay: 12,
  row: 0,
  ...overrides,
})

describe('EventBars', () => {
  it('returns null when no bars are provided', () => {
    const { container } = render(<EventBars bars={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('adds hit slop classes for easier click targets', () => {
    const bar = buildBar()

    render(<EventBars bars={[bar]} />)

    const element = screen.getByRole('button', { name: 'Trip' })

    expect(element).toHaveClass(
      "before:absolute before:-inset-y-0.5 before:-inset-x-0.5 before:content-[''] before:rounded-sm before:bg-transparent"
    )
  })

  it('fires click handler with position on click and keyboard', () => {
    const onEventClick = vi.fn()
    const bar = buildBar()

    render(<EventBars bars={[bar]} onEventClick={onEventClick} />)

    const element = screen.getByRole('button', { name: 'Trip' })
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      left: 50,
      top: 100,
      width: 200,
      height: 20,
      right: 250,
      bottom: 120,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect)

    // Click fires with mouse position
    fireEvent.click(element, { clientX: 75, clientY: 110 })
    expect(onEventClick).toHaveBeenNthCalledWith(1, bar.event, { x: 75, y: 110 })

    // Focus alone does NOT fire (prevents double-trigger when clicking)
    fireEvent.focus(element)
    expect(onEventClick).toHaveBeenCalledTimes(1)

    // Enter key fires with calculated center position
    fireEvent.keyDown(element, { key: 'Enter' })
    expect(onEventClick).toHaveBeenNthCalledWith(2, bar.event, { x: 150, y: 120 })

    // Space key fires with calculated center position
    fireEvent.keyDown(element, { key: ' ' })
    expect(onEventClick).toHaveBeenNthCalledWith(3, bar.event, { x: 150, y: 120 })

    expect(onEventClick).toHaveBeenCalledTimes(3)
  })

  it('ignores non-activation keyboard events', () => {
    const onEventClick = vi.fn()
    const bar = buildBar()

    render(<EventBars bars={[bar]} onEventClick={onEventClick} />)

    const element = screen.getByRole('button', { name: 'Trip' })
    fireEvent.keyDown(element, { key: 'Tab' })
    fireEvent.keyDown(element, { key: 'Escape' })

    expect(onEventClick).not.toHaveBeenCalled()
  })
})
