import clsx from 'clsx'
import type { CategoryConfig } from '../types/categories'
import type { EventCategory } from '../types/calendar'
import { getAllCategories } from '../utils/categorize'

interface ColorLegendProps {
  categories?: CategoryConfig[]
  hiddenCategories?: EventCategory[]
  onToggleCategory?: (category: EventCategory) => void
  className?: string
  density?: 'default' | 'compact'
  wrap?: boolean
}

export function ColorLegend({
  categories,
  hiddenCategories = [],
  onToggleCategory,
  className,
  density = 'default',
  wrap = true,
}: ColorLegendProps) {
  const categoryList = categories ?? getAllCategories()
  const hiddenSet = new Set(hiddenCategories)
  const isCompact = density === 'compact'
  const containerClassName = clsx(
    'flex items-center',
    wrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto',
    isCompact ? 'gap-2 text-[11px]' : 'gap-4 text-sm',
    !wrap && 'whitespace-nowrap',
    className
  )

  return (
    <div className={containerClassName}>
      {categoryList.map((category) => {
        const isHidden = hiddenSet.has(category.category)
        const actionLabel = isHidden ? `Show ${category.label}` : `Hide ${category.label}`
        const baseClass = clsx(
          'flex items-center gap-1.5 rounded-full transition',
          isCompact ? 'px-2 py-0.5' : 'px-1.5 py-0.5'
        )
        const stateClass = isHidden
          ? 'text-zinc-400 line-through opacity-60'
          : 'text-zinc-600'
        const markerClass = clsx(
          isCompact ? 'h-2.5 w-2.5 rounded-sm transition' : 'h-3 w-3 rounded-sm transition',
          isHidden ? 'opacity-30' : 'opacity-100'
        )

        if (!onToggleCategory) {
          return (
            <div
              key={category.category}
              className={clsx(baseClass, stateClass, 'cursor-default')}
            >
              <div className={markerClass} style={{ backgroundColor: category.color }} />
              <span>{category.label}</span>
            </div>
          )
        }

        return (
          <button
            key={category.category}
            type="button"
            className={clsx(
              baseClass,
              stateClass,
              'cursor-pointer hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300',
              !isHidden && 'hover:text-zinc-800'
            )}
            onClick={() => onToggleCategory(category.category)}
            aria-pressed={isHidden}
            aria-label={`${actionLabel} events`}
          >
            <div className={markerClass} style={{ backgroundColor: category.color }} />
            <span>{category.label}</span>
          </button>
        )
      })}
    </div>
  )
}
