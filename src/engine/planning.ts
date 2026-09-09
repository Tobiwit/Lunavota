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
  fiftyFiftyWinChance,
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

export const PRIORITY_ORDER: Priority[] = ['must', 'dream', 'want', 'try', 'luxury']

const PRIORITY_RANK: Record<Priority, number> = {
  must: 0, dream: 1, want: 2, try: 3, luxury: 4,
}

/**
 * Each band, written as the wishes it sets aside in the ordinary case: a C0 goal
 * from zero pity. That is the shape these numbers were chosen in, so it is the
 * shape they are stated in - a table of quantiles would say the same thing in
 * digits nobody could check.
 *
 * They are converted to quantiles of that reference curve once, below, and it is
 * the quantile the engine plans with. That is what lets pity already banked and
 * a constellation goal above C0 move the reservation: a literal 155 would be
 * nonsense for a C2 target and wasteful for someone already sitting on 70 pity.
 *
 * Try is the exception and carries its stopping rule, not a certainty - see
 * STOPS_AT_FIRST_FIVE_STAR. Its 90 is hard pity, and no mode may move it.
 */
const REFERENCE_RESERVE: Record<PlanningMode, Record<Priority, number>> = {
  safe: { must: 180, dream: 180, want: 155, try: 90, luxury: 0 },
  balanced: { must: 180, dream: 155, want: 120, try: 90, luxury: 0 },
  risky: { must: 155, dream: 150, want: 100, try: 90, luxury: 0 },
}

/**
 * The opportunistic ceiling, funded only from wishes nobody else has claimed.
 *
 * Deliberately not a function of the planning mode: a stretch spends nothing
 * that was needed elsewhere, so there is no risk for a mode to trade away.
 * Priorities absent from this table never stretch.
 */
const REFERENCE_STRETCH: Partial<Record<Priority, number>> = {
  want: 155,
  luxury: 75,
}

/** The C0-from-zero-pity cost curve every band is calibrated against. */
const REFERENCE_STATE: BannerState = { pity: 0, guaranteed: false, capturingRadianceState: 0 }
const REFERENCE_CURVE = limitedCharacterDistribution(REFERENCE_STATE, 1)
const REFERENCE_CEILING = worstCaseCost(REFERENCE_STATE, 1)

/**
 * A reserve in wishes, restated as the certainty it buys.
 *
 * `quantile` inverts `chanceWithin` exactly on this curve, so a band written as
 * 120 comes back out of the engine as 120 for the case it was written for.
 */
function confidenceForReserve(wishes: number): number {
  if (wishes <= 0) return 0
  if (wishes >= REFERENCE_CEILING) return 1
  return chanceWithin(REFERENCE_CURVE, wishes)
}

function confidenceTable(reserves: Record<Priority, number>): Record<Priority, number> {
  const out = {} as Record<Priority, number>
  for (const priority of PRIORITY_ORDER) {
    // A Try's price is its stopping rule, so it is always planned to the whole
    // of it. Reading its 90 off the two-5-star curve would say 59%, which is
    // the chance of a different question entirely.
    out[priority] = priority === 'try' ? 1 : confidenceForReserve(reserves[priority])
  }
  return out
}

/**
 * How certain the plan insists on being, by priority and mode. 0..1.
 *
 * 1 means the deterministic worst case - a target planned to 1 does not depend
 * on luck at all. Anything lower is an estimate drawn from the soft-pity curve.
 */
export const TARGET_CONFIDENCE: Record<PlanningMode, Record<Priority, number>> = {
  safe: confidenceTable(REFERENCE_RESERVE.safe),
  balanced: confidenceTable(REFERENCE_RESERVE.balanced),
  risky: confidenceTable(REFERENCE_RESERVE.risky),
}

export const STRETCH_CONFIDENCE: Partial<Record<Priority, number>> = Object.fromEntries(
  Object.entries(REFERENCE_STRETCH).map(([priority, wishes]) => [
    priority,
    confidenceForReserve(wishes),
  ]),
)

/**
 * A Try stops at the first 5-star, won or lost.
 *
 * That makes its cost deterministic - hard pity is 90 from zero - which is why
 * no planning mode moves it. What luck decides here is not the price but the
 * prize: about half the time the 50/50 hands you someone else and you stop.
 */
const STOPS_AT_FIRST_FIVE_STAR: Record<Priority, boolean> = {
  must: false, dream: false, want: false, try: true, luxury: false,
}

/** Whether this target's budget ends at its first 5-star, won or lost. */
export function stopsAtFirstFiveStar(target: WishTarget): boolean {
  const rule = target.pullRule?.kind
  return (
    STOPS_AT_FIRST_FIVE_STAR[target.priority] ||
    rule === 'until-first-5star' ||
    rule === 'stop-if-5050-lost'
  )
}

/**
 * For a C0 limited 5-star from zero pity the quantiles land at roughly:
 *
 *   0.27 ->  75 wishes      0.70 -> 120 wishes
 *   0.50 ->  80 wishes      0.80 -> 150 wishes
 *   0.90 -> 155 wishes      1.00 -> 180 (deterministic)
 *
 * The curve is deliberately not linear. Half the time the 50/50 is won and the
 * cost stops near 80; past that, the second 5-star pushes everything toward the
 * 180 ceiling, so the tiers between 150 and 180 buy very little.
 *
 * Balanced mode therefore reads, in wishes: Must 180, Dream 155, Want 120
 * stretching to 155, Try 90, Luxury nothing but a stretch to 75. These are
 * quantiles rather than fixed numbers so that pity already banked and a
 * constellation goal above C0 both move them, which fixed numbers could not.
 */

/**
 * Which priorities are allowed to hold back wishes the player already has.
 *
 * "Luxury" is explicitly for spare resources, so it should never be able to
 * drive "safe to spend" toward zero. It is still costed and still gets an
 * affordability status; it simply draws on what is left over rather than on the
 * pool in hand. A stretch never protects the pool either, whatever its owner's
 * priority - that is what makes it a stretch.
 */
const PROTECTS_POOL: Record<Priority, boolean> = {
  must: true, dream: true, want: true, try: true, luxury: false,
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

export function costFor(
  target: WishTarget,
  state: BannerState,
  confidence = 1,
  stretchConfidence?: number,
): TargetCost {
  const copies = Math.max(1, target.constellationTarget + 1)
  const rule = target.pullRule?.kind

  const stopsAtFirst = stopsAtFirstFiveStar(target)

  const dist = stopsAtFirst
    ? fiveStarDistribution(state.pity)
    : limitedCharacterDistribution(state, copies)

  let worst = stopsAtFirst
    ? worstCaseToNextFiveStar(state.pity)
    : worstCaseCost(state, copies)

  let likely = quantile(dist, 0.75)
  let median = quantile(dist, 0.5)
  let expected = meanOf(dist)

  // At full confidence the plan uses the deterministic worst case rather than a
  // 100th-percentile estimate, so the number never rests on the modelled curve.
  // At zero it reserves nothing at all, which is what Luxury means.
  let planned =
    confidence <= 0 ? 0 : confidence >= 1 ? worst : Math.min(worst, quantile(dist, confidence))

  let stretch =
    stretchConfidence == null
      ? planned
      : Math.max(
          planned,
          stretchConfidence >= 1 ? worst : Math.min(worst, quantile(dist, stretchConfidence)),
        )

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
    planned = Math.min(planned, cap)
    stretch = Math.min(stretch, cap)
  }

  return {
    worstCase: Math.round(worst),
    likely: Math.round(likely),
    median: Math.round(median),
    expected: Math.round(expected),
    planned: Math.round(planned),
    stretch: Math.round(stretch),
  }
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
  const bannerStates = new Map<string, BannerState>()
  for (const { target } of chronological) {
    bannerStates.set(target.id, state)
    costs.set(
      target.id,
      costFor(
        target,
        state,
        TARGET_CONFIDENCE[mode][target.priority],
        STRETCH_CONFIDENCE[target.priority],
      ),
    )
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

  /**
   * Two passes.
   *
   * The first covers every target's `planned` reservation in priority order -
   * that is the commitment. The second hands out what is still unclaimed
   * afterwards, so a Want can reach for its stretch only once nothing with a
   * firmer claim needs those wishes, and a Luxury only after that.
   */
  interface Alloc {
    target: WishTarget
    prediction: ReturnType<typeof resolvePrediction>
    bannerDate?: string
    skipped?: string
    timingUnknown: boolean
    need: number
    fromIncome: number
    fromPool: number
    stretchFromIncome: number
    stretchFromPool: number
  }

  let poolRemaining = ownedWishes
  const allocs: Alloc[] = []

  for (const { target, prediction } of byPriority) {
    const cost = costs.get(target.id)!
    const need = target.lockedReservation ?? cost.planned

    // A banner already underway is treated as happening now, not in the past.
    const bannerDate = prediction?.date && prediction.date < now ? now : prediction?.date
    const skipped = skipReason(target, prediction, byPriority, versions)

    // Nobody credibly knows when this character arrives, so there is no date to
    // fund against. Locking wishes away for them today would be pure guesswork,
    // and it would quietly starve targets that do have a placement.
    const timingUnknown = !bannerDate

    const outstanding = skipped ? 0 : need
    const fromIncome = drawIncome(bannerDate, outstanding)
    const fromPool =
      PROTECTS_POOL[target.priority] && !timingUnknown
        ? Math.min(poolRemaining, outstanding - fromIncome)
        : 0
    poolRemaining -= fromPool

    allocs.push({
      target, prediction, bannerDate, skipped, timingUnknown, need,
      fromIncome, fromPool, stretchFromIncome: 0, stretchFromPool: 0,
    })
  }

  // Pass two. `stretchPool` shadows the pool rather than spending it: a stretch
  // is an opportunity, not a commitment, so it must not shrink "free to spend".
  // Shadowing still stops two stretches from claiming the same wish.
  let stretchPool = poolRemaining
  for (const a of allocs) {
    if (a.skipped || a.timingUnknown || a.target.lockedReservation != null) continue
    const room = costs.get(a.target.id)!.stretch - a.need
    if (room <= 0) continue
    a.stretchFromIncome = drawIncome(a.bannerDate, room)
    a.stretchFromPool = Math.min(stretchPool, room - a.stretchFromIncome)
    stretchPool -= a.stretchFromPool
  }

  let cumulativeNeed = 0
  const plans: TargetPlan[] = []

  for (const a of allocs) {
    const { target, prediction, bannerDate } = a
    const character = characters.get(target.characterId)!
    const cost = costs.get(target.id)!
    if (!a.timingUnknown) cumulativeNeed += a.need

    const stretch = a.stretchFromIncome + a.stretchFromPool
    const allocated = a.fromIncome + a.fromPool + stretch

    const range = bannerDate
      ? curve.balanceRangeAt(bannerDate)
      : { low: ownedWishes, expected: ownedWishes, high: ownedWishes }
    const atEarliest = prediction?.earliest
      ? balanceForMode(curve, prediction.earliest.date, mode)
      : range.expected
    const atEnd = prediction?.endDate ? curve.balanceAt(prediction.endDate) : range.expected

    plans.push({
      target,
      character,
      cost,
      plannedCost: a.need,
      timingUnknown: a.timingUnknown,
      targetConfidence: TARGET_CONFIDENCE[mode][target.priority],
      reservedFromPool: a.fromPool,
      reservedFromIncome: a.fromIncome,
      reservedStretch: stretch,
      reserved: allocated,
      balanceAtBanner: range.expected,
      balanceAtBannerLow: range.low,
      balanceAtBannerHigh: range.high,
      balanceAtEarliest: atEarliest,
      balanceAtBannerEnd: atEnd,
      incomeDuringBanner: Math.max(0, atEnd - range.expected),
      status: gradeAffordability(allocated, cost, a.need, a.skipped),

      shortfall: Math.max(0, a.need - allocated),
      fundedDate: curve.dateWhenBalanceReaches(cumulativeNeed),
      prediction,
      successChance: successChanceFor(target, allocated),
      skippedByRule: a.skipped,
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
    stretchedFromPool: Math.max(0, poolRemaining - stretchPool),
    plans: ordered,
    nextPlan: ordered.find((p) => !p.skippedByRule) ?? ordered[0],
  }

  /** Take from income that has arrived by `by`, latest first. */
  function drawIncome(by: string | undefined, amount: number): number {
    if (!by || amount <= 0) return 0
    let taken = 0
    const eligible = segments
      .filter((seg) => seg.date <= by && seg.remaining > 0)
      .sort((a, b) => (a.date > b.date ? -1 : 1))
    for (const seg of eligible) {
      if (taken >= amount) break
      const take = Math.min(seg.remaining, amount - taken)
      seg.remaining -= take
      taken += take
    }
    return taken
  }

  /**
   * ESTIMATED. The chance `allocated` wishes actually land the target.
   *
   * Reaching a 5-star is not the same as reaching *this* 5-star. A run that
   * stops at the first one - a Try, or either of the stop-early pull rules -
   * only wins the character when the 50/50 goes your way, so the curve's own
   * answer has to be discounted by that.
   */
  function successChanceFor(target: WishTarget, allocated: number): number {
    const st = bannerStates.get(target.id) ?? {
      pity: 0, guaranteed: false, capturingRadianceState: 0,
    }
    const stops = stopsAtFirstFiveStar(target)

    const dist = stops
      ? fiveStarDistribution(st.pity)
      : limitedCharacterDistribution(st, Math.max(1, target.constellationTarget + 1))
    const wins = stops && !st.guaranteed ? fiftyFiftyWinChance(st.capturingRadianceState) : 1
    return chanceWithin(dist, allocated) * wins
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

function gradeAffordability(
  allocated: number,
  cost: TargetCost,
  planned: number,
  skipped?: string,
): Affordability {
  if (skipped) return 'at-risk'

  // A band that reserves nothing has no shortfall to report. Graded against the
  // ordinary curve it would read "unfunded" forever, painting a wishlist red
  // over a target that is behaving exactly as asked, so it is graded against
  // its own stretch instead - and never as guaranteed, since nothing is owed.
  if (planned <= 0) {
    if (cost.stretch <= 0 || allocated <= 0) return 'unfunded'
    return allocated >= cost.stretch ? 'likely' : 'at-risk'
  }

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

/**
 * The vocabulary lives with the rules it names.
 *
 * `PriorityGlyph` re-exports both so every use site keeps its old import, but
 * they are defined here so that re-cutting a band cannot leave its wording
 * behind in a component nobody thought to open.
 */
export const PRIORITY_LABEL: Record<Priority, string> = {
  must: 'Must',
  dream: 'Dream',
  want: 'Want',
  try: 'Try',
  luxury: 'Luxury',
}

export const PRIORITY_MEANING: Record<Priority, string> = {
  must: 'I would strongly regret missing them. Held to a full guarantee.',
  dream: 'I intend to get them, and will spend enough to be nearly certain.',
  want: 'I intend to get them, and will spend more only if nothing else needs it.',
  try: 'Worth one 5-star. If the 50/50 goes the wrong way, walk away.',
  luxury: 'Only worth pulling with resources to spare.',
}

/**
 * What this target's band actually promises, in one sentence.
 *
 * Empty for a Must, where the plan *is* the guarantee and saying both would
 * only repeat the same number back.
 */
export function reservationNote(plan: TargetPlan): string {
  const { target, cost, plannedCost, targetConfidence } = plan
  const label = PRIORITY_LABEL[target.priority]

  if (target.lockedReservation != null) {
    return `You pinned this target at ${plannedCost} wishes, so no band decides it.`
  }

  if (target.priority === 'try') {
    return `A Try stops at the first 5-star, won or lost — ${plannedCost} wishes at hard pity, and no more. About half the time that 5-star is the one you wanted; the rest of the time you walk away.`
  }

  if (target.priority === 'luxury') {
    return cost.stretch > 0
      ? `Luxury holds nothing back. This is topped up toward ${cost.stretch} wishes only from what no other target needed, so it is the first thing a new target takes away.`
      : 'Luxury holds nothing back, and there is nothing spare to top it up with.'
  }

  if (targetConfidence >= 1) return ''

  const base = `${label} targets are planned to ${Math.round(targetConfidence * 100)}% certainty — ${plannedCost} wishes. A full guarantee regardless of luck would need ${cost.worstCase}.`
  return cost.stretch > plannedCost
    ? `${base} If wishes are left over once every other target is covered, this stretches toward ${cost.stretch}.`
    : base
}

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

/**
 * Affordability, worded for a target whose budget is certain but whose outcome
 * is not.
 *
 * A fully funded Try covers every wish it can spend, so the money really is
 * guaranteed - but the character is not, and "does not depend on luck" printed
 * beside a 50% chance is the kind of contradiction that costs a tool its
 * credibility. It gets its own word instead of borrowing the strongest one.
 */
export function affordabilityLabel(plan: TargetPlan): string {
  if (plan.plannedCost <= 0) return plan.reserved > 0 ? 'On spare wishes' : 'Nothing spare'
  if (plan.status === 'guaranteed' && stopsAtFirstFiveStar(plan.target)) return 'Funded'
  return AFFORDABILITY_LABEL[plan.status]
}

export function affordabilityMeaning(plan: TargetPlan): string {
  if (plan.plannedCost <= 0) {
    return plan.reserved > 0
      ? 'Nothing is held back for this. What is set aside is only what nothing else laid claim to, so read the odds as a bonus rather than a plan.'
      : 'Nothing is held back for this, and there is nothing spare to reach with. It costs you nothing to leave on the list.'
  }
  if (plan.status === 'guaranteed' && stopsAtFirstFiveStar(plan.target)) {
    return 'Every wish this can spend is covered, so you will reach a 5-star. Whether it is this one is the 50/50.'
  }
  return AFFORDABILITY_MEANING[plan.status]
}

export const PLANNING_MODE_LABEL: Record<PlanningMode, string> = {
  safe: 'Safe',
  balanced: 'Balanced',
  risky: 'Risky',
}

export const PLANNING_MODE_DESCRIPTION: Record<PlanningMode, string> = {
  safe: 'Guarantee your Must and Dream targets outright, and plan income at the low end.',
  balanced: 'Guarantee your Must targets. Fund Dreams to nine runs in ten, Wants to seven.',
  risky: 'Plan around the outcome you would typically expect, and spend the difference.',
}

/** Wish resources restated as the plain number the Moon screen leads with. */
export function ownedWishesOf(user: UserWishState): number {
  return totalWishes({
    intertwinedFates: user.intertwinedFates,
    primogems: user.primogems,
    genesisCrystals: user.genesisCrystals,
  })
}
