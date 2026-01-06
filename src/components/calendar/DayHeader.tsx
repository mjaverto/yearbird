import clsx from 'clsx'

const DAY_COLUMN_COUNT = 31

interface DayHeaderProps {
  className?: string
}

export function DayHeader({ className }: DayHeaderProps) {
  return (
    <div
      className={clsx(
        'sticky top-0 z-20 flex flex-none border-b border-zinc-200/70 bg-white/95 backdrop-blur',
        className
      )}
    >
      <div className="w-12 flex-none bg-white/95" />
      <div className="grid flex-1 grid-cols-31 gap-px bg-zinc-200/70">
        {Array.from({ length: DAY_COLUMN_COUNT }, (_, index) => (
          <div
            key={index}
            className="flex h-6 items-center justify-center bg-white px-0.5 text-[10px] font-medium text-zinc-400 md:h-auto md:py-1 md:text-xs"
          >
            <span className="hidden md:inline">{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
