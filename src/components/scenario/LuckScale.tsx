import { useCallback, useRef } from 'react'
import clsx from 'clsx'
import type { ChainPreset } from '@/engine/chain'

/**
 * How the whole run goes, as one thing you drag.
 *
 * Five labelled cells rather than a bare track, because each stop is a scenario
 * with a name, not a position on a line. The highlight is what moves, and it can
 * be dragged straight across them.
 *
 * It has a genuinely empty state: once any individual dial or 50/50 is set by
 * hand, none of the five is true any more, so nothing is highlighted.
 */

export interface LuckOption {
  id: ChainPreset
  label: string
  /** ESTIMATED. How often a run comes in at this total or under. */
  chanceLabel: string
}

interface Props {
  value: ChainPreset | null
  options: LuckOption[]
  onChange: (preset: ChainPreset) => void
}

export function LuckScale({ value, options, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const index = value ? options.findIndex((o) => o.id === value) : -1

  const pick = useCallback(
    (clientX: number) => {
      const el = ref.current
      if (!el || options.length === 0) return
      const rect = el.getBoundingClientRect()
      const ratio = (clientX - rect.left) / rect.width
      const next = Math.max(0, Math.min(options.length - 1, Math.floor(ratio * options.length)))
      const option = options[next]
      if (option && option.id !== value) onChange(option.id)
    },
    [onChange, options, value],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index < 0 ? -1 : index) + 1
    if (e.key === 'ArrowLeft') next = (index < 0 ? options.length : index) - 1
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = options.length - 1
    if (next == null) return
    e.preventDefault()
    const option = options[Math.max(0, Math.min(options.length - 1, next))]
    if (option) onChange(option.id)
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="How the run goes"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pick(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0) return
        pick(e.clientX)
      }}
      className="relative flex touch-none select-none rounded-2xl border border-[var(--hairline)] bg-[rgba(8,12,22,0.55)] p-1 outline-none"
    >
      {/* The highlight, not the labels, is what travels. */}
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute bottom-1 top-1 rounded-xl border transition-[left,opacity] duration-300 ease-lunar',
          index < 0 && 'opacity-0',
        )}
        style={{
          left: `calc(${Math.max(0, index) * (100 / options.length)}% + 4px)`,
          width: `calc(${100 / options.length}% - 8px)`,
          borderColor: 'rgba(169,213,232,0.45)',
          background: 'rgba(169,213,232,0.13)',
          boxShadow: index < 0 ? 'none' : '0 0 22px -10px var(--frost)',
        }}
      />

      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={-1}
            onClick={() => onChange(option.id)}
            className="relative flex-1 px-1 py-2 text-center"
          >
            <span
              className={clsx(
                'block text-[10.5px] leading-tight transition-colors',
                active ? 'text-moon' : 'text-moon-dim',
              )}
            >
              {option.label}
            </span>
            <span
              className={clsx(
                'num mt-0.5 block text-[9.5px] leading-none transition-colors',
                active ? 'text-frost/80' : 'text-moon-faint',
              )}
            >
              {option.chanceLabel}
            </span>
          </button>
        )
      })}
    </div>
  )
}
