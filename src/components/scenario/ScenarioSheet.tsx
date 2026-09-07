import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/controls'
import { PullDial } from './PullDial'
import { PriorityGlyph, PRIORITY_LABEL, priorityAccent } from '@/components/ui/PriorityGlyph'
import { useStore } from '@/store/useStore'
import { useBudget, useForecast } from '@/store/selectors'
import { runChain, summariseChain, type ChainNode } from '@/engine/chain'
import { spendWishes } from '@/engine/simulation'
import { formatChance } from '@/lib/format'
import { formatDay, today } from '@/lib/date'

/**
 * Scenario planner.
 *
 * A chain, not a single banner: every planned character in the order they
 * arrive, each with a dial for what it costs and a 50/50 assumption. Turning one
 * dial re-walks everything below it, because that is the actual question — not
 * "can I afford Mitya" but "who pays for Mitya".
 *
 * Entirely non-destructive. Nothing here writes to the store until the footer
 * action is used, and that only ever commits the banner running right now.
 */

const THREAD_X = 48

export function ScenarioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const markAcquired = useStore((s) => s.markAcquired)
  const budget = useBudget()
  const curve = useForecast()
  const now = today()

  /** On: every dial follows the model. Off: the numbers are yours. */
  const [typicalRun, setTypicalRun] = useState(true)
  const [pulls, setPulls] = useState<Record<string, number>>({})
  const [wins, setWins] = useState<Record<string, boolean>>({})

  const plans = useMemo(
    () => budget.plans.filter((p) => !p.timingUnknown && p.prediction?.date),
    [budget.plans],
  )

  const chain = useMemo(
    () =>
      runChain({
        now,
        user,
        plans,
        curve,
        assumptionFor: (id) => ({
          winFiftyFifty: wins[id] ?? true,
          pulls: typicalRun ? undefined : pulls[id],
        }),
      }),
    [now, user, plans, curve, wins, pulls, typicalRun],
  )

  const summary = useMemo(() => summariseChain(chain), [chain])

  /**
   * The first drag leaves the model behind, so freeze what is on screen before
   * applying it — otherwise every other dial would jump at the same moment.
   */
  const changePulls = (id: string, value: number) => {
    if (typicalRun) {
      const frozen: Record<string, number> = {}
      for (const node of chain) frozen[node.plan.target.id] = node.pulls
      frozen[id] = value
      setPulls(frozen)
      setTypicalRun(false)
      return
    }
    setPulls((prev) => ({ ...prev, [id]: value }))
  }

  const toggleWin = (id: string, next: boolean) => {
    setWins((prev) => ({ ...prev, [id]: next }))
    // The cost of this stop just changed shape, so drop a hand-set number rather
    // than leaving a value that meant something else a moment ago.
    setPulls((prev) => {
      const rest = { ...prev }
      delete rest[id]
      return rest
    })
  }

  // Only a banner that is actually running can be committed to real data.
  const liveNode = chain.find((n) => !n.skipped && (n.plan.prediction?.date ?? '') <= now)

  const apply = () => {
    if (!liveNode) return
    setUser({
      ...spendWishes(user, liveNode.pulls),
      characterPity: 0,
      characterGuaranteed: false,
      capturingRadianceState: 0,
    })
    markAcquired(liveNode.plan.target.id)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Simulation — nothing is saved yet"
      title="What if you pull?"
      footer={
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-quiet flex-1" onClick={onClose}>
            Done
          </button>
          {liveNode && (
            <button type="button" className="btn btn-primary flex-[2]" onClick={apply}>
              Apply {liveNode.plan.character.displayName}
            </button>
          )}
        </div>
      }
    >
      {chain.length === 0 ? (
        <p className="py-10 text-center text-[13px] leading-relaxed text-moon-dim">
          Nothing on your wishlist has a banner placement yet, so there is no order to pull them in. Add a character
          with a known or expected banner and this becomes a chain you can turn.
        </p>
      ) : (
        <>
          <div className="panel-flat mb-5 px-4">
            <Toggle
              checked={typicalRun}
              onChange={(v) => setTypicalRun(v)}
              label="Typical run"
              hint="Sets every dial to what each character usually costs. Turn a dial to take over."
            />
          </div>

          <div className="mb-5 flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-moon-dim">
              <span className="num text-moon">{budget.ownedWishes}</span> wishes now ·{' '}
              <span className="num text-moon">{summary.totalSpent}</span> spent across{' '}
              <span className="num text-moon">{summary.obtained}</span>
            </p>
          </div>

          <ol className="relative">
            {/* The same thread the timeline runs on. */}
            <span
              aria-hidden
              className="absolute top-4 bottom-4 w-px"
              style={{
                left: THREAD_X,
                background:
                  'linear-gradient(180deg, transparent, rgba(169,213,232,0.28) 8%, rgba(169,213,232,0.18) 70%, transparent)',
              }}
            />
            {chain.map((node) => (
              <ChainRow
                key={node.plan.target.id}
                node={node}
                onPulls={(v) => changePulls(node.plan.target.id, v)}
                onWin={(v) => toggleWin(node.plan.target.id, v)}
              />
            ))}
          </ol>

          {summary.firstShortfall && (
            <p className="mt-4 rounded-xl border border-[rgba(199,137,145,0.3)] bg-[rgba(199,137,145,0.07)] px-4 py-3 text-[12.5px] leading-relaxed text-danger">
              This plan runs out at {summary.firstShortfall.plan.character.displayName} — it needs{' '}
              <span className="num">{summary.firstShortfall.shortBy}</span> more wishes than you are forecast to
              have by then.
            </p>
          )}

          <p className="mt-5 text-[11.5px] leading-relaxed text-moon-faint">
            Each dial is what a character costs you, not a budget cap — so everyone on the chain is obtained, and the
            percentage is how often a run goes that well or better. Dial one to zero to skip that banner.
          </p>
        </>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

function ChainRow({
  node, onPulls, onWin,
}: {
  node: ChainNode
  onPulls: (value: number) => void
  onWin: (value: boolean) => void
}) {
  const { plan } = node
  const accent = priorityAccent(plan.target.priority)
  const short = node.shortBy > 0

  return (
    <li className="relative flex gap-4 pb-5">
      <PullDial
        character={plan.character}
        value={node.pulls}
        max={node.maxPulls}
        onChange={onPulls}
        accent={accent}
        muted={node.skipped}
        label={`Wishes spent on ${plan.character.displayName}`}
      />

      <div className="min-w-0 flex-1 pt-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate font-display text-[19px] leading-tight text-moon">
            {plan.character.displayName}
          </h3>
          <span className="shrink-0 text-[11px] text-moon-faint">{formatDay(node.date)}</span>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1.5">
            <PriorityGlyph priority={plan.target.priority} size={10} />
            <span className="text-[10.5px] uppercase tracking-wide2" style={{ color: accent }}>
              {PRIORITY_LABEL[plan.target.priority]}
            </span>
          </span>
          <span className="text-[11px] text-moon-dim">C{plan.target.constellationTarget}</span>
        </div>

        {node.skipped ? (
          <p className="mt-2.5 text-[13px] text-moon-dim">Skipped — nothing spent here.</p>
        ) : (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num text-[24px] leading-none text-moon">{node.pulls}</span>
              <span className="text-[12px] text-moon-dim">wishes</span>
              <span className="num ml-1 text-[13px]" style={{ color: accent }}>
                {formatChance(node.chance)}
              </span>
              <span className="text-[11.5px] text-moon-dim">of runs</span>
            </div>

            <p className={clsx('mt-1.5 text-[12px]', short ? 'text-danger' : 'text-moon-dim')}>
              {short ? (
                <>
                  <span className="num">{node.shortBy}</span> short of the{' '}
                  <span className="num">{node.available}</span> forecast here
                </>
              ) : (
                <>
                  <span className="num text-moon-muted">{node.balanceAfter}</span> left of{' '}
                  <span className="num text-moon-muted">{node.available}</span>
                </>
              )}
            </p>
          </>
        )}

        <div className="mt-2.5">
          {node.onGuarantee ? (
            <span className="chip text-[11px]" style={{ borderColor: 'rgba(169,205,189,0.35)', color: 'var(--success)' }}>
              Guaranteed — no 50/50
            </span>
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={node.winFiftyFifty}
              onClick={() => onWin(!node.winFiftyFifty)}
              className={clsx('chip text-[11px]', node.winFiftyFifty && 'chip-on')}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: node.winFiftyFifty ? 'var(--success)' : 'var(--danger)' }}
              />
              {node.winFiftyFifty ? 'Win the 50/50' : 'Lose the 50/50'}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
