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

  it('adds hit slop classes for easier hover targets', () => {
    const bar = buildBar()

    render(<EventBars bars={[bar]} />)

    const element = screen.getByRole('button', { name: 'Trip' })

    expect(element).toHaveClass(
      "before:absolute before:-inset-y-0.5 before:-inset-x-0.5 before:content-[''] before:rounded-sm before:bg-transparent"
    )
  })

  it('fires click, hover, and keyboard handlers', () => {
    const onEventClick = vi.fn()
    const onEventHover = vi.fn()
    const onEventMove = vi.fn()
    const onEventLeave = vi.fn()
    const bar = buildBar()

    render(
      <EventBars
        bars={[bar]}
        onEventClick={onEventClick}
        onEventHover={onEventHover}
        onEventMove={onEventMove}
        onEventLeave={onEventLeave}
      />
    )

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
    fireEvent.mouseEnter(element, { clientX: 10, clientY: 20 })
    fireEvent.mouseMove(element, { clientX: 12, clientY: 24 })
    fireEvent.mouseLeave(element)
    fireEvent.focus(element)
    fireEvent.blur(element)
    fireEvent.click(element)
    fireEvent.keyDown(element, { key: 'Enter' })
    fireEvent.keyDown(element, { key: ' ' })

    expect(onEventHover).toHaveBeenNthCalledWith(1, bar.event, { x: 10, y: 20 }, 'pointer')
    expect(onEventHover).toHaveBeenNthCalledWith(2, bar.event, { x: 150, y: 120 }, 'focus')
    expect(onEventMove).toHaveBeenCalledTimes(1)
    expect(onEventLeave).toHaveBeenNthCalledWith(1, bar.event.id)
    expect(onEventLeave).toHaveBeenNthCalledWith(2, bar.event.id)
    expect(onEventClick).toHaveBeenCalledTimes(3)
  })
})
