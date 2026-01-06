import type { SVGProps } from 'react'

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
