import clsx from 'clsx'
import { formatNumber } from '@/lib/format'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import type { Affordability, ResolvedPrediction } from '@/types'
import { AFFORDABILITY_LABEL } from '@/engine/planning'
import { confidenceLabel, phaseLabel } from '@/engine/predictions'

/* ------------------------------------------------------------------ */
/* Affordability                                                       */
/* ------------------------------------------------------------------ */

const TONE: Record<Affordability, { color: string; mark: string }> = {
  guaranteed: { color: 'var(--success)', mark: '✓' },
  likely: { color: 'var(--frost)', mark: '◇' },
  'at-risk': { color: 'var(--star-gold)', mark: '△' },
  unfunded: { color: 'var(--danger)', mark: '✕' },
}

export function AffordabilityBadge({
  status, className, showLabel = true,
}: {
  status: Affordability
  className?: string
  showLabel?: boolean
}) {
  const tone = TONE[status]
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]', className)}
      style={{ color: tone.color }}
    >
      <span aria-hidden className="text-[11px] leading-none">{tone.mark}</span>
      {showLabel && <span>{AFFORDABILITY_LABEL[status]}</span>}
    </span>
  )
}

export function affordabilityColor(status: Affordability): string {
  return TONE[status].color
}

/* ------------------------------------------------------------------ */
/* Banner confidence                                                   */
/* ------------------------------------------------------------------ */

/**
 * Confidence is always shown next to the timing. A prediction never appears as
 * a bare date, because a bare date reads as confirmed.
 */
export function PredictionChip({
  prediction, className,
}: {
  prediction?: ResolvedPrediction
  className?: string
}) {
  if (!prediction) {
    return (
      <span className={clsx('chip', className)}>
        <span className="text-moon-dim">Timing unknown</span>
      </span>
    )
  }

  const official = prediction.sourceType === 'official'
  const pct = Math.round(prediction.confidence * 100)

  return (
    <span
      className={clsx('chip', className)}
      style={official ? { borderColor: 'rgba(169,213,232,0.42)', color: 'var(--moon)' } : undefined}
    >
      <span>{prediction.versionName}</span>
      <span className="text-moon-dim">·</span>
      <span className="text-moon-dim">{phaseLabel(prediction.phase)}</span>
      {!prediction.isUserOverride && (
        <>
          <span className="text-moon-dim">·</span>
          <span className="num" style={{ color: official ? 'var(--frost)' : 'var(--moon-dim)' }}>
            {official ? confidenceLabel('official') : `${pct}%`}
          </span>
        </>
      )}
      {prediction.isUserOverride && (
        <>
          <span className="text-moon-dim">·</span>
          <span className="text-moon-dim">yours</span>
        </>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

/** A number that settles into place rather than snapping. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const rounded = useTransform(mv, (v) => formatNumber(v))

  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.7, ease: [0.22, 0.8, 0.28, 1] })
    return controls.stop
  }, [value, mv, reduce])

  return <motion.span className={clsx('num', className)}>{rounded}</motion.span>
}

/** Ranged figure, e.g. "151–171". Uncertainty is never hidden behind one number. */
export function RangeValue({
  low, high, className,
}: {
  low: number
  high: number
  className?: string
}) {
  if (Math.round(low) === Math.round(high)) {
    return <span className={clsx('num', className)}>{Math.round(low)}</span>
  }
  return (
    <span className={clsx('num', className)}>
      {Math.round(low)}
      <span className="mx-0.5 text-moon-dim">–</span>
      {Math.round(high)}
    </span>
  )
}
