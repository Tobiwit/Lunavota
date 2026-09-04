import type { Affordability, TargetPlan } from '@/types'
import { PriorityGlyph, priorityAccent } from '@/components/ui/PriorityGlyph'

/**
 * Fate Threads.
 *
 * Ambient, not analytical: light running from the pool you hold today toward
 * the people you are holding it for. A thread that cannot be honoured frays.
 */

const THREAD_STYLE: Record<Affordability, { opacity: number; dash?: string; width: number }> = {
  guaranteed: { opacity: 0.85, width: 1.5 },
  likely: { opacity: 0.6, width: 1.2 },
  'at-risk': { opacity: 0.42, dash: '5 4', width: 1 },
  unfunded: { opacity: 0.22, dash: '2 6', width: 0.9 },
}

interface Props {
  plans: TargetPlan[]
  onSelect?: (plan: TargetPlan) => void
}

/** Feeds the CSS draw keyframe the path length it animates across. */
function threadLength(length: number): React.CSSProperties {
  return { '--thread-len': String(length) } as React.CSSProperties
}

export function FateThreads({ plans, onSelect }: Props) {
  const shown = plans.slice(0, 4)
  if (shown.length === 0) return null

  const rowHeight = 46
  const height = shown.length * rowHeight
  const originY = height / 2

  return (
    <div className="relative">
      <svg
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full"
        width="72"
        height={height}
        viewBox={`0 0 72 ${height}`}
        preserveAspectRatio="none"
      >
        {/* The pool, as a point of light. */}
        <circle cx="6" cy={originY} r="3" fill="var(--frost)" opacity="0.9" />
        <circle cx="6" cy={originY} r="7" fill="none" stroke="var(--frost)" strokeOpacity="0.25" strokeWidth="0.7" />

        {shown.map((plan, i) => {
          const y = i * rowHeight + rowHeight / 2
          const style = THREAD_STYLE[plan.status]
          const d = `M 6 ${originY} C 32 ${originY}, 40 ${y}, 68 ${y}`
          return (
            <path
              key={plan.target.id}
              d={d}
              fill="none"
              stroke={priorityAccent(plan.target.priority)}
              strokeWidth={style.width}
              strokeOpacity={style.opacity}
              strokeLinecap="round"
              className={style.dash ? undefined : 'draw'}
              style={
                style.dash
                  ? { strokeDasharray: style.dash }
                  : { ...threadLength(140), animationDelay: `${i * 80}ms` }
              }
            />
          )
        })}
      </svg>

      <ul className="relative ml-[72px]">
        {shown.map((plan) => (
          <li key={plan.target.id} style={{ height: rowHeight }} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect?.(plan)}
              className="flex w-full items-center justify-between gap-3 rounded-lg py-1 pr-1 text-left transition-colors hover:bg-[rgba(169,213,232,0.05)]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PriorityGlyph priority={plan.target.priority} size={12} />
                <span className="truncate font-display text-[15px] text-moon">
                  {plan.character.displayName}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="num text-[14px] text-moon-muted">{plan.reserved}</span>
                <span className="ml-1 text-[12px] text-moon-dim">
                  {plan.status === 'unfunded' ? 'short' : 'reserved'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
