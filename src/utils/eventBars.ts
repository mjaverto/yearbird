import type { YearbirdEvent } from '../types/calendar'
import { parseDateValue } from './dateUtils'

export interface EventBar {
  event: YearbirdEvent
  month: number
  startDay: number
  endDay: number
  row: number
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export function calculateEventBars(events: YearbirdEvent[], year: number): EventBar[] {
  const bars: EventBar[] = []

  for (const event of events) {
    if (event.durationDays <= 1) {
      continue
    }

    const startDate = parseDateValue(event.startDate)
    const endDate = parseDateValue(event.endDate)

    if (!startDate || !endDate) {
      continue
    }

    const start = startOfDay(startDate)
    const end = startOfDay(endDate)

    if (end.getTime() < start.getTime()) {
      continue
    }

    if (start.getFullYear() > year || end.getFullYear() < year) {
      continue
    }

    const effectiveStart = start.getFullYear() < year ? new Date(year, 0, 1) : start
    const effectiveEnd = end.getFullYear() > year ? new Date(year, 11, 31) : end

    let currentDate = new Date(
      effectiveStart.getFullYear(),
      effectiveStart.getMonth(),
      effectiveStart.getDate()
    )

    while (currentDate <= effectiveEnd) {
      const month = currentDate.getMonth()
      const startDay = currentDate.getDate()
      const monthEnd = new Date(year, month + 1, 0)
      const endDay = effectiveEnd < monthEnd ? effectiveEnd.getDate() : monthEnd.getDate()

      bars.push({
        event,
        month,
        startDay,
        endDay,
        row: 0,
      })

      currentDate = new Date(year, month + 1, 1)
    }
  }

  return calculateStackingRows(bars)
}

function calculateStackingRows(bars: EventBar[]): EventBar[] {
  const byMonth = new Map<number, EventBar[]>()

  for (const bar of bars) {
    const existing = byMonth.get(bar.month) ?? []
    existing.push(bar)
    byMonth.set(bar.month, existing)
  }

  for (const monthBars of byMonth.values()) {
    monthBars.sort((a, b) => {
      if (a.startDay !== b.startDay) return a.startDay - b.startDay
      return b.endDay - b.startDay - (a.endDay - a.startDay)
    })

    const rowEndDays: number[] = []

    for (const bar of monthBars) {
      const availableRow = rowEndDays.findIndex((endDay) => endDay < bar.startDay)
      const assignedRow = availableRow === -1 ? rowEndDays.length : availableRow

      bar.row = assignedRow
      rowEndDays[assignedRow] = bar.endDay
    }
  }

  return bars
}
