import { useMemo, useState } from 'react'
import { Screen } from '@/components/ui/Screen'
import { LunarTimeline } from '@/components/timeline/LunarTimeline'
import { Sheet } from '@/components/ui/Sheet'
import { Segmented, EmptyState } from '@/components/ui/controls'
import { TargetDetailSheet } from '@/components/wishlist/TargetDetailSheet'
import { PriorityGlyph } from '@/components/ui/PriorityGlyph'
import { CharacterArt } from '@/components/character/CharacterArt'
import { useBudget, useForecast, useTimeline } from '@/store/selectors'
import { useStore } from '@/store/useStore'
import {
  beyondHorizon,
  filterTimeline,
  isVersionHeader,
  type TimelineFilter,
  type TimelineNode,
} from '@/engine/timeline'
import { formatDay, formatRange, today } from '@/lib/date'
import type { TargetPlan } from '@/types'

export function TimelineScreen() {
  const nodes = useTimeline()
  const budget = useBudget()
  const curve = useForecast()
  const ignoreFutureIncome = useStore((s) => s.user.ignoreFutureIncome)

  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [showPast, setShowPast] = useState(false)
  const [detailNode, setDetailNode] = useState<TimelineNode | null>(null)
  const [targetDetail, setTargetDetail] = useState<TargetPlan | null>(null)

  const now = today()

  const visible = useMemo(() => {
    const filtered = filterTimeline(nodes, filter)
    return showPast ? filtered : filtered.filter((n) => !n.past || n.kind === 'today')
  }, [nodes, filter, showPast])

  const pastCount = nodes.filter((n) => n.past && n.kind !== 'today').length
  const unplaced = beyondHorizon(budget)

  const openNode = (node: TimelineNode) => {
    if (node.kind === 'banner' && node.plan) {
      setTargetDetail(node.plan)
      return
    }
    // Versions expand in place; only standalone rewards open a sheet.
    if (isVersionHeader(node)) return
    setDetailNode(node)
  }

  return (
    <Screen
      atmosphere="timeline"
      eyebrow="Future"
      title="Timeline"
      lede={
        ignoreFutureIncome
          ? 'Future income is switched off, so this shows only what you already hold.'
          : 'Your resources, travelling forward through the version calendar.'
      }
    >
      <div className="mb-6">
        <Segmented
          label="Timeline filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'characters', label: 'Characters' },
            { value: 'rewards', label: 'Rewards' },
            { value: 'versions', label: 'Versions' },
          ]}
        />
      </div>

      {pastCount > 0 && (
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="mb-4 text-[12px] text-frost/80 underline-offset-4 hover:underline"
        >
          {showPast ? 'Hide' : 'Show'} {pastCount} earlier {pastCount === 1 ? 'event' : 'events'}
        </button>
      )}

      {visible.length <= 1 ? (
        <EmptyState
          title="Nothing scheduled"
          body="Version dates and income live in the admin catalogue. Once they are in, your whole forecast appears here."
        />
      ) : (
        <LunarTimeline nodes={visible} onSelectNode={openNode} />
      )}

      {/* ---- Beyond the horizon --------------------------------------- */}
      {unplaced.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 text-center">
            <h2 className="font-display text-[20px] tracking-wide2 text-moon-muted">Beyond the horizon</h2>
            <p className="mx-auto mt-1.5 max-w-[38ch] text-[12.5px] leading-relaxed text-moon-dim">
              You want these characters, but nobody credibly knows when they arrive. They are not costed into your
              forecast until they have a placement.
            </p>
          </div>

          <ul className="space-y-2.5">
            {unplaced.map((plan) => (
              <li key={plan.target.id}>
                <button
                  type="button"
                  onClick={() => setTargetDetail(plan)}
                  className="panel flex w-full items-center gap-3.5 px-4 py-3 text-left opacity-80 transition-opacity hover:opacity-100"
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--hairline)]">
                    <CharacterArt character={plan.character} variant="thumb" className="h-full w-full rounded-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[17px] text-moon">
                      {plan.character.displayName}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <PriorityGlyph priority={plan.target.priority} size={10} />
                      <span className="text-[11.5px] text-moon-dim">Timing unknown</span>
                    </span>
                  </span>
                  <span className="shrink-0 num text-[11.5px] text-moon-faint">
                    {plan.plannedCost} needed
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Node detail ---------------------------------------------- */}
      <Sheet
        open={Boolean(detailNode)}
        onClose={() => setDetailNode(null)}
        eyebrow={detailNode ? nodeDate(detailNode) : undefined}
        title={detailNode?.title}
      >
        {detailNode && (
          <div className="space-y-5">
            {detailNode.amount != null && (
              <div className="panel-flat flex items-baseline justify-between px-4 py-3.5">
                <span className="eyebrow">Expected</span>
                <span className="num font-display text-[26px] text-frost">
                  +{Math.round(detailNode.amount)} wishes
                </span>
              </div>
            )}

            {detailNode.breakdown && detailNode.breakdown.length > 0 && (
              <div>
                <p className="eyebrow mb-2.5">What makes this up</p>
                <ul className="space-y-2">
                  {detailNode.breakdown.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] pb-2 text-[13px] last:border-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-moon-muted">{p.label}</span>
                        {p.detail && <span className="block text-[11.5px] text-moon-faint">{p.detail}</span>}
                      </span>
                      <span className="num shrink-0 text-moon">+{p.amount.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="panel-flat flex items-baseline justify-between px-4 py-3.5">
              <span className="eyebrow">Balance after</span>
              <span className="num font-display text-[22px] text-moon">
                {Math.round(curve.balanceAt(detailNode.endDate ?? detailNode.date))}
              </span>
            </div>

            <p className="text-[12.5px] leading-relaxed text-moon-dim">
              These figures come from your income profile — how much of a version you usually finish, your endgame
              clears, and whether Welkin or the Battle Pass are running. Change them in Settings and this updates.
            </p>
          </div>
        )}
      </Sheet>

      <TargetDetailSheet plan={targetDetail} onClose={() => setTargetDetail(null)} />

      <p className="mt-10 text-center text-[11.5px] leading-relaxed text-moon-faint">
        Forecast from {formatDay(now)}. Predicted banner timings are community estimates, never announcements.
      </p>
    </Screen>
  )
}

function nodeDate(node: TimelineNode): string {
  return node.endDate && node.endDate !== node.date
    ? formatRange(node.date, node.endDate)
    : formatDay(node.date)
}
