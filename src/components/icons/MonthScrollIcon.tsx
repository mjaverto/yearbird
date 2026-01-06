import type { SVGProps } from 'react'

export function MonthScrollIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      aria-hidden="true"
    >
      <path d="M12 4v16" />
      <path d="M9 7l3-3 3 3" />
      <path d="M9 17l3 3 3-3" />
    </svg>
  )
}
