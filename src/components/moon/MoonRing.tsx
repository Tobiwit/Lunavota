import { useId, useState } from 'react'
import clsx from 'clsx'

/**
 * The Lunar Reserve.
 *
 * A moon whose light is divided into what you may spend, what is already spoken
 * for, and what has not arrived yet. The luminous arc is always the answer: it
 * should be readable without consulting the legend.
 */

export interface MoonSegment {
  id: string
  value: number
  label: string
  detail: string
  tone: 'free' | 'protected' | 'projected'
}

interface Props {
  segments: MoonSegment[]
  /** The number at the centre of the moon. */
  centerValue: number
  centerLabel: string
  size?: number
  onSelect?: (segment: MoonSegment | null) => void
}

const TONE = {
  free: { stroke: 'var(--frost)', opacity: 1, glow: true, dash: undefined as string | undefined },
  protected: { stroke: 'var(--moon-dim)', opacity: 0.85, glow: false, dash: undefined },
  projected: { stroke: 'var(--lunar-violet)', opacity: 0.4, glow: false, dash: '1.5 4' },
}

export function MoonRing({ segments, centerValue, centerLabel, size = 248, onSelect }: Props) {
  const uid = useId().replace(/:/g, '')
  const [selected, setSelected] = useState<string | null>(null)

  const radius = 42
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const visible = segments.filter((s) => s.value > 0)
  const gap = visible.length > 1 ? 2.4 : 0

  let offset = 0
  const arcs = visible.map((seg) => {
    const fraction = total > 0 ? seg.value / total : 0
    const length = Math.max(0, fraction * circumference - gap)
    const arc = { seg, length, offset }
    offset += fraction * circumference
    return arc
  })

  const active = segments.find((s) => s.id === selected) ?? null

  const pick = (seg: MoonSegment | null) => {
    const next = seg && seg.id === selected ? null : seg
    setSelected(next?.id ?? null)
    onSelect?.(next)
  }

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <defs>
          <radialGradient id={`core-${uid}`} cx="42%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#dfeaf4" stopOpacity="0.24" />
            <stop offset="58%" stopColor="#8fb0cc" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#0b0f1c" stopOpacity="0" />
          </radialGradient>
          <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The moon itself */}
        <circle cx="50" cy="50" r="33" fill={`url(#core-${uid})`} />
        <circle cx="50" cy="50" r="33" fill="none" stroke="var(--hairline)" strokeWidth="0.4" />

        {/* Tick marks, like a measuring instrument */}
        <g opacity="0.3">
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i / 48) * Math.PI * 2
            const inner = 47.4
            const outer = i % 4 === 0 ? 49.4 : 48.4
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * inner}
                y1={50 + Math.sin(a) * inner}
                x2={50 + Math.cos(a) * outer}
                y2={50 + Math.sin(a) * outer}
                stroke="var(--moon-faint)"
                strokeWidth="0.28"
              />
            )
          })}
        </g>

        {/* Unlit track */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="rgba(169,213,232,0.09)" strokeWidth="5"
        />

        {/* Allocations */}
        {arcs.map(({ seg, length, offset: o }) => {
          const tone = TONE[seg.tone]
          const dimmed = selected !== null && selected !== seg.id
          return (
            <circle
              key={seg.id}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={tone.stroke}
              strokeWidth={selected === seg.id ? 7 : 5}
              strokeLinecap="round"
              strokeDashoffset={tone.dash ? 0 : -o}
              opacity={dimmed ? tone.opacity * 0.32 : tone.opacity}
              filter={tone.glow ? `url(#glow-${uid})` : undefined}
              className="cursor-pointer transition-[stroke-dasharray,stroke-width,opacity] duration-700 ease-lunar"
              style={{ strokeDasharray: tone.dash ? tone.dash : `${length} ${circumference}` }}
              onClick={() => pick(seg)}
              role="button"
              tabIndex={0}
              aria-label={`${seg.label}: ${seg.detail}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  pick(seg)
                }
              }}
            />
          )
        })}
      </svg>

      {/* Centre readout */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {active ? (
          <div key={active.id} className="rise px-8">
            <div className="font-display text-[15px] leading-tight text-moon">{active.label}</div>
            <div className="num mt-2 font-display text-[34px] leading-none text-moon">{Math.round(active.value)}</div>
            <div className="mt-2 text-[11px] leading-snug text-moon-dim">{active.detail}</div>
          </div>
        ) : (
          <div key="total" className="rise">
            <div className="num font-display text-[54px] leading-none text-moon">{Math.round(centerValue)}</div>
            <div className="eyebrow mt-2">{centerLabel}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Legend that reads as a sentence rather than a chart key. */
export function MoonLegend({ segments, className }: { segments: MoonSegment[]; className?: string }) {
  const visible = segments.filter((s) => s.value > 0)
  return (
    <ul className={clsx('flex flex-wrap items-center justify-center gap-x-5 gap-y-2', className)}>
      {visible.map((s) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-[3px] w-5 rounded-full"
            style={{
              background: TONE[s.tone].stroke,
              opacity: TONE[s.tone].opacity,
              boxShadow: TONE[s.tone].glow ? '0 0 10px var(--frost)' : undefined,
            }}
          />
          <span className="num text-[13px] text-moon">{Math.round(s.value)}</span>
          <span className="text-[13px] text-moon-dim">{s.label.toLowerCase()}</span>
        </li>
      ))}
    </ul>
  )
}
