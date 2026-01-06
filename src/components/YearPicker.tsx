import { Button } from './ui/button'

interface YearPickerProps {
  year: number
  onChange: (year: number) => void
  minYear?: number
  maxYear?: number
  size?: 'default' | 'compact'
}

export function YearPicker({
  year,
  onChange,
  minYear = 2020,
  maxYear = 2030,
  size = 'default',
}: YearPickerProps) {
  const canGoBack = year > minYear
  const canGoForward = year < maxYear
  const isCompact = size === 'compact'
  const buttonClassName = isCompact
    ? 'px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900'
    : 'text-zinc-600 hover:text-zinc-900'
  const yearClassName = isCompact
    ? 'min-w-[3rem] text-center text-sm font-semibold tabular-nums'
    : 'min-w-[4rem] text-center text-lg font-semibold tabular-nums'

  return (
    <div className="flex items-center gap-2">
      <Button
        plain
        onClick={() => onChange(year - 1)}
        disabled={!canGoBack}
        aria-label="Previous year"
        className={buttonClassName}
      >
        <span className="text-current">&larr;</span>
      </Button>

      <span className={yearClassName}>{year}</span>

      <Button
        plain
        onClick={() => onChange(year + 1)}
        disabled={!canGoForward}
        aria-label="Next year"
        className={buttonClassName}
      >
        <span className="text-current">&rarr;</span>
      </Button>
    </div>
  )
}
