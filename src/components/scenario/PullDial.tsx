import { useCallback, useRef } from 'react'
import clsx from 'clsx'
import type { Character } from '@/types'
import { CharacterArt } from '@/components/character/CharacterArt'

/**
 * A wish count you turn.
 *
 * The portrait sits inside the ring, so the thing being adjusted and the person
 * it is being adjusted for are one object. Drag anywhere on the ring; the gap at
 * the bottom keeps zero and maximum off the same point, which a full circle
 * cannot avoid.
 *
 * The portrait is a plain element under the SVG rather than a `foreignObject`
 * inside it — Safari handles foreignObject-in-clipPath badly, and this is an iOS
 * app first. Only a transparent hit ring takes pointer events, so the middle of
 * the portrait is not a drag target.
 */

/** Degrees from the top, clockwise. The arc runs up through 12 o'clock. */
const START = -135
const SWEEP = 270

const SIZE = 96
const CENTER = SIZE / 2
const RING = 40
const PORTRAIT = 58

function pointOn(radius: number, degFromTop: number): [number, number] {
  const rad = (degFromTop * Math.PI) / 180
  return [CENTER + radius * Math.sin(rad), CENTER - radius * Math.cos(rad)]
}

function arcPath(radius: number, fromDeg: number, toDeg: number): string {
  const [x1, y1] = pointOn(radius, fromDeg)
  const [x2, y2] = pointOn(radius, toDeg)
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`
}

interface Props {
  character: Character
  value: number
  max: number
  onChange: (value: number) => void
  accent: string
  label: string
  disabled?: boolean
  /** Drawn dimmer, for a banner being skipped. */
  muted?: boolean
}

export function PullDial({ character, value, max, onChange, accent, label, disabled, muted }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const safeMax = Math.max(1, max)
  const t = Math.max(0, Math.min(1, value / safeMax))
  const angle = START + t * SWEEP
  const [handleX, handleY] = pointOn(RING, angle)

  const valueFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return null
      const rect = svg.getBoundingClientRect()
      const dx = clientX - (rect.left + rect.width / 2)
      const dy = clientY - (rect.top + rect.height / 2)
      // atan2(dx, -dy) puts zero at the top and grows clockwise.
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI

      // The dead zone at the bottom snaps to whichever end it sits nearer.
      if (deg > START + SWEEP) return safeMax
      if (deg < START) return 0
      return Math.round(((deg - START) / SWEEP) * safeMax)
    },
    [safeMax],
  )

  const track = (e: React.PointerEvent) => {
    if (disabled) return
    const next = valueFromPointer(e.clientX, e.clientY)
    if (next != null && next !== value) onChange(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    const step = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 10 : 1
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') next = value + step
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') next = value - step
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = safeMax
    if (next == null) return
    e.preventDefault()
    onChange(Math.max(0, Math.min(safeMax, next)))
  }

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <div
        className="absolute overflow-hidden rounded-full border border-[var(--hairline)]"
        style={{
          left: CENTER - PORTRAIT / 2,
          top: CENTER - PORTRAIT / 2,
          width: PORTRAIT,
          height: PORTRAIT,
          opacity: muted ? 0.45 : 1,
        }}
      >
        <CharacterArt character={character} variant="thumb" className="h-full w-full rounded-full" />
      </div>

      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }}
      >
        {/* Unfilled track */}
        <path
          d={arcPath(RING, START, START + SWEEP)}
          fill="none"
          stroke="rgba(169,213,232,0.13)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* What is committed here */}
        {value > 0 && (
          <path
            d={arcPath(RING, START, angle)}
            fill="none"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
            opacity={muted ? 0.35 : 0.95}
            style={{ filter: muted ? undefined : `drop-shadow(0 0 6px ${accent}88)` }}
          />
        )}

        {/* Grip */}
        {!disabled && (
          <>
            <circle cx={handleX} cy={handleY} r="7" fill="rgba(9,13,24,0.95)" />
            <circle
              cx={handleX}
              cy={handleY}
              r="5.5"
              fill={muted ? 'var(--moon-faint)' : accent}
              style={{ filter: muted ? undefined : `drop-shadow(0 0 6px ${accent})` }}
            />
          </>
        )}

        {/* The only thing that takes pointer events. `touch-action: none` keeps a
            drag from scrolling the sheet, and stopping propagation keeps it from
            reaching the sheet's own drag-to-dismiss. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING}
          fill="none"
          stroke="transparent"
          strokeWidth="26"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={safeMax}
          aria-valuenow={value}
          aria-valuetext={`${value} wishes`}
          aria-disabled={disabled}
          className={clsx('outline-none', disabled ? 'cursor-not-allowed' : 'cursor-grab')}
          style={{ pointerEvents: 'all', touchAction: 'none' }}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            if (disabled) return
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            track(e)
          }}
          onPointerMove={(e) => {
            if (disabled || e.buttons === 0) return
            e.stopPropagation()
            track(e)
          }}
        />
      </svg>
    </div>
  )
}
