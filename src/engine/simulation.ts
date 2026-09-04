import type { Affordability, Budget, UserWishState, WishTarget } from '@/types'
import { applyOutcome, likelyFiveStarAt, PRIMOS_PER_WISH, type BannerState } from './wish'

/**
 * SimulationEngine.
 *
 * Runs entirely on a copy. Nothing here writes to the store - the scenario sheet
 * only commits when the user taps "Apply outcome".
 */

export type ScenarioStep =
  | { kind: 'spend'; wishes: number }
  | { kind: 'win-5050'; at?: number }
  | { kind: 'lose-5050'; at?: number }
  | { kind: 'obtain-copy' }
  | { kind: 'weapon'; wishes: number }
  | { kind: 'skip' }

export interface ScenarioResult {
  user: UserWishState
  wishesSpent: number
  copiesObtained: number
  lostFiftyFifty: boolean
  gainedGuarantee: boolean
  log: string[]
}

export function runScenario(base: UserWishState, steps: ScenarioStep[], targetName = 'this character'): ScenarioResult {
  let state: BannerState = {
    pity: base.characterPity,
    guaranteed: base.characterGuaranteed,
    capturingRadianceState: base.capturingRadianceState ?? 0,
  }

  let spent = 0
  let copies = 0
  let lost = false
  let gainedGuarantee = false
  const log: string[] = []

  for (const step of steps) {
    switch (step.kind) {
      case 'skip':
        log.push('You skip the banner. Nothing changes.')
        break

      case 'spend': {
        const wishes = Math.max(0, Math.floor(step.wishes))
        const out = applyOutcome(state, 'spend', wishes)
        state = out.state
        spent += out.wishesSpent
        if (out.gotFiveStar) {
          copies += out.gotFeatured ? 1 : 0
          lost = lost || out.lostFiftyFifty
          log.push(`Spending ${wishes} reaches hard pity - a 5★ is forced.`)
        } else {
          log.push(`Spend ${wishes} wishes. Pity moves to ${state.pity}.`)
        }
        break
      }

      case 'win-5050': {
        const at = step.at ?? likelyFiveStarAt(state.pity)
        const cost = Math.max(1, at - state.pity)
        const out = applyOutcome(state, 'win-5050', cost)
        state = out.state
        spent += out.wishesSpent
        copies += 1
        log.push(`5★ at pity ${at}, and you win the 50/50. ${targetName} is yours.`)
        break
      }

      case 'lose-5050': {
        const at = step.at ?? likelyFiveStarAt(state.pity)
        const cost = Math.max(1, at - state.pity)
        const out = applyOutcome(state, 'lose-5050', cost)
        state = out.state
        spent += out.wishesSpent
        lost = true
        gainedGuarantee = true
        log.push(`5★ at pity ${at}, but the 50/50 goes to a standard character. Your next 5★ is guaranteed.`)
        break
      }

      case 'obtain-copy': {
        const at = likelyFiveStarAt(state.pity)
        const cost = Math.max(1, at - state.pity)
        const out = applyOutcome(state, 'win-5050', cost)
        state = out.state
        spent += out.wishesSpent
        copies += 1
        log.push(`Another copy at pity ${at}.`)
        break
      }

      case 'weapon': {
        const wishes = Math.max(0, Math.floor(step.wishes))
        spent += wishes
        log.push(`${wishes} wishes go to the weapon banner. Character pity is unaffected.`)
        break
      }
    }
  }

  return {
    user: spendWishes({ ...base, characterPity: state.pity, characterGuaranteed: state.guaranteed, capturingRadianceState: state.capturingRadianceState }, spent),
    wishesSpent: spent,
    copiesObtained: copies,
    lostFiftyFifty: lost,
    gainedGuarantee,
    log,
  }
}

/** Deduct wishes, drawing from Intertwined Fates before converting Primogems. */
export function spendWishes(user: UserWishState, wishes: number): UserWishState {
  let remaining = Math.max(0, Math.floor(wishes))
  const fatesUsed = Math.min(user.intertwinedFates, remaining)
  remaining -= fatesUsed

  let primogems = user.primogems
  let genesisCrystals = user.genesisCrystals
  if (remaining > 0) {
    let cost = remaining * PRIMOS_PER_WISH
    const fromPrimos = Math.min(primogems, cost)
    primogems -= fromPrimos
    cost -= fromPrimos
    genesisCrystals = Math.max(0, genesisCrystals - cost)
  }

  return {
    ...user,
    intertwinedFates: user.intertwinedFates - fatesUsed,
    primogems,
    genesisCrystals,
  }
}

export function addWishes(
  user: UserWishState,
  add: { intertwinedFates?: number; primogems?: number; genesisCrystals?: number },
): UserWishState {
  return {
    ...user,
    intertwinedFates: Math.max(0, user.intertwinedFates + (add.intertwinedFates ?? 0)),
    primogems: Math.max(0, user.primogems + (add.primogems ?? 0)),
    genesisCrystals: Math.max(0, user.genesisCrystals + (add.genesisCrystals ?? 0)),
  }
}

/* ------------------------------------------------------------------ */
/* Impact comparison                                                   */
/* ------------------------------------------------------------------ */

export interface ScenarioImpact {
  targetId: string
  name: string
  before: Affordability
  after: Affordability
  worsened: boolean
  improved: boolean
  balanceDelta: number
}

const RANK: Record<Affordability, number> = {
  guaranteed: 3, likely: 2, 'at-risk': 1, unfunded: 0,
}

export function compareBudgets(before: Budget, after: Budget, excludeTargetId?: string): ScenarioImpact[] {
  const beforeById = new Map(before.plans.map((p) => [p.target.id, p]))
  return after.plans
    .filter((p) => p.target.id !== excludeTargetId)
    .map((p) => {
      const prev = beforeById.get(p.target.id)
      const b = prev?.status ?? p.status
      return {
        targetId: p.target.id,
        name: p.character.displayName,
        before: b,
        after: p.status,
        worsened: RANK[p.status] < RANK[b],
        improved: RANK[p.status] > RANK[b],
        balanceDelta: p.reserved - (prev?.reserved ?? p.reserved),
      }
    })
}

/**
 * A short, human recommendation.
 *
 * The app's job is to say what a choice costs, not to push a decision - so this
 * names the trade and leaves it there.
 */
export function recommendStoppingPoint(
  impacts: ScenarioImpact[],
  hasGuarantee: boolean,
  targetName = 'this banner',
): string {
  const broken = impacts.filter((i) => i.worsened)
  if (broken.length === 0) {
    return hasGuarantee
      ? 'Nothing else on your roadmap moves, and you keep the guarantee.'
      : 'Nothing else on your roadmap is affected by this.'
  }
  const names = broken.slice(0, 2).map((b) => b.name).join(' and ')
  const more = broken.length > 2 ? `, and ${broken.length - 2} more` : ''
  return `This is the trade: ${targetName} costs you ${names}${more}. Stopping at the first 5★ is the least damaging point to walk away.`
}

export function isTargetSatisfied(target: WishTarget, copies: number): boolean {
  return copies >= target.constellationTarget + 1
}
