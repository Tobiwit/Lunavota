/**
 * Lunar iconography. Thin celestial geometry, drawn on a 24-unit grid so the
 * stroke weight stays consistent with the hairlines used everywhere else.
 */

interface IconProps {
  size?: number
  className?: string
  active?: boolean
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function MoonIcon({ size = 22, className, active }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="7" opacity={active ? 1 : 0.85} />
      {/* The terminator: a full moon when active, a crescent when not. */}
      <path
        d="M12 5a7 7 0 0 0 0 14"
        fill={active ? 'currentColor' : 'none'}
        opacity={active ? 0.35 : 0.9}
      />
      <circle cx="12" cy="12" r="10.2" opacity="0.22" strokeDasharray="1.5 3.5" />
    </svg>
  )
}

export function TimelineIcon({ size = 22, className, active }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 3v18" opacity="0.8" />
      <circle cx="12" cy="7" r="2.6" fill={active ? 'currentColor' : 'none'} fillOpacity="0.3" />
      <circle cx="12" cy="16.5" r="1.6" />
      <path d="M12 11.5h4.5" opacity="0.55" />
      <path d="M7.5 13.6H12" opacity="0.4" />
    </svg>
  )
}

export function WishlistIcon({ size = 22, className, active }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path
        d="M12 3.6l2.1 4.6 5 .6-3.7 3.4 1 4.9L12 14.7 7.6 17.1l1-4.9L4.9 8.8l5-.6z"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity="0.22"
      />
      <path d="M12 19.5v1.2" opacity="0.4" />
    </svg>
  )
}

export function HistoryIcon({ size = 22, className, active }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8" opacity={active ? 1 : 0.85} />
      <path d="M12 7.6V12l3 1.8" />
      <path d="M4.4 9.2A8 8 0 0 1 12 4" opacity="0.35" />
    </svg>
  )
}

export function PlusIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  )
}

export function SettingsIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3.1" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2 3.4" opacity="0.5" />
      <path d="M12 4v1.6M12 18.4V20M4 12h1.6M18.4 12H20" opacity="0.8" />
    </svg>
  )
}

export function SparkIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 4.5l1.5 4.4 4.4 1.6-4.4 1.6L12 16.5l-1.5-4.4L6.1 10.5l4.4-1.6z" />
      <path d="M18 16.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" opacity="0.6" />
    </svg>
  )
}

export function ChevronIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M9 5.5l6 6.5-6 6.5" />
    </svg>
  )
}

export function BackIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </svg>
  )
}

export function SearchIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  )
}

export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
