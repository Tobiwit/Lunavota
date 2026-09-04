import { useMemo, useState } from 'react'
import { Screen } from '@/components/ui/Screen'
import { TargetCard } from '@/components/wishlist/TargetCard'
import { TargetDetailSheet } from '@/components/wishlist/TargetDetailSheet'
import { CharacterPicker } from '@/components/character/CharacterPicker'
import { PriorityGlyph, PRIORITY_LABEL } from '@/components/ui/PriorityGlyph'
import { EmptyState } from '@/components/ui/controls'
import { PlusIcon } from '@/components/ui/icons'
import { useStore } from '@/store/useStore'
import { useBudget } from '@/store/selectors'
import { PRIORITY_ORDER } from '@/engine/planning'
import type { Priority, TargetPlan } from '@/types'

export function WishlistScreen() {
  const budget = useBudget()
  const reorderTarget = useStore((s) => s.reorderTarget)
  const targets = useStore((s) => s.targets)

  const [picker, setPicker] = useState(false)
  const [detail, setDetail] = useState<TargetPlan | null>(null)

  const bands = useMemo(() => {
    const map = new Map<Priority, TargetPlan[]>()
    for (const p of PRIORITY_ORDER) map.set(p, [])
    for (const plan of budget.plans) {
      map.get(plan.target.priority)?.push(plan)
    }
    for (const [, list] of map) list.sort((a, b) => a.target.order - b.target.order)
    return map
  }, [budget.plans])

  const acquired = useMemo(
    () => targets.filter((t) => t.acquired && !t.archived),
    [targets],
  )

  const totalReserved = budget.plans.reduce((s, p) => s + p.reserved, 0)

  return (
    <Screen
      atmosphere="wishlist"
      eyebrow="Intent"
      title="Wishlist"
      lede={
        budget.plans.length > 0
          ? `${budget.plans.length} planned · ${totalReserved} wishes set aside`
          : undefined
      }
      action={
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(169,213,232,0.4)] bg-[rgba(169,213,232,0.12)] text-frost"
          aria-label="Add a character"
        >
          <PlusIcon size={18} />
        </button>
      }
    >
      {budget.plans.length === 0 ? (
        <EmptyState
          title="Nothing planned yet"
          body="Add the characters you are actually saving for. Lunavota works out what each one costs and how much of your pool has to stay untouched."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setPicker(true)}>
              <PlusIcon size={16} /> Add a character
            </button>
          }
        />
      ) : (
        <div className="space-y-9">
          {PRIORITY_ORDER.map((priority) => {
            const list = bands.get(priority) ?? []
            if (list.length === 0) return null
            return (
              <section key={priority}>
                <header className="mb-3 flex items-center gap-2.5">
                  <PriorityGlyph priority={priority} size={14} />
                  <h2 className="font-display text-[18px] tracking-wide2 text-moon">
                    {PRIORITY_LABEL[priority]}
                  </h2>
                  <span className="num text-[12px] text-moon-faint">{list.length}</span>
                </header>

                <div className="space-y-3">
                    {list.map((plan, i) => (
                      <TargetCard
                        key={plan.target.id}
                        plan={plan}
                        index={i}
                        onOpen={() => setDetail(plan)}
                        onMoveUp={i > 0 ? () => reorderTarget(plan.target.id, -1) : undefined}
                        onMoveDown={i < list.length - 1 ? () => reorderTarget(plan.target.id, 1) : undefined}
                      />
                    ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {acquired.length > 0 && (
        <section className="mt-11">
          <h2 className="eyebrow mb-3">Completed constellations</h2>
          <ul className="space-y-2">
            {acquired.map((t) => (
              <AcquiredRow key={t.id} targetId={t.id} />
            ))}
          </ul>
        </section>
      )}

      <CharacterPicker open={picker} onClose={() => setPicker(false)} />
      <TargetDetailSheet plan={detail} onClose={() => setDetail(null)} />
    </Screen>
  )
}

function AcquiredRow({ targetId }: { targetId: string }) {
  const target = useStore((s) => s.targets.find((t) => t.id === targetId))
  const character = useStore((s) => s.characters.find((c) => c.id === target?.characterId))
  const updateTarget = useStore((s) => s.updateTarget)
  if (!target || !character) return null

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[rgba(8,12,22,0.4)] px-4 py-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6" fill="var(--success)" fillOpacity="0.25" stroke="var(--success)" strokeWidth="1" />
        </svg>
        <span className="truncate text-[14px] text-moon-muted">{character.displayName}</span>
        <span className="shrink-0 text-[11.5px] text-moon-faint">C{target.constellationTarget}</span>
      </span>
      <button
        type="button"
        className="shrink-0 text-[12px] text-moon-dim underline-offset-4 hover:text-moon hover:underline"
        onClick={() => updateTarget(target.id, { acquired: false, acquiredAt: undefined })}
      >
        Undo
      </button>
    </li>
  )
}
