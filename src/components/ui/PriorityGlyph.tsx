import clsx from 'clsx'
import type { Priority } from '@/types'

/**
 * Priority as a moon phase.
 *
 * Never colour alone: the glyph carries the meaning in *shape*, and every use
 * site pairs it with the written word.
 */

export const PRIORITY_LABEL: Record<Priority, string> = {
  must: 'Must',
  want: 'Want',
  interested: 'Interested',
  luxury: 'Luxury',
}

export const PRIORITY_MEANING: Record<Priority, string> = {
  must: 'I would strongly regret missing them.',
  want: 'I actively intend to obtain them.',
  interested: 'Depends on kit, timing, teams or resources.',
  luxury: 'Only worth pulling with resources to spare.',
}

/**
 * Fraction of the disc that is lit, matching ◉ ◕ ◑ ○.
 *
 * Want sits at 0.66 rather than a literal 0.75: at 12px the extra sliver is the
 * only thing separating it from a full moon, and it has to survive that size.
 */
const FILL: Record<Priority, number> = { must: 1, want: 0.66, interested: 0.5, luxury: 0 }

const ACCENT: Record<Priority, string> = {
  must: 'var(--frost)',
  want: 'var(--lunar-blue)',
  interested: 'var(--lunar-violet)',
  luxury: 'var(--moon-dim)',
}

interface Props {
  priority: Priority
  size?: number
  className?: string
}

export function PriorityGlyph({ priority, size = 14, className }: Props) {
  const fill = FILL[priority]
  const accent = ACCENT[priority]
  const r = 6
  const clipId = `moon-clip-${priority}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={clsx('shrink-0', className)}
      role="img"
      aria-label={PRIORITY_LABEL[priority]}
    >
      <defs>
        <clipPath id={clipId}>
          {/* The lit portion sweeps in from the right, like a waxing moon. */}
          <rect x={8 + r - fill * 2 * r} y={0} width={fill * 2 * r + 2} height={16} />
        </clipPath>
      </defs>
      <circle cx="8" cy="8" r={r} fill="none" stroke={accent} strokeWidth="1.2" opacity={0.85} />
      {fill > 0 && <circle cx="8" cy="8" r={r} fill={accent} clipPath={`url(#${clipId})`} opacity={0.92} />}
      {fill === 1 && <circle cx="8" cy="8" r={r + 2.2} fill="none" stroke={accent} strokeWidth="0.7" opacity={0.35} />}
    </svg>
  )
}

export function PriorityTag({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <PriorityGlyph priority={priority} size={12} />
      <span
        className="text-[11px] uppercase tracking-wide2"
        style={{ color: ACCENT[priority] }}
      >
        {PRIORITY_LABEL[priority]}
      </span>
    </span>
  )
}

export function priorityAccent(priority: Priority): string {
  return ACCENT[priority]
}
