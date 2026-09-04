import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Screen } from '@/components/ui/Screen'
import { MoonLegend, MoonRing, type MoonSegment } from '@/components/moon/MoonRing'
import { FateThreads } from '@/components/moon/FateThread'
import { CharacterArt } from '@/components/character/CharacterArt'
import { PriorityGlyph, PRIORITY_LABEL } from '@/components/ui/PriorityGlyph'
import { AffordabilityBadge, CountUp, PredictionChip, RangeValue } from '@/components/ui/status'
import { SectionTitle, Why } from '@/components/ui/controls'
import { PlusIcon, SparkIcon } from '@/components/ui/icons'
import { useStore } from '@/store/useStore'
import { useBudget, useForecast, useLiveVersion } from '@/store/selectors'
import { AddWishesSheet } from '@/components/moon/AddWishesSheet'
import { LogPullSheet } from '@/components/moon/LogPullSheet'
import { ScenarioSheet } from '@/components/scenario/ScenarioSheet'
import { TargetDetailSheet } from '@/components/wishlist/TargetDetailSheet'
import { versionIncomeSummary } from '@/engine/forecast'
import { PLANNING_MODE_LABEL } from '@/engine/planning'
import { HARD_PITY } from '@/engine/wish'
import { daysBetween, formatDay, relativeDays, today } from '@/lib/date'
import { formatChance } from '@/lib/format'
import type { Budget, PlanningMode, TargetPlan } from '@/types'

export function MoonScreen() {
  const user = useStore((s) => s.user)
  const budget = useBudget()
  const curve = useForecast()
  const liveVersion = useLiveVersion()

  const [sheet, setSheet] = useState<'none' | 'wishes' | 'pull' | 'scenario'>('none')
  const [detail, setDetail] = useState<TargetPlan | null>(null)

  const next = budget.nextPlan
  const now = today()

  /** Projected income is shown as a third, dimmer allocation - never merged in. */
  const projected = useMemo(() => {
    const horizon = next?.prediction?.date
    if (!horizon || user.ignoreFutureIncome) return 0
    return Math.max(0, curve.balanceAt(horizon) - budget.ownedWishes)
  }, [curve, next, budget.ownedWishes, user.ignoreFutureIncome])

  const segments: MoonSegment[] = useMemo(() => {
    const list: MoonSegment[] = [
      {
        id: 'free',
        value: budget.free,
        label: 'Free',
        detail: 'Safe to spend right now',
        tone: 'free',
      },
    ]
    if (budget.protectedWishes > 0) {
      const holders = budget.plans
        .filter((p) => p.reservedFromPool > 0)
        .slice(0, 2)
        .map((p) => p.character.displayName)
      list.push({
        id: 'protected',
        value: budget.protectedWishes,
        label: 'Protected',
        detail: holders.length ? `Held for ${holders.join(' and ')}` : 'Held for your roadmap',
        tone: 'protected',
      })
    }
    if (projected > 0.5) {
      list.push({
        id: 'projected',
        value: projected,
        label: 'Projected',
        detail: next?.prediction ? `Expected before ${next.prediction.versionName}` : 'Expected before your next banner',
        tone: 'projected',
      })
    }
    return list
  }, [budget, projected, next])

  return (
    <Screen atmosphere="moon" eyebrow="Your moon" title={greeting()}>
      {/* ---- Wish pool ------------------------------------------------ */}
      <section aria-label="Wish pool" className="mb-2">
        <MoonRing
          segments={segments}
          centerValue={budget.ownedWishes}
          centerLabel="wishes available"
          size={264}
        />
        {budget.plans.length > 0 && <MoonLegend segments={segments} className="mt-4" />}
      </section>

      {/* ---- The number that matters ---------------------------------- */}
      <section className="mb-8 mt-7 text-center">
        <div className="rise rise-slow rise-d2">
          {/* With nothing planned, every wish is free and the figure above already
              says so. Repeating it three times would only dilute it. */}
          {budget.plans.length === 0 ? (
            <>
              <p className="mx-auto max-w-[30ch] text-balance font-display text-[21px] leading-snug text-moon">
                All of it is yours to spend.
              </p>
              <p className="mx-auto mt-2.5 max-w-[36ch] text-[13px] leading-relaxed text-moon-dim">
                Nothing is held back, because nothing is planned yet. Add the characters you are saving for and this
                number will start telling you something.
              </p>
            </>
          ) : (
            <>
              <div
                className="num text-[64px] leading-[0.95] text-moon"
                style={{ textShadow: '0 0 44px rgba(169,213,232,0.45)' }}
              >
                <CountUp value={budget.free} />
              </div>
              <p className="mt-2 font-display text-[17px] tracking-wide2 text-frost">safe to spend</p>
              <p className="mx-auto mt-2.5 max-w-[36ch] text-[13px] leading-relaxed text-moon-dim">
                {spendSentence(budget, user.planningMode)}
              </p>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-center">
          {budget.plans.length > 0 && (
          <Why label="Why this number?">
            <p>
              You hold <strong className="text-moon">{budget.ownedWishes}</strong> wishes
              {budget.ownedFromPrimos > 0 && (
                <> — {budget.ownedFates} Intertwined Fates and {budget.ownedFromPrimos} from your Primogems</>
              )}
              .
            </p>
            {budget.plans.length === 0 ? (
              <p className="mt-2">
                Nothing is on your roadmap yet, so nothing is held back. Add a character and this number will change.
              </p>
            ) : (
              <>
                <p className="mt-2">
                  In <strong className="text-moon">{PLANNING_MODE_LABEL[user.planningMode]}</strong> mode, these
                  targets draw on the wishes you hold today:
                </p>
                <ul className="mt-2 space-y-1">
                  {budget.plans
                    .filter((p) => p.reservedFromPool > 0)
                    .map((p) => (
                      <li key={p.target.id} className="flex justify-between gap-3">
                        <span>
                          {p.character.displayName} · {PRIORITY_LABEL[p.target.priority]}
                        </span>
                        <span className="num text-moon">{p.reservedFromPool}</span>
                      </li>
                    ))}
                  <li className="flex justify-between gap-3 border-t border-[var(--hairline)] pt-1.5">
                    <span>Left over</span>
                    <span className="num text-frost">{budget.free}</span>
                  </li>
                </ul>
                {!user.ignoreFutureIncome && (
                  <p className="mt-2.5 text-moon-dim">
                    Targets further out lean on wishes you have not earned yet, so they hold back less of your pool.
                  </p>
                )}
                <p className="mt-2 text-moon-dim">
                  Interested and Luxury targets never hold back wishes you already have — by definition they are for
                  what is left over.
                </p>
              </>
            )}
          </Why>
          )}
        </div>
      </section>

      {/* ---- Quick actions -------------------------------------------- */}
      <section className="mb-9 grid grid-cols-2 gap-2.5">
        <button type="button" className="btn btn-quiet" onClick={() => setSheet('wishes')}>
          <PlusIcon size={16} /> Wishes
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setSheet('pull')}>
          Log pull
        </button>
        <button type="button" className="btn btn-primary col-span-2" onClick={() => setSheet('scenario')}>
          <SparkIcon size={17} /> What if I pull?
        </button>
      </section>

      {/* ---- Next target ---------------------------------------------- */}
      {next ? (
        <section className="mb-9">
          <SectionTitle>Next on your roadmap</SectionTitle>
          <button
            type="button"
            onClick={() => setDetail(next)}
            className="panel group relative block w-full overflow-hidden text-left"
          >
            <div className="flex gap-4 p-4">
              <div className="relative h-[112px] w-[86px] shrink-0 overflow-hidden rounded-2xl border border-[var(--hairline)]">
                <CharacterArt character={next.character} variant="card" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[24px] leading-tight text-moon">
                  {next.character.displayName}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <PriorityGlyph priority={next.target.priority} size={12} />
                    <span className="text-[12px] uppercase tracking-wide2 text-moon-muted">
                      {PRIORITY_LABEL[next.target.priority]}
                    </span>
                  </span>
                  <span className="text-[12px] text-moon-dim">C{next.target.constellationTarget}</span>
                </div>

                <div className="mt-3">
                  <PredictionChip prediction={next.prediction} />
                </div>

                <div className="mt-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <AffordabilityBadge status={next.status} />
                  <span className="text-[12px] text-moon-dim">
                    · {next.reserved} of {next.plannedCost} set aside
                  </span>
                  <span className="text-[12px] text-moon-dim">
                    · <span className="num text-moon-muted">{formatChance(next.successChance)}</span> chance
                  </span>
                </div>
              </div>
            </div>

            <div className="rule" />

            <p className="px-4 py-3.5 text-[13.5px] leading-relaxed text-moon-muted">
              {fundingSentence(next, now)}
            </p>
          </button>

          {/* A gentle sense of distance rather than a countdown. */}
          {next.prediction?.date && (
            <div className="mt-3 flex items-center gap-3 px-1">
              <span className="text-[11px] uppercase tracking-wide2 text-moon-faint">Now</span>
              <span className="relative h-px flex-1" style={{ background: 'var(--hairline-strong)' }}>
                <span
                  className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                  style={{ background: 'var(--frost)', boxShadow: '0 0 10px var(--frost)' }}
                />
              </span>
              <span className="text-[11px] uppercase tracking-wide2 text-moon-muted">
                {next.character.displayName}
              </span>
            </div>
          )}
        </section>
      ) : (
        <section className="mb-9">
          <SectionTitle>Next on your roadmap</SectionTitle>
          <div className="panel px-5 py-7 text-center">
            <p className="font-display text-[19px] text-moon">Your sky is empty</p>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13px] leading-relaxed text-moon-dim">
              Add the characters you are actually saving for, and Lunavota will work out what you can spend.
            </p>
            <Link to="/wishlist" className="btn btn-primary mt-5">
              <PlusIcon size={16} /> Add a character
            </Link>
          </div>
        </section>
      )}

      {/* ---- Fate threads --------------------------------------------- */}
      {budget.plans.length > 1 && (
        <section className="mb-9">
          <SectionTitle
            action={
              <Link to="/wishlist" className="text-[12px] text-frost/80 underline-offset-4 hover:underline">
                All {budget.plans.length}
              </Link>
            }
          >
            Where your wishes are going
          </SectionTitle>
          <div className="panel px-4 py-3">
            <FateThreads plans={budget.plans} onSelect={setDetail} />
          </div>
        </section>
      )}

      {/* ---- Live version --------------------------------------------- */}
      {liveVersion && (
        <section className="mb-4">
          <SectionTitle
            action={
              <Link to="/timeline" className="text-[12px] text-frost/80 underline-offset-4 hover:underline">
                Timeline
              </Link>
            }
          >
            Current version
          </SectionTitle>
          {(() => {
            const summary = versionIncomeSummary(curve, liveVersion, now)
            const day = daysBetween(liveVersion.startDate, now) + 1
            const total = daysBetween(liveVersion.startDate, liveVersion.endDate) + 1
            const range = curve.balanceRangeAt(liveVersion.endDate)
            return (
              <div className="panel px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-[22px] text-moon">{liveVersion.name}</h3>
                  <span className="num text-[12px] text-moon-dim">
                    Day {day} / {total}
                  </span>
                </div>

                <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-[rgba(169,213,232,0.12)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-lunar"
                    style={{
                      background: 'var(--frost)',
                      boxShadow: '0 0 10px var(--frost)',
                      width: `${Math.min(100, (day / total) * 100)}%`,
                    }}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="eyebrow">Still to earn</dt>
                    <dd className="num mt-1 font-display text-[20px] text-moon">
                      +{Math.round(summary.remaining)}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">By version end</dt>
                    <dd className="num mt-1 font-display text-[20px] text-moon">
                      <RangeValue low={range.low} high={range.high} />
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Ends</dt>
                    <dd className="mt-1 font-display text-[20px] text-moon">
                      {formatDay(liveVersion.endDate)}
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })()}
        </section>
      )}

      {/* ---- Pity strip ------------------------------------------------ */}
      <section className="panel flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="eyebrow">Character banner</p>
          <p className="mt-1.5 text-[14px] text-moon">
            <span className="num">{user.characterPity}</span>
            <span className="text-moon-dim"> / {HARD_PITY} pity</span>
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">50/50</p>
          <p className="mt-1.5 text-[14px]" style={{ color: user.characterGuaranteed ? 'var(--success)' : 'var(--moon)' }}>
            {user.characterGuaranteed ? 'Guaranteed' : 'Not guaranteed'}
          </p>
        </div>
      </section>

      <AddWishesSheet open={sheet === 'wishes'} onClose={() => setSheet('none')} />
      <LogPullSheet open={sheet === 'pull'} onClose={() => setSheet('none')} />
      <ScenarioSheet open={sheet === 'scenario'} onClose={() => setSheet('none')} />
      <TargetDetailSheet plan={detail} onClose={() => setDetail(null)} />
    </Screen>
  )
}

/* ------------------------------------------------------------------ */

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Still awake'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function spendSentence(budget: Budget, mode: PlanningMode): string {
  const { free, protectedWishes } = budget
  if (free === 0 && protectedWishes === 0) return 'Nothing is held back, because nothing is planned yet.'

  const holder = budget.plans.find((p) => p.reservedFromPool > 0)
  if (free === 0) {
    // Measured against the plan's own target, so it agrees with every card.
    const short = holder ? Math.max(0, holder.plannedCost - holder.reserved) : 0
    if (holder && short > 0) {
      return `Every wish you hold is spoken for, and ${holder.character.displayName} is still ${short} short of plan.`
    }
    return `Every wish you hold is reserved${holder ? ` for ${holder.character.displayName}` : ''}.`
  }
  if (protectedWishes === 0) {
    return mode === 'safe'
      ? 'Nothing on your roadmap needs your current wishes — future income covers it.'
      : 'Nothing on your roadmap needs protecting right now.'
  }
  return `You can spend this much without putting ${holder?.character.displayName ?? 'your roadmap'} at risk.`
}

function fundingSentence(plan: TargetPlan, now: string): string {
  const name = plan.character.displayName
  if (plan.status === 'guaranteed') {
    return `You are fully funded. Even the worst possible run reaches ${name} at C${plan.target.constellationTarget}.`
  }

  const short = Math.max(0, plan.plannedCost - plan.reserved)
  if (plan.fundedDate && plan.prediction?.date) {
    const gap = daysBetween(plan.fundedDate, plan.prediction.date)
    if (gap >= 0) {
      return `On track. You should reach a full guarantee around ${formatDay(plan.fundedDate)}, ${gap} days before the banner.`
    }
    return `The banner is expected to open ${-gap} days before you are fully guaranteed — around ${formatDay(plan.fundedDate)}.`
  }

  if (plan.status === 'likely') {
    return `Well funded on an ordinary run, though ${short} more wishes would make ${name} certain.`
  }
  if (plan.status === 'at-risk') {
    return `Possible, but a bad run would cost you something else. ${short} more wishes would settle it.`
  }
  return `${short} more wishes are needed to guarantee ${name}${plan.prediction?.date ? `, and the banner is ${relativeDays(now, plan.prediction.date)}` : ''}.`
}
