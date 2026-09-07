import type { ForecastCurve, TargetPlan, UserWishState } from '@/types'
import { assumedDistribution, assumedWorstCase, chanceWithin, clampPity, quantile } from './wish'
import { today } from '@/lib/date'

/**
 * Chained scenario.
 *
 * The single-banner "what if" answers one question; this answers the one people
 * actually have, which is what a pull here does to everything after it. It walks
 * the wishlist in the order the banners arrive, spending at each and carrying
 * pity, guarantee and the running balance forward.
 *
 * The dial at each stop is *how many wishes it took*, not a budget cap. So each
 * character in the chain is obtained — the question being explored is what it
 * costs when it takes 78 rather than 150, and who further down pays for it.
 * A dial at zero is a skipped banner.
 */

export interface ChainAssumption {
  /** Assume the 50/50 falls your way here. Ignored while on a guarantee. */
  winFiftyFifty: boolean
  /** Wishes it takes. Undefined means "use the typical run". */
  pulls?: number
}

export interface ChainNode {
  plan: TargetPlan
  /** Banner date, clamped forward so a banner already running reads as today. */
  date: string
  /** Wishes forecast to be in hand when this opens, after everything spent before it. */
  available: number
  pulls: number
  /** The dial's range: zero to the deterministic ceiling for this assumption. */
  maxPulls: number
  /** What this stop costs on a typical run, under the same 50/50 assumption. */
  medianPulls: number
  /** ESTIMATED. P(it takes this many wishes or fewer). */
  chance: number
  /** A loss earlier in the chain left this banner on a guarantee. */
  onGuarantee: boolean
  winFiftyFifty: boolean
  skipped: boolean
  balanceAfter: number
  /** How far past the forecast balance this stop reaches. */
  shortBy: number
}

export interface ChainInput {
  now?: string
  user: UserWishState
  /** Chronological, and only those with a credible banner placement. */
  plans: TargetPlan[]
  curve: ForecastCurve
  assumptionFor: (targetId: string) => ChainAssumption
}

export function runChain({ now = today(), user, plans, curve, assumptionFor }: ChainInput): ChainNode[] {
  let pity = clampPity(user.characterPity)
  let guaranteed = user.characterGuaranteed
  let spent = 0

  const out: ChainNode[] = []

  for (const plan of plans) {
    const rawDate = plan.prediction?.date
    if (!rawDate) continue
    const date = rawDate < now ? now : rawDate

    const assumption = assumptionFor(plan.target.id)
    // A guarantee removes the 50/50 outright, so the toggle has nothing to decide.
    const winFiftyFifty = guaranteed ? true : assumption.winFiftyFifty
    const needsTwoFiveStars = !winFiftyFifty

    const dist = assumedDistribution(pity, needsTwoFiveStars)
    const maxPulls = assumedWorstCase(pity, needsTwoFiveStars)
    const medianPulls = quantile(dist, 0.5)

    const requested = assumption.pulls ?? medianPulls
    const pulls = Math.max(0, Math.min(maxPulls, Math.round(requested)))
    const skipped = pulls === 0

    // Deliberately not clamped to what is available: dialling past the forecast
    // is how you find out a plan does not fit, so the overshoot is shown rather
    // than quietly absorbed.
    const available = Math.max(0, curve.balanceAt(date) - spent)

    out.push({
      plan,
      date,
      available,
      pulls,
      maxPulls,
      medianPulls,
      chance: skipped ? 0 : chanceWithin(dist, pulls),
      onGuarantee: guaranteed,
      winFiftyFifty,
      skipped,
      balanceAfter: available - pulls,
      shortBy: Math.max(0, pulls - available),
    })

    if (!skipped) {
      spent += pulls
      // Obtaining the featured character resets pity and consumes any guarantee,
      // whichever branch got you there.
      pity = 0
      guaranteed = false
    }
  }

  return out
}

/** Everything the footer and the summary line need, without re-walking the chain. */
export function summariseChain(nodes: ChainNode[]): {
  totalSpent: number
  obtained: number
  skipped: number
  firstShortfall?: ChainNode
} {
  const active = nodes.filter((n) => !n.skipped)
  return {
    totalSpent: active.reduce((sum, n) => sum + n.pulls, 0),
    obtained: active.length,
    skipped: nodes.length - active.length,
    firstShortfall: nodes.find((n) => n.shortBy > 0),
  }
}
