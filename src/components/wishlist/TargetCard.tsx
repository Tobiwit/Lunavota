import clsx from 'clsx'
import type { TargetPlan } from '@/types'
import { CharacterSplash } from '@/components/character/CharacterArt'
import { PriorityGlyph, PRIORITY_LABEL, priorityAccent } from '@/components/ui/PriorityGlyph'
import { AffordabilityBadge, PredictionChip } from '@/components/ui/status'
import { formatChance } from '@/lib/format'

/**
 * A piece of a celestial collection rather than a data row.
 *
 * Only what matters at a glance is shown: who, how badly, when, and whether the
 * plan currently covers it. Everything else lives in the detail sheet.
 */

interface Props {
  plan: TargetPlan
  onOpen: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  index?: number
}

export function TargetCard({ plan, onOpen, onMoveUp, onMoveDown, index = 0 }: Props) {
  const { target, character } = plan
  const accent = priorityAccent(target.priority)

  return (
    <article
      className="rise panel relative overflow-hidden"
      style={{ animationDelay: `${Math.min(index * 45, 220)}ms` }}
    >
      {/* A thin band of the priority's light down the leading edge. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 z-10 w-[2px]"
        style={{ background: `linear-gradient(180deg, transparent, ${accent}88, transparent)` }}
      />

      {/* The art is part of the card, not a thumbnail sitting next to it. */}
      <CharacterSplash character={character} className="-top-2 bottom-0 right-0 w-[62%]" />

      <button
        type="button"
        onClick={onOpen}
        className="relative flex min-h-[178px] w-full flex-col p-4 pr-[44%] text-left"
      >
        <h3 className="min-w-0 font-display text-[21px] leading-tight text-moon">
          {character.displayName}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <PriorityGlyph priority={target.priority} size={11} />
            <span className="text-[11px] uppercase tracking-wide2" style={{ color: accent }}>
              {PRIORITY_LABEL[target.priority]}
            </span>
          </span>
          <span className="text-[11.5px] text-moon-dim">
            C{target.constellationTarget}
            {target.signatureWeapon && ' · weapon'}
          </span>
          {/* Inline rather than in the corner: the corner is now artwork, and a
              small glyph there is unreadable over a bright splash. */}
          {!plan.timingUnknown && <AffordabilityBadge status={plan.status} showLabel={false} />}
        </div>

        <div className="mt-auto pt-3">
          <PredictionChip prediction={plan.prediction} className="text-[11px]" />
          {target.reasons.length > 0 && (
            <p className="mt-2 truncate text-[11.5px] text-moon-faint">
              {target.reasons.join(' · ')}
            </p>
          )}
        </div>
      </button>

      <div className="rule relative" />

      <footer className="relative flex items-center justify-between gap-3 px-3.5 py-2.5">
        {plan.timingUnknown ? (
          <p className="text-[11.5px] text-moon-dim">
            No known banner yet · <span className="num">{plan.plannedCost}</span> wishes when they appear
          </p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="num text-[15px] text-moon">{plan.reserved}</span>
            <span className="text-[11.5px] text-moon-dim">of {plan.plannedCost} set aside</span>
            <span className="text-[11.5px] text-moon-faint">·</span>
            <span
              className="num text-[12px]"
              style={{ color: plan.successChance >= 0.9995 ? 'var(--success)' : 'var(--moon-muted)' }}
            >
              {formatChance(plan.successChance)}
            </span>
            <span className="text-[11.5px] text-moon-dim">chance</span>
          </div>
        )}

        {(onMoveUp || onMoveDown) && (
          <div className="flex items-center gap-1">
            <ReorderButton direction="up" onClick={onMoveUp} />
            <ReorderButton direction="down" onClick={onMoveDown} />
          </div>
        )}
      </footer>

      {plan.skippedByRule && (
        <p className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11.5px] text-star">
          {plan.skippedByRule}
        </p>
      )}
    </article>
  )
}

function ReorderButton({ direction, onClick }: { direction: 'up' | 'down'; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={direction === 'up' ? 'Move up' : 'Move down'}
      className={clsx(
        'flex h-7 w-7 items-center justify-center rounded-full border border-[var(--hairline)] text-moon-dim transition-colors',
        onClick ? 'hover:text-moon' : 'opacity-25',
      )}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'up' ? <path d="M4 10l4-4 4 4" /> : <path d="M4 6l4 4 4-4" />}
      </svg>
    </button>
  )
}
