import type { ReactNode } from 'react'

// Small inline icons, drawn on a 16x16 grid with the current text colour.
// Decorative by default; the button around each icon carries the accessible name.

interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export const MapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M1.5 3.5 5.5 2l5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5z M5.5 2v10.5 M10.5 3.5V14" />
  </Svg>
)

export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 14h12 M4 11V7 M8 11V3 M12 11V8" />
  </Svg>
)

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 8a5 5 0 1 1-1.5-3.5 M13 2.5v3h-3" />
  </Svg>
)

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 3v10 M10.5 3v10" />
  </Svg>
)

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 2.5 13 8l-8.5 5.5z" />
  </Svg>
)

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4l4 4-4 4" />
  </Svg>
)

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 4h12 M2 8h12 M2 12h12" />
  </Svg>
)

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 3.5l9 9 M12.5 3.5l-9 9" />
  </Svg>
)
