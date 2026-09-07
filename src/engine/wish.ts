/**
 * WishEngine - Character Event Wish mechanics.
 *
 * A hard boundary runs through this file:
 *
 *   DETERMINISTIC  - `worstCaseCost` and friends. Pure arithmetic on documented
 *                    mechanics (hard pity, guarantee). Safe to call "guaranteed".
 *   ESTIMATED      - everything driven by `fiveStarRate`. HoYoverse does not
 *                    publish the soft-pity curve, so this is a community-derived
 *                    approximation. It must never be surfaced as a guarantee.
 *
 * Capturing Radiance is treated as upside only. It never reduces a worst case.
 */

export const HARD_PITY = 90
export const SOFT_PITY_START = 74
export const BASE_RATE = 0.006
export const SOFT_PITY_STEP = 0.06
export const PRIMOS_PER_WISH = 160

/** ESTIMATED. Probability that pull number `n` since the last 5-star is a 5-star. */
export function fiveStarRate(n: number): number {
  if (n >= HARD_PITY) return 1
  if (n < SOFT_PITY_START) return BASE_RATE
  return Math.min(1, BASE_RATE + SOFT_PITY_STEP * (n - SOFT_PITY_START + 1))
}

/**
 * ESTIMATED. Distribution over the number of wishes needed to hit the next
 * 5-star, starting from `pity`. Index 0 is "1 wish from now".
 */
export function fiveStarDistribution(pity: number): number[] {
  const out: number[] = []
  let alive = 1
  for (let i = pity + 1; i <= HARD_PITY; i++) {
    const p = fiveStarRate(i)
    out.push(alive * p)
    alive *= 1 - p
    if (alive <= 0) break
  }
  return out
}

/** Convolution of two pull-count distributions. */
function convolve(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length).fill(0)
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue
    for (let j = 0; j < b.length; j++) {
      out[i + j + 1] += a[i] * b[j]
    }
  }
  return out
}

function scale(a: number[], k: number): number[] {
  return a.map((v) => v * k)
}

function add(a: number[], b: number[]): number[] {
  const out = new Array<number>(Math.max(a.length, b.length)).fill(0)
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0)
  return out
}

/**
 * ESTIMATED. Chance of winning the 50/50 given the Capturing Radiance counter.
 *
 * Community-derived model of the mechanic HoYoverse describes only qualitatively:
 * consecutive losses raise the chance the next limited 5-star is the featured one.
 * Overall this lands near the ~55% figure HoYoverse has quoted.
 */
export function fiftyFiftyWinChance(capturingRadianceState: number): number {
  switch (Math.max(0, Math.min(3, Math.round(capturingRadianceState)))) {
    case 0:
    case 1:
      return 0.5
    case 2:
      return 0.75
    default:
      return 1
  }
}

export interface BannerState {
  pity: number
  guaranteed: boolean
  capturingRadianceState: number
}

/**
 * ESTIMATED. Distribution over wishes needed to obtain `copies` of the featured
 * limited 5-star, starting from `state`.
 */
export function limitedCharacterDistribution(state: BannerState, copies = 1): number[] {
  let acc: number[] = []
  let s: BannerState = { ...state }

  for (let c = 0; c < copies; c++) {
    const one = singleCopyDistribution(s)
    acc = c === 0 ? one : convolve(acc, one)
    // After obtaining the featured character, pity and guarantee both reset.
    // The Radiance counter resets too (the 50/50 was won, or consumed).
    s = { pity: 0, guaranteed: false, capturingRadianceState: 0 }
  }
  return acc
}

function singleCopyDistribution(state: BannerState): number[] {
  const first = fiveStarDistribution(state.pity)
  if (state.guaranteed) return first

  const win = fiftyFiftyWinChance(state.capturingRadianceState)
  // Won the 50/50 -> done at the first 5-star.
  const winBranch = scale(first, win)
  // Lost it -> the next 5-star (from zero pity) is guaranteed.
  const second = fiveStarDistribution(0)
  const loseBranch = scale(convolve(first, second), 1 - win)
  return add(winBranch, loseBranch)
}

/**
 * ESTIMATED. Wishes to the featured character under a *fixed* 50/50 assumption,
 * rather than averaged over both branches.
 *
 * The scenario planner needs this: once someone has said "assume I win this
 * one", the honest distribution is the one for that branch alone, not the
 * blended one `limitedCharacterDistribution` returns.
 */
export function assumedDistribution(pity: number, needsTwoFiveStars: boolean): number[] {
  const first = fiveStarDistribution(pity)
  if (!needsTwoFiveStars) return first
  return convolve(first, fiveStarDistribution(0))
}

/** DETERMINISTIC. The ceiling that matches `assumedDistribution`. */
export function assumedWorstCase(pity: number, needsTwoFiveStars: boolean): number {
  return HARD_PITY - clampPity(pity) + (needsTwoFiveStars ? HARD_PITY : 0)
}

/** ESTIMATED. P(obtaining the target within `wishes`). */
export function chanceWithin(dist: number[], wishes: number): number {
  if (wishes <= 0) return 0
  let acc = 0
  for (let i = 0; i < Math.min(dist.length, wishes); i++) acc += dist[i]
  return Math.min(1, acc)
}

/** ESTIMATED. Smallest wish count reaching `p` cumulative probability. */
export function quantile(dist: number[], p: number): number {
  let acc = 0
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i]
    if (acc >= p) return i + 1
  }
  return dist.length
}

/** ESTIMATED. Mean wishes. */
export function meanOf(dist: number[]): number {
  let m = 0
  for (let i = 0; i < dist.length; i++) m += dist[i] * (i + 1)
  return m
}

/* ------------------------------------------------------------------ */
/* Deterministic worst case                                            */
/* ------------------------------------------------------------------ */

/**
 * DETERMINISTIC. Wishes that always suffice for `copies` of the limited 5-star.
 *
 * One copy from a fresh, non-guaranteed state costs at most 180: 90 to force a
 * 5-star that may lose the 50/50, then 90 more for the guaranteed one. Capturing
 * Radiance can only make this cheaper, so it is deliberately ignored.
 */
export function worstCaseCost(state: BannerState, copies = 1): number {
  if (copies <= 0) return 0
  const pity = clampPity(state.pity)
  const firstCopy = state.guaranteed ? HARD_PITY - pity : HARD_PITY - pity + HARD_PITY
  return firstCopy + (copies - 1) * HARD_PITY * 2
}

/** DETERMINISTIC. Wishes that always suffice to force the next 5-star of any kind. */
export function worstCaseToNextFiveStar(pity: number): number {
  return HARD_PITY - clampPity(pity)
}

export function clampPity(pity: number): number {
  if (!Number.isFinite(pity)) return 0
  return Math.max(0, Math.min(HARD_PITY - 1, Math.floor(pity)))
}

/* ------------------------------------------------------------------ */
/* Resource conversion                                                 */
/* ------------------------------------------------------------------ */

export function wishesFromPrimogems(primogems: number): number {
  return Math.floor(Math.max(0, primogems) / PRIMOS_PER_WISH)
}

export function primogemsToWishesExact(primogems: number): number {
  return Math.max(0, primogems) / PRIMOS_PER_WISH
}

export interface Resources {
  intertwinedFates: number
  primogems: number
  genesisCrystals: number
}

/** Wishes obtainable right now. Genesis Crystals convert 1:1 into Primogems. */
export function totalWishes(r: Resources): number {
  return (
    Math.max(0, Math.floor(r.intertwinedFates)) +
    wishesFromPrimogems(Math.max(0, r.primogems) + Math.max(0, r.genesisCrystals))
  )
}

/* ------------------------------------------------------------------ */
/* Simulation primitives                                               */
/* ------------------------------------------------------------------ */

export interface PullOutcome {
  state: BannerState
  wishesSpent: number
  gotFeatured: boolean
  gotFiveStar: boolean
  lostFiftyFifty: boolean
}

/**
 * Apply a deterministic "what if" outcome to a banner state. The scenario
 * planner uses this rather than sampling, so results are reproducible.
 */
export function applyOutcome(
  state: BannerState,
  outcome: 'win-5050' | 'lose-5050' | 'spend' | 'skip',
  wishes: number,
): PullOutcome {
  const base: PullOutcome = {
    state: { ...state },
    wishesSpent: 0,
    gotFeatured: false,
    gotFiveStar: false,
    lostFiftyFifty: false,
  }

  switch (outcome) {
    case 'skip':
      return base

    case 'spend': {
      const spent = Math.max(0, Math.floor(wishes))
      const newPity = state.pity + spent
      if (newPity >= HARD_PITY) {
        // Spending past hard pity necessarily produced a 5-star; the caller
        // should have used a 5-star outcome instead. Resolve conservatively.
        return applyOutcome(state, state.guaranteed ? 'win-5050' : 'lose-5050', HARD_PITY - state.pity)
      }
      return { ...base, state: { ...state, pity: newPity }, wishesSpent: spent }
    }

    case 'win-5050':
      return {
        state: { pity: 0, guaranteed: false, capturingRadianceState: 0 },
        wishesSpent: Math.max(1, Math.floor(wishes)),
        gotFeatured: true,
        gotFiveStar: true,
        lostFiftyFifty: false,
      }

    case 'lose-5050':
      return {
        state: {
          pity: 0,
          guaranteed: true,
          capturingRadianceState: Math.min(3, state.capturingRadianceState + 1),
        },
        wishesSpent: Math.max(1, Math.floor(wishes)),
        gotFeatured: false,
        gotFiveStar: true,
        lostFiftyFifty: true,
      }
  }
}

/** ESTIMATED. Most likely pull number for the next 5-star, for scenario defaults. */
export function likelyFiveStarAt(pity: number): number {
  const dist = fiveStarDistribution(pity)
  return clampPity(pity) + quantile(dist, 0.5)
}
