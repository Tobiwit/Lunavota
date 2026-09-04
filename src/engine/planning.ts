import type {
  Affordability,
  BannerPrediction,
  Budget,
  Character,
  ForecastCurve,
  GameVersion,
  PlanningMode,
  Priority,
  TargetCost,
  TargetPlan,
  UserWishState,
  WishTarget,
} from '@/types'
import {
  chanceWithin,
  fiveStarDistribution,
  limitedCharacterDistribution,
  meanOf,
  quantile,
  totalWishes,
  worstCaseCost,
  worstCaseToNextFiveStar,
  type BannerState,
} from './wish'
import { balanceForMode } from './forecast'
import { resolvePrediction } from './predictions'
import { today } from '@/lib/date'

/**
 * PlanningEngine.
 *
 * Answers the only question that matters on the Moon screen: how many of the
 * wishes I hold today are already spoken for, and how many are genuinely free?
 *
 * The allocation is greedy by priority. Future income is consumed *latest-first*
 * so that a distant Must target does not starve a nearer Want of income that
 * arrives long before the Must banner opens.
 */

export const PRIORITY_ORDER: Priority[] = ['must', 'want', 'interested', 'luxury']

const PRIORITY_RANK: Record<Priority, number> = {
  must: 0, want: 1, interested: 2, luxury: 3,
}

/**
 * Which priorities are allowed to hold back wishes the player already has.
 *
 * "Interested" is explicitly conditional and "Luxury" is explicitly for spare
 * resources - neither should ever be able to drive "safe to spend" toward zero.
 * They are still costed and still get an affordability status; they simply draw
 * on projected income rather than on the pool in hand.
 */
const PROTECTS_POOL: Record<Priority, boolean> = {
  must: true, want: true, interested: false, luxury: false,
}

export interface PlanningInput {
  now?: string
  user: UserWishState
  targets: WishTarget[]
  characters: Map<string, Character>
  predictions: BannerPrediction[]
  versions: GameVersion[]
  curve: ForecastCurve
}

interface IncomeSegment {
  date: string
  remaining: number
}

/* ------------------------------------------------------------------ */
/* Cost                                                                */
/* ------------------------------------------------------------------ */

export function costFor(target: WishTarget, state: BannerState): TargetCost {
  const copies = Math.max(1, target.constellationTarget + 1)
  const rule = target.pullRule?.kind

  // Rules that stop at the first 5-star budget only for that first 5-star.
  const stopsAtFirstFiveStar = rule === 'until-first-5star' || rule === 'stop-if-5050-lost'

  const dist = stopsAtFirstFiveStar
    ? fiveStarDistribution(state.pity)
    : limitedCharacterDistribution(state, copies)

  let worst = stopsAtFirstFiveStar
    ? worstCaseToNextFiveStar(state.pity)
    : worstCaseCost(state, copies)

  let likely = quantile(dist, 0.75)
  let median = quantile(dist, 0.5)
  let expected = meanOf(dist)

  // Hard caps shrink every tier - you simply stop spending.
  const caps: number[] = []
  if (target.maxPulls && target.maxPulls > 0) caps.push(target.maxPulls)
  if (rule === 'stop-after-x' && target.pullRule?.value) caps.push(target.pullRule.value)
  if (caps.length > 0) {
    const cap = Math.min(...caps)
    worst = Math.min(worst, cap)
    likely = Math.min(likely, cap)
    median = Math.min(median, cap)
    expected = Math.min(expected, cap)
  }

  const planned = target.lockedReservation ?? worst

  return {
    worstCase: Math.round(worst),
    likely: Math.round(likely),
    median: Math.round(median),
    expected: Math.round(expected),
    planned: Math.round(planned),
  }
}

/** The cost tier a planning mode reserves against. */
export function plannedCostFor(cost: TargetCost, mode: PlanningMode, locked?: number): number {
  if (locked != null) return locked
  if (mode === 'safe') return cost.worstCase
  if (mode === 'balanced') return cost.likely
  return cost.median
}

/* ------------------------------------------------------------------ */
/* The plan                                                            */
/* ------------------------------------------------------------------ */

export function buildPlan(input: PlanningInput): Budget {
  const now = input.now ?? today()
  const { user, curve, versions, predictions, characters } = input
  const mode = user.planningMode

  const ownedFates = Math.max(0, Math.floor(user.intertwinedFates))
  const ownedFromPrimos = Math.floor(
    (Math.max(0, user.primogems) + Math.max(0, user.genesisCrystals)) / 160,
  )
  const ownedWishes = ownedFates + ownedFromPrimos

  const active = input.targets
    .filter((t) => !t.acquired && !t.archived)
    .filter((t) => characters.has(t.characterId))

  // Resolve timing first - it drives both the pull order and the income window.
  const resolved = active.map((t) => ({
    target: t,
    prediction: resolvePrediction(t, predictions, versions),
  }))

  // Pull order is chronological: that is the order the banner state evolves in.
  const chronological = [...resolved].sort((a, b) => {
    const da = a.prediction?.date ?? '9999-12-31'
    const db = b.prediction?.date ?? '9999-12-31'
    if (da !== db) return da < db ? -1 : 1
    return PRIORITY_RANK[a.target.priority] - PRIORITY_RANK[b.target.priority]
  })

  // Chain the banner state forward. Only the first target inherits real pity;
  // after obtaining a limited 5-star, pity and guarantee both reset.
  const costs = new Map<string, TargetCost>()
  let state: BannerState = {
    pity: user.characterPity,
    guaranteed: user.characterGuaranteed,
    capturingRadianceState: user.capturingRadianceState ?? 0,
  }
  for (const { target } of chronological) {
    costs.set(target.id, costFor(target, state))
    state = { pity: 0, guaranteed: false, capturingRadianceState: 0 }
  }

  // Income segments, in the band this planning mode is allowed to lean on.
  const segments = buildIncomeSegments(curve, mode)

  // Allocate by priority; ties broken by date so nearer banners are funded first.
  const byPriority = [...resolved].sort((a, b) => {
    const r = PRIORITY_RANK[a.target.priority] - PRIORITY_RANK[b.target.priority]
    if (r !== 0) return r
    const da = a.prediction?.date ?? '9999-12-31'
    const db = b.prediction?.date ?? '9999-12-31'
    if (da !== db) return da < db ? -1 : 1
    return a.target.order - b.target.order
  })

  let poolRemaining = ownedWishes
  let cumulativeNeed = 0
  const plans: TargetPlan[] = []

  for (const { target, prediction } of byPriority) {
    const character = characters.get(target.characterId)!
    const cost = costs.get(target.id)!
    const need = plannedCostFor(cost, mode, target.lockedReservation)
    cumulativeNeed += need

    // A banner already underway is treated as happening now, not in the past.
    const bannerDate =
      prediction?.date && prediction.date < now ? now : prediction?.date
    const skipped = skipReason(target, prediction, byPriority, versions)

    // Draw from income that has already arrived by the banner, latest first.
    let outstanding = skipped ? 0 : need
    let fromIncome = 0
    if (bannerDate) {
      const eligible = segments
        .filter((s) => s.date <= bannerDate && s.remaining > 0)
        .sort((a, b) => (a.date > b.date ? -1 : 1))
      for (const seg of eligible) {
        if (outstanding <= 0) break
        const take = Math.min(seg.remaining, outstanding)
        seg.remaining -= take
        fromIncome += take
        outstanding -= take
      }
    }

    const fromPool = PROTECTS_POOL[target.priority] ? Math.min(poolRemaining, outstanding) : 0
    poolRemaining -= fromPool
    const allocated = fromIncome + fromPool

    const range = bannerDate
      ? curve.balanceRangeAt(bannerDate)
      : { low: ownedWishes, expected: ownedWishes, high: ownedWishes }
    const atEarliest = prediction?.earliest
      ? balanceForMode(curve, prediction.earliest.date, mode)
      : range.expected
    const atEnd = prediction?.endDate ? curve.balanceAt(prediction.endDate) : range.expected

    const dist = distributionFor(target, costs, chronological, user)

    plans.push({
      target,
      character,
      cost,
      reservedFromPool: fromPool,
      reservedFromIncome: fromIncome,
      reserved: allocated,
      balanceAtBanner: range.expected,
      balanceAtBannerLow: range.low,
      balanceAtBannerHigh: range.high,
      balanceAtEarliest: atEarliest,
      balanceAtBannerEnd: atEnd,
      incomeDuringBanner: Math.max(0, atEnd - range.expected),
      status: gradeAffordability(allocated, cost, skipped),
      shortfall: Math.max(0, need - allocated),
      fundedDate: curve.dateWhenBalanceReaches(cumulativeNeed),
      prediction,
      successChance: chanceWithin(dist, allocated),
      skippedByRule: skipped,
    })
  }

  const protectedWishes = ownedWishes - poolRemaining
  const ordered = plans.sort((a, b) => {
    const da = a.prediction?.date ?? '9999-12-31'
    const db = b.prediction?.date ?? '9999-12-31'
    if (da !== db) return da < db ? -1 : 1
    return PRIORITY_RANK[a.target.priority] - PRIORITY_RANK[b.target.priority]
  })

  return {
    ownedWishes,
    ownedFates,
    ownedFromPrimos,
    protectedWishes,
    free: Math.max(0, poolRemaining),
    plans: ordered,
    nextPlan: ordered.find((p) => !p.skippedByRule) ?? ordered[0],
  }

  function distributionFor(
    target: WishTarget,
    costMap: Map<string, TargetCost>,
    chrono: typeof chronological,
    u: UserWishState,
  ): number[] {
    void costMap
    const first = chrono[0]?.target.id === target.id
    const s: BannerState = first
      ? { pity: u.characterPity, guaranteed: u.characterGuaranteed, capturingRadianceState: u.capturingRadianceState ?? 0 }
      : { pity: 0, guaranteed: false, capturingRadianceState: 0 }
    const rule = target.pullRule?.kind
    if (rule === 'until-first-5star' || rule === 'stop-if-5050-lost') return fiveStarDistribution(s.pity)
    return limitedCharacterDistribution(s, Math.max(1, target.constellationTarget + 1))
  }
}

function buildIncomeSegments(curve: ForecastCurve, mode: PlanningMode): IncomeSegment[] {
  const dates = [...new Set(curve.points.map((p) => p.endDate ?? p.date))].sort()
  const segments: IncomeSegment[] = []
  let previous = curve.start
  for (const date of dates) {
    const balance = balanceForMode(curve, date, mode)
    const delta = balance - previous
    if (delta > 0) segments.push({ date, remaining: delta })
    previous = Math.max(previous, balance)
  }
  return segments
}

function gradeAffordability(allocated: number, cost: TargetCost, skipped?: string): Affordability {
  if (skipped) return 'at-risk'
  if (allocated >= cost.worstCase) return 'guaranteed'
  if (allocated >= cost.likely) return 'likely'
  if (allocated >= cost.median) return 'at-risk'
  return 'unfunded'
}

/**
 * "Skip if another Must target is within X versions" - the one pull rule that
 * can remove a target from the budget entirely.
 */
function skipReason(
  target: WishTarget,
  prediction: ReturnType<typeof resolvePrediction>,
  all: { target: WishTarget; prediction: ReturnType<typeof resolvePrediction> }[],
  versions: GameVersion[],
): string | undefined {
  if (target.pullRule?.kind !== 'skip-if-must-within') return undefined
  const window = target.pullRule.value ?? 1
  if (!prediction?.date) return undefined

  const indexOf = (id: string) => versions.findIndex((v) => v.id === id)
  const mine = indexOf(prediction.versionId)
  if (mine < 0) return undefined

  const conflict = all.find(
    (o) =>
      o.target.id !== target.id &&
      o.target.priority === 'must' &&
      o.prediction?.versionId &&
      indexOf(o.prediction.versionId) > mine &&
      indexOf(o.prediction.versionId) - mine <= window,
  )
  return conflict ? `Skipped - a Must target arrives within ${window} version${window === 1 ? '' : 's'}` : undefined
}

/* ------------------------------------------------------------------ */
/* Explanations                                                        */
/* ------------------------------------------------------------------ */

export const AFFORDABILITY_LABEL: Record<Affordability, string> = {
  guaranteed: 'Guaranteed',
  likely: 'Likely',
  'at-risk': 'At risk',
  unfunded: 'Unfunded',
}

export const AFFORDABILITY_MEANING: Record<Affordability, string> = {
  guaranteed: 'The worst possible run is covered. This does not depend on luck.',
  likely: 'Not guaranteed, but well funded on any ordinary run of luck.',
  'at-risk': 'Possible, though a bad run would force you to sacrifice something else.',
  unfunded: 'Your current plan cannot reasonably cover this.',
}

export const PLANNING_MODE_LABEL: Record<PlanningMode, string> = {
  safe: 'Safe',
  balanced: 'Balanced',
  risky: 'Risky',
}

export const PLANNING_MODE_DESCRIPTION: Record<PlanningMode, string> = {
  safe: 'Protect enough wishes for the worst case, and plan income conservatively.',
  balanced: 'Use probability estimates, but keep a safety buffer.',
  risky: 'Plan around the outcome you would typically expect.',
}

/** Wish resources restated as the plain number the Moon screen leads with. */
export function ownedWishesOf(user: UserWishState): number {
  return totalWishes({
    intertwinedFates: user.intertwinedFates,
    primogems: user.primogems,
    genesisCrystals: user.genesisCrystals,
  })
}
