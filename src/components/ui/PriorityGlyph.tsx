import clsx from 'clsx'
import type { Priority } from '@/types'
import { PRIORITY_LABEL, PRIORITY_MEANING } from '@/engine/planning'

export { PRIORITY_LABEL, PRIORITY_MEANING }

/**
 * Priority as a moon phase.
 *
 * Never colour alone: the glyph carries the meaning in *shape*, and every use
 * site pairs it with the written word.
 */

/**
 * Fraction of the disc that is lit — a waning moon down the scale.
 *
 * The steps are uneven on purpose. At 12px a literal 0.75 is indistinguishable
 * from a full moon, and the gap between the last two has to stay readable, so
 * the lit portion is spaced by what the eye can separate rather than by rank.
 */
const FILL: Record<Priority, number> = {
  must: 1, dream: 0.72, want: 0.5, try: 0.26, luxury: 0,
}

const ACCENT: Record<Priority, string> = {
  must: 'var(--frost)',
  dream: 'var(--lunar-blue)',
  want: 'var(--lunar-violet)',
  try: 'var(--moon-muted)',
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
