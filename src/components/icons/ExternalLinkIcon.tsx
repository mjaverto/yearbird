import type { SVGProps } from 'react'

export function ExternalLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      aria-hidden="true"
    >
      <path d="M14 5h5v5" />
      <path d="M10 14l9-9" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </svg>
  )
}
